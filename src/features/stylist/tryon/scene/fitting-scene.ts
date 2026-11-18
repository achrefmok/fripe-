// La scène 3D de la cabine : rendu à la demande (rien ne tourne quand rien ne bouge), rotation de
// ±40° au doigt ou à la souris, zoom au pincement ou à la molette, vues face et trois-quarts,
// libération complète de la mémoire graphique à la fermeture.
import {
  Group,
  Mesh,
  MeshPhysicalMaterial,
  type Material,
  NeutralToneMapping,
  type Object3D,
  Scene,
  SRGBColorSpace,
  type Texture,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BuiltMannequin } from "../mannequin/build-mannequin";
import { createCamera, framingDistance, MAX_TURN, type View, VIEWS } from "./camera";
import { backdrop, setupLighting } from "./lighting";

export type FittingScene = ReturnType<typeof createFittingScene>;

function disposeTree(root: Object3D) {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as (Material & { map?: Texture | null })[];
    for (const material of materials) {
      material.map?.dispose();
      material.dispose();
    }
  });
}

// La laque grise du mannequin de vitrine : un vernis brillant sur un gris clair légèrement froid.
export function lacquer() {
  return new MeshPhysicalMaterial({ color: 0xc3c6cc, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 0.85 });
}

export function createFittingScene(canvas: HTMLCanvasElement, options: { lowPower: boolean }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: options.lowPower ? "low-power" : "default" });
  renderer.outputColorSpace = SRGBColorSpace;
  // Un rendu des tons neutre : les couleurs des pièces restent celles des photos.
  renderer.toneMapping = NeutralToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.lowPower ? 1.5 : 2));

  const scene = new Scene();
  const background = backdrop();
  scene.background = background;
  const { environment } = setupLighting(scene, renderer, { shadows: !options.lowPower });
  const camera = createCamera(1);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.rotateSpeed = 0.7;
  controls.minAzimuthAngle = -MAX_TURN;
  controls.maxAzimuthAngle = MAX_TURN;
  controls.minPolarAngle = Math.PI * 0.42;
  controls.maxPolarAngle = Math.PI * 0.56;

  const body = new Group();
  const garments = new Group();
  scene.add(body, garments);
  let height = 1.8;
  let frame = 0;
  let quiet = 0;
  let disposed = false;
  let tween: { from: number; to: number; start: number } | null = null;

  const render = () => {
    if (!disposed) renderer.render(scene, camera);
  };

  // Une boucle courte, seulement pendant un geste et l'amorti qui le suit.
  const loop = () => {
    frame = 0;
    if (disposed) return;
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.start) / 420);
      const eased = 1 - (1 - t) ** 3;
      const angle = tween.from + (tween.to - tween.from) * eased;
      const radius = camera.position.distanceTo(controls.target);
      camera.position.set(controls.target.x + Math.sin(angle) * radius, camera.position.y, controls.target.z + Math.cos(angle) * radius);
      if (t >= 1) tween = null;
    }
    const moved = controls.update();
    render();
    quiet = moved || tween ? 0 : quiet + 1;
    if (quiet < 8) frame = requestAnimationFrame(loop);
  };
  const wake = () => {
    quiet = 0;
    if (!frame) frame = requestAnimationFrame(loop);
  };
  controls.addEventListener("start", wake);
  controls.addEventListener("change", wake);

  function frameBody() {
    controls.target.set(0, height * 0.52, 0);
    const distance = framingDistance(camera, height);
    camera.position.set(0, height * 0.55, distance);
    controls.minDistance = distance * 0.38;
    controls.maxDistance = distance * 1.15;
    controls.update();
  }

  return {
    renderer,
    setBody(mannequin: BuiltMannequin) {
      disposeTree(body);
      body.clear();
      const material = lacquer();
      for (const part of mannequin.parts) {
        const mesh = new Mesh(part.geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        body.add(mesh);
      }
      const changed = Math.abs(mannequin.anchors.height - height) > 0.01;
      height = mannequin.anchors.height;
      if (changed) frameBody();
      wake();
    },
    setGarments(objects: Object3D[]) {
      disposeTree(garments);
      garments.clear();
      for (const object of objects) garments.add(object);
      wake();
    },
    view(name: View) {
      const offset = camera.position.clone().sub(controls.target);
      tween = { from: Math.atan2(offset.x, offset.z), to: VIEWS[name], start: performance.now() };
      wake();
    },
    zoom(factor: number) {
      const offset = camera.position.clone().sub(controls.target);
      const length = Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length() * factor));
      camera.position.copy(controls.target).add(offset.setLength(length));
      wake();
    },
    reset() {
      frameBody();
      wake();
    },
    resize(width: number, heightPx: number) {
      renderer.setSize(width, heightPx, false);
      camera.aspect = width / heightPx;
      camera.updateProjectionMatrix();
      frameBody();
      render();
    },
    snapshot() {
      render();
      return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    },
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      controls.dispose();
      disposeTree(scene);
      background.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
