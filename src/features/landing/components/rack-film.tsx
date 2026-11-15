"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Les silhouettes découpées dans chaque toile (même tracé que les symboles SVG de la page).
const SHAPES = {
  tee: "M50 44 22 56 10 92l24 8 8-20v110h74V80l8 20 24-8-12-36-28-12c-4 10-14 16-29 16s-25-6-29-16z",
  dress: "M58 44h42l-4 24c6 6 10 14 10 22l30 100H22L52 90c0-8 4-16 10-22z",
  jacket: "M48 44 18 58 6 170l26 4 10-80v100h76V94l10 80 26-4-12-112-30-14-31 52z",
  sweat: "M52 44 20 58 8 150l22 6 12-60v94h76V96l12 60 22-6-12-92-32-14c-4 8-14 12-28 12s-24-4-28-12z",
} as const;
type Shape = keyof typeof SHAPES;
type Pattern = "knit" | "floral" | "stripe" | "dots" | "check" | "denim";

const LOOKS: [Shape, string, string, Pattern][] = [
  ["jacket", "#6b7b5e", "#55634a", "knit"],
  ["dress", "#b25634", "#f2c7a8", "floral"],
  ["tee", "#f2eadd", "#120f0c", "stripe"],
  ["sweat", "#3d5a80", "#2c4562", "knit"],
  ["dress", "#1d1714", "#cca45e", "dots"],
  ["jacket", "#8a5a3a", "#b98b5e", "check"],
  ["tee", "#e0b44c", "#f6f1e7", "stripe"],
  ["sweat", "#c9b79a", "#a8946f", "check"],
  ["jacket", "#3d5a80", "#2c4562", "denim"],
  ["dress", "#d98a8f", "#f6f1e7", "dots"],
  ["tee", "#a33b2f", "#f6f1e7", "stripe"],
];
const HERO = 8;

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

// Une toile 300×320 : le motif du tissu, l'ombre du pli, puis la couture en pointillés.
function paintCloth(shape: Shape, base: string, accent: string, pattern: Pattern, seed: number, photo?: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 320;
  const g = canvas.getContext("2d")!;
  g.setTransform(2, 0, 0, 2, -12, -80);
  const path = new Path2D(SHAPES[shape]);
  const random = seeded(seed);
  g.save();
  g.clip(path);
  g.fillStyle = base;
  g.fillRect(0, 0, 200, 220);
  if (photo) {
    // La vraie photo de la pièce, recadrée comme object-fit: cover dans la silhouette.
    const box = { x: 6, y: 40, w: 140, h: 156 };
    const scale = Math.max(box.w / photo.naturalWidth, box.h / photo.naturalHeight);
    const w = photo.naturalWidth * scale;
    const h = photo.naturalHeight * scale;
    g.drawImage(photo, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
  } else if (pattern === "stripe") {
    g.fillStyle = accent;
    for (let x = 0; x < 200; x += 12) g.fillRect(x, 0, 5, 220);
  } else if (pattern === "dots") {
    g.fillStyle = accent;
    for (let y = 40; y < 210; y += 10)
      for (let x = ((y / 10) % 2) * 5; x < 170; x += 10) {
        g.beginPath();
        g.arc(x, y, 1.8, 0, 7);
        g.fill();
      }
  } else if (pattern === "check") {
    g.globalAlpha = 0.45;
    g.fillStyle = accent;
    for (let x = 0; x < 200; x += 16) g.fillRect(x, 0, 8, 220);
    for (let y = 0; y < 220; y += 16) g.fillRect(0, y, 200, 8);
    g.globalAlpha = 1;
  } else if (pattern === "denim") {
    g.strokeStyle = "rgba(255,255,255,.07)";
    g.lineWidth = 0.6;
    for (let i = -220; i < 220; i += 2.2) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 220, 220);
      g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,.05)";
    for (let i = 0; i < 900; i += 1) g.fillRect(random() * 170, 40 + random() * 170, 1, 1);
  } else if (pattern === "floral") {
    for (let i = 0; i < 70; i += 1) {
      const x = random() * 170;
      const y = 40 + random() * 170;
      g.fillStyle = i % 3 ? accent : "#f6f1e7";
      for (let k = 0; k < 5; k += 1) {
        g.beginPath();
        g.arc(x + Math.cos(k * 1.26) * 2.6, y + Math.sin(k * 1.26) * 2.6, 1.8, 0, 7);
        g.fill();
      }
      g.fillStyle = "#cca45e";
      g.beginPath();
      g.arc(x, y, 1.1, 0, 7);
      g.fill();
    }
  } else {
    g.strokeStyle = "rgba(0,0,0,.08)";
    g.lineWidth = 0.8;
    for (let y = 40; y < 210; y += 3) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(200, y);
      g.stroke();
    }
  }
  const shade = g.createLinearGradient(0, 44, 0, 200);
  shade.addColorStop(0, "rgba(255,255,255,.08)");
  shade.addColorStop(1, "rgba(0,0,0,.28)");
  g.fillStyle = shade;
  g.fillRect(0, 0, 200, 220);
  g.restore();
  g.setLineDash([3, 3]);
  g.lineWidth = 1.2;
  g.strokeStyle = "rgba(255,255,255,.22)";
  g.stroke(path);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Le portant du film d'ouverture : la caméra suit le défilement (progress.current, de 0 à 1) et finit
