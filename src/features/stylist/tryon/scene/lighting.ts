// L'éclairage studio de la cabine : reflets doux d'une pièce blanche pour la laque, une lumière
// principale qui porte l'ombre au sol, un contre-jour léger qui détache la silhouette du fond crème.
import {
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  PMREMGenerator,
  PlaneGeometry,
  type Scene,
  ShadowMaterial,
  SRGBColorSpace,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

function canvas(width: number, height: number, paint: (context: CanvasRenderingContext2D) => void) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  paint(element.getContext("2d")!);
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

// Le fond : un crème qui s'éclaircit vers le sol, comme un studio photo.
export function backdrop() {
  return canvas(4, 256, (context) => {
    const wall = context.createLinearGradient(0, 0, 0, 256);
    wall.addColorStop(0, "#e2dbd2");
    wall.addColorStop(0.6, "#ebe4db");
    wall.addColorStop(1, "#f4eee6");
    context.fillStyle = wall;
    context.fillRect(0, 0, 4, 256);
  });
}

export function setupLighting(scene: Scene, renderer: WebGLRenderer, { shadows }: { shadows: boolean }) {
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;

  scene.add(new HemisphereLight(0xfffaf2, 0xd8cdbf, 0.55), new AmbientLight(0xffffff, 0.12));

  const key = new DirectionalLight(0xfff6ea, 1.9);
  // Haute et presque de face : l'ombre tombe derrière le mannequin, courte, comme en studio.
  key.position.set(-0.35, 4.8, 2.2);
  if (shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -0.8, right: 0.8, top: 2.1, bottom: -0.3, near: 0.5, far: 8 });
  }
  const fill = new DirectionalLight(0xf2f0ff, 0.45);
  fill.position.set(2.4, 1.6, 2.2);
  const rim = new DirectionalLight(0xffffff, 0.7);
  rim.position.set(0.8, 2.6, -2.8);
  scene.add(key, fill, rim);

  // Le sol reçoit l'ombre portée ; une ombre de contact, plus dense, ancre les pieds.
  const floor = new Mesh(new PlaneGeometry(6, 6), new ShadowMaterial({ opacity: 0.12 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const contactTexture = canvas(128, 128, (context) => {
    const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    glow.addColorStop(0, "rgba(58, 46, 34, 0.55)");
    glow.addColorStop(0.55, "rgba(58, 46, 34, 0.18)");
    glow.addColorStop(1, "rgba(58, 46, 34, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 128, 128);
  });
  const contact = new Mesh(new CircleGeometry(0.42, 48), new MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.001;
  contact.scale.set(1, 0.62, 1);
  scene.add(floor, contact);

  return { key, environment };
}