// sur la pépite, qui se décroche du portant. Sans WebGL, la page garde son fond dégradé.
export function RackFilm({
  progress,
  heroImage,
  rtl,
  reduced,
  onUnsupported,
}: {
  progress: { current: number };
  heroImage: string | null;
  rtl: boolean;
  reduced: boolean;
  onUnsupported: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      onUnsupported();
      return;
    }

    const mobile = innerWidth < 760;
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x110c09, 7, 22);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.35;
    const camera = new THREE.PerspectiveCamera(mobile ? 48 : 34, 1, 0.1, 60);

    scene.add(new THREE.AmbientLight(0xfff1e0, 0.25));
    const key = new THREE.SpotLight(0xffe0b0, 9, 0, Math.PI / 4.5, 0.6, 0);
    key.position.set(4, 9, 5);
    key.target.position.set(4, 1.8, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xd2643a, 2.2);
    rim.position.set(-6, 3, -5);
    scene.add(rim);
    const fill = new THREE.PointLight(0xcca45e, 1.2, 0, 0);
    fill.position.set(5, 2.5, 4);
    scene.add(fill);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x1b130e, roughness: 0.92, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gold = new THREE.MeshStandardMaterial({ color: 0xcca45e, metalness: 1, roughness: 0.28 });
    const RAIL_Y = 3;
    const XL = -0.6;
    const XR = 11.8;
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, XR - XL, 24), gold);
    rail.rotation.z = Math.PI / 2;
    rail.position.set((XL + XR) / 2, RAIL_Y, 0);
    rail.castShadow = true;
    scene.add(rail);
    for (const x of [XL, XR]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, RAIL_Y, 16), gold);
      post.position.set(x, RAIL_Y / 2, 0);
      post.castShadow = true;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 12), gold);
      foot.rotation.x = Math.PI / 2;
      foot.position.set(x, 0.03, 0);
      scene.add(post, foot);
    }

    const hook: THREE.Vector3[] = [];
    for (let a = Math.PI * 1.15; a >= -Math.PI * 0.5; a -= 0.12) hook.push(new THREE.Vector3(0.055 * Math.cos(a), 0.055 * Math.sin(a), 0));
    hook.push(new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(-0.36, -0.4, 0), new THREE.Vector3(0.36, -0.4, 0), new THREE.Vector3(0, -0.15, 0));
    const hangerGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hook, false, "catmullrom", 0.05), 160, 0.011, 8, false);

    const GW = 1;
    const GH = (GW * 320) / 300;
    const items = LOOKS.map((look, index) => {
      const group = new THREE.Group();
      const x = 0.25 + index * 1.12;
      group.position.set(x, RAIL_Y, 0);
      const yaw = (seeded(index * 31 + 7)() - 0.5) * 0.5;
      group.rotation.y = yaw;
      const hanger = new THREE.Mesh(hangerGeometry, gold);
      hanger.castShadow = true;
      group.add(hanger);
      const geometry = new THREE.PlaneGeometry(GW, GH, 12, 16);
      geometry.translate(0, -GH / 2, 0);
      const material = new THREE.MeshStandardMaterial({ map: paintCloth(...look, index * 97 + 13), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.86, metalness: 0 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = -0.33;
      mesh.castShadow = true;
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: material.map, alphaTest: 0.5 });
      group.add(mesh);
      scene.add(group);
      return { group, mesh, material, base: Float32Array.from(geometry.attributes.position.array), phase: index * 1.7, yaw, x };
    });

    // La pépite porte la photo de la vraie pièce mise en avant, si le stockage l'autorise (CORS).
    let disposed = false;
    if (heroImage) {
      const photo = new Image();
      photo.crossOrigin = "anonymous";
      photo.onload = () => {
        if (disposed) return;
        const hero = items[HERO];
        const [shape, base, accent, pattern] = LOOKS[HERO];
        const texture = paintCloth(shape, base, accent, pattern, 1, photo);
        hero.material.map?.dispose();
        hero.material.map = texture;
        hero.material.needsUpdate = true;
        (hero.mesh.customDepthMaterial as THREE.MeshDepthMaterial).map = texture;
      };
      photo.src = heroImage;
    }

    const count = mobile ? 220 : 480;
    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(count * 3);
    const scatter = seeded(42);
    for (let i = 0; i < count; i += 1) {
      dustPositions[i * 3] = (XL + XR) / 2 + (scatter() - 0.5) * 18;
      dustPositions[i * 3 + 1] = scatter() * 6;
      dustPositions[i * 3 + 2] = (scatter() - 0.5) * 8;
    }
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({ color: 0xe8c98a, size: 0.028, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Points(dustGeometry, dustMaterial));

    const heroX = items[HERO].x;
    const keys = [
      { p: 0, pos: [-0.6, 2.4, 7.6], look: [2.6, 2.0, 0] },
      { p: 0.5, pos: [2.2, 2.65, 4.4], look: [5.4, 2.2, 0] },
      { p: 1, pos: [heroX, 2.3, 2.75], look: [heroX, 2.25, 0] },
    ];
    const cameraAt = (p: number) => {
      const [a, b] = p > keys[1].p ? [keys[1], keys[2]] : [keys[0], keys[1]];
      const t = smooth(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
      return { pos: a.pos.map((v, i) => mix(v, b.pos[i], t)), look: a.look.map((v, i) => mix(v, b.look[i], t)) };
    };
    const position = new THREE.Vector3(...keys[0].pos);
    const target = new THREE.Vector3(...keys[0].look);
    const nextPosition = new THREE.Vector3();
    const nextTarget = new THREE.Vector3();
    let mouseX = 0;
    let mouseY = 0;
    let goalX = 0;
    let goalY = 0;
    const onPointer = (event: PointerEvent) => {
      goalX = event.clientX / innerWidth - 0.5;
      goalY = event.clientY / innerHeight - 0.5;
    };
    addEventListener("pointermove", onPointer);

    // Le texte occupe un côté de l'écran : le portant se décale de l'autre (à gauche en arabe).
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (w / h > 1.1) camera.setViewOffset(w, h, (rtl ? 0.2 : -0.2) * w, 0, w, h);
      // En portrait, le texte occupe le bas de l'écran : le portant remonte dans le tiers supérieur.
      else if (w / h < 0.9) camera.setViewOffset(w, h, 0, 0.2 * h, w, h);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    addEventListener("resize", resize);
    resize();

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(canvas);

    const clock = new THREE.Clock();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = reduced ? 0 : clock.elapsedTime;
      const p = progress.current;
      const ease = reduced ? 1 : 1 - Math.exp(-dt * 5);
      mouseX += (goalX - mouseX) * 0.05;
      mouseY += (goalY - mouseY) * 0.05;
      const shot = cameraAt(p);
      position.lerp(nextPosition.set(shot.pos[0] + mouseX * 0.6, shot.pos[1] - mouseY * 0.35, shot.pos[2]), ease);
      target.lerp(nextTarget.set(shot.look[0], shot.look[1], shot.look[2]), ease);
      camera.position.copy(position);
      camera.lookAt(target);
      const wind = reduced ? 0 : 0.6 + Math.abs(mouseX) * 1.5;
      const lift = smooth(Math.min(1, Math.max(0, (p - 0.72) / 0.28)));
      items.forEach((item, index) => {
        const { group } = item;
        group.rotation.z = Math.sin(t * 0.9 + item.phase) * 0.035 * wind + mouseX * 0.06;
        group.rotation.y = item.yaw * (1 - (index === HERO ? lift : 0)) + Math.sin(t * 0.5 + item.phase) * 0.12 * (reduced ? 0 : 1);
        if (index === HERO) {
          group.position.z = lift;
          group.position.y = RAIL_Y + lift * 0.22;
          group.rotation.y += lift * Math.PI * 2;
        } else {
          group.position.z = -lift * (Math.abs(item.x - heroX) < 2.5 ? 0.35 : 0);
        }
        if (!wind) return;
        const attribute = item.mesh.geometry.attributes.position;
        const array = attribute.array as Float32Array;
        for (let v = 0; v < array.length; v += 3) {
          const x = item.base[v];
          const y = item.base[v + 1];
          array[v + 2] = (Math.sin(x * 4 + t * 1.7 + item.phase) * 0.022 + Math.sin(y * 5 + t * 2.3 + item.phase) * 0.028) * (-y / GH) * wind;
        }
        attribute.needsUpdate = true;
        item.mesh.geometry.computeVertexNormals();
      });
      if (!reduced) {
        for (let i = 0; i < count; i += 1) {
          dustPositions[i * 3 + 1] += 0.0025 + Math.sin(t + i) * 0.0008;
          if (dustPositions[i * 3 + 1] > 6) dustPositions[i * 3 + 1] = 0;
        }
        dustGeometry.attributes.position.needsUpdate = true;
        key.intensity = 9 + Math.sin(t * 1.3) * 0.4;
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      removeEventListener("pointermove", onPointer);
      removeEventListener("resize", resize);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            (material as THREE.MeshStandardMaterial).map?.dispose();
            material.dispose();
          }
        }
      });
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [heroImage, rtl, reduced, progress, onUnsupported]);

  return <canvas ref={canvasRef} className="ld-gl" aria-hidden="true" />;
}
