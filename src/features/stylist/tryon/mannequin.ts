// Le mannequin de la cabine : une silhouette 3D (three.js) rendue une fois dans le navigateur, de face,
// comme un mannequin de vitrine. On connaît chaque partie du corps, donc chaque zone que couvre une pièce :
// buste et haut des bras pour le haut, bassin et jambes pour le bas, pieds pour les chaussures.
import type { Slot } from "../engine";
import type { Frame } from "./pose";

export type Mannequin = {
  photo: HTMLCanvasElement;
  body: HTMLCanvasElement;
  regions: Partial<Record<Slot, HTMLCanvasElement>>;
  frames: Partial<Record<Slot, Frame>>;
};

const WIDTH = 600;
const HEIGHT = 900;

type Part = "head" | "neck" | "torso" | "shoulder" | "upperArm" | "lowerArm" | "hand" | "pelvis" | "thigh" | "shin" | "foot";

// Les parties couvertes par chaque type de pièce.
const REGIONS: Partial<Record<Slot, Part[]>> = {
  top: ["torso", "shoulder", "upperArm"],
  bottom: ["pelvis", "thigh", "shin"],
  shoes: ["foot"],
};

function layer() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return canvas;
}

// Le rectangle occupé par ce qui n'est pas transparent.
function bounds(canvas: HTMLCanvasElement) {
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, WIDTH, HEIGHT);
  let minX = WIDTH;
  let minY = HEIGHT;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (data[(y * WIDTH + x) * 4 + 3] > 60) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// Le tissu est un peu plus large que le corps : la zone est élargie de quelques pixels.
function dilate(source: HTMLCanvasElement, radius: number) {
  const out = layer();
  const context = out.getContext("2d")!;
  for (let dx = -radius; dx <= radius; dx += radius) {
    for (let dy = -radius; dy <= radius; dy += radius) context.drawImage(source, dx, dy);
  }
  return out;
}

let cached: Promise<Mannequin> | null = null;
export function renderMannequin() {
  cached ??= build();
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

async function build(): Promise<Mannequin> {
  const THREE = await import("three");
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(WIDTH, HEIGHT, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-1.5, 3, 4);
    scene.add(key, new THREE.HemisphereLight(0xffffff, 0xd9cfc2, 0.5));

    const camera = new THREE.PerspectiveCamera(18, WIDTH / HEIGHT, 0.1, 50);
    camera.position.set(0, 0.92, 6.4);
    camera.lookAt(0, 0.9, 0);

    // Gris de vitrine, laqué.
    const material = new THREE.MeshPhysicalMaterial({ color: 0xbfc3ca, roughness: 0.28, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    const meshes: { mesh: InstanceType<typeof THREE.Mesh>; part: Part }[] = [];
    const add = (mesh: InstanceType<typeof THREE.Mesh>, part: Part) => {
      scene.add(mesh);
      meshes.push({ mesh, part });
    };
    const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
    const up = V(0, 1, 0);

    const joint = (at: InstanceType<typeof THREE.Vector3>, radius: number, part: Part, scale: [number, number, number] = [1, 1, 1]) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 24), material);
      mesh.position.copy(at);
      mesh.scale.set(...scale);
      add(mesh, part);
    };
    const limb = (from: InstanceType<typeof THREE.Vector3>, to: InstanceType<typeof THREE.Vector3>, r1: number, r2: number, part: Part) => {
      const direction = to.clone().sub(from);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, direction.length(), 40, 1, true), material);
      mesh.position.copy(from).addScaledVector(direction, 0.5);
      mesh.quaternion.setFromUnitVectors(up, direction.normalize());
      add(mesh, part);
    };
    const lathe = (profile: [number, number][], part: Part, depth: number) => {
      const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 64), material);
      mesh.scale.set(1, 1, depth);
      add(mesh, part);
    };

    // Tête et cou.
    joint(V(0, 1.66), 0.1, "head", [0.82, 1.12, 0.95]);
    limb(V(0, 1.45), V(0, 1.57), 0.05, 0.043, "neck");
    // Buste : taille marquée, épaules arrondies.
    lathe([[0, 0.99], [0.145, 0.99], [0.128, 1.08], [0.134, 1.16], [0.152, 1.24], [0.165, 1.32], [0.172, 1.38], [0.16, 1.43], [0.115, 1.465], [0.055, 1.485], [0, 1.49]], "torso", 0.6);
    lathe([[0, 0.84], [0.1, 0.85], [0.152, 0.9], [0.163, 0.96], [0.148, 1.03], [0, 1.03]], "pelvis", 0.62);

    for (const side of [-1, 1]) {
      // Bras légèrement écartés, comme sur un mannequin de vitrine.
      const shoulder = V(side * 0.185, 1.4);
      const middle = V(side * 0.212, 1.27);
      const elbow = V(side * 0.24, 1.13);
      const wrist = V(side * 0.275, 0.87);
      joint(shoulder, 0.05, "shoulder");
      limb(shoulder, middle, 0.049, 0.043, "upperArm");
      joint(middle, 0.043, "lowerArm");
      limb(middle, elbow, 0.043, 0.035, "lowerArm");
      joint(elbow, 0.035, "lowerArm");
      limb(elbow, wrist, 0.034, 0.024, "lowerArm");
      joint(wrist, 0.024, "lowerArm");
      joint(V(side * 0.285, 0.805), 0.03, "hand", [0.7, 1.75, 0.9]);

      const hip = V(side * 0.085, 0.9);
      const knee = V(side * 0.08, 0.5);
      const ankle = V(side * 0.078, 0.09);
      joint(hip, 0.078, "thigh");
      limb(hip, knee, 0.08, 0.053, "thigh");
      joint(knee, 0.056, "shin");
      limb(knee, ankle, 0.055, 0.033, "shin");
      joint(ankle, 0.034, "foot");
      joint(V(side * 0.092, 0.042, 0.07), 0.04, "foot", [0.95, 0.85, 2.4]);
    }

    const snapshot = () => {
      renderer.render(scene, camera);
      const out = layer();
      out.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
      return out;
    };

    const figure = snapshot();

    // Les zones : chaque groupe de parties rendu seul, en blanc uni.
    scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const show = (parts: Part[] | null) => meshes.forEach(({ mesh, part }) => (mesh.visible = !parts || parts.includes(part)));
    const regions: Partial<Record<Slot, HTMLCanvasElement>> = {};
    for (const [slot, parts] of Object.entries(REGIONS) as [Slot, Part[]][]) {
      show(parts);
      regions[slot] = dilate(snapshot(), 3);
    }
    show(null);
    const body = snapshot();

    // Le décor : un fond crème dégradé et l'ombre portée au sol.
    const photo = layer();
    const context = photo.getContext("2d")!;
    const wall = context.createLinearGradient(0, 0, 0, HEIGHT);
    wall.addColorStop(0, "#e4ddd5");
    wall.addColorStop(0.62, "#ece5dc");
    wall.addColorStop(1, "#f4eee6");
    context.fillStyle = wall;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    const feet = bounds(regions.shoes!);
    if (feet) {
      const shadow = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      shadow.addColorStop(0, "rgba(60, 48, 36, 0.28)");
      shadow.addColorStop(1, "rgba(60, 48, 36, 0)");
      context.save();
      context.translate(feet.x + feet.width / 2, feet.y + feet.height * 0.85);
      context.scale(feet.width * 0.9, feet.height * 0.55);
      context.fillStyle = shadow;
      context.beginPath();
      context.arc(0, 0, 1, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.drawImage(figure, 0, 0);

    // Les cadres : le haut, le bas et les chaussures épousent exactement leur zone.
    const frames: Partial<Record<Slot, Frame>> = {};
    for (const slot of Object.keys(REGIONS) as Slot[]) {
      const box = bounds(regions[slot]!);
      if (box) frames[slot] = { ...box, rotate: 0, fit: true, clip: true };
    }
    // Le sac ou l'accessoire, posé à côté de la main.
    const top = frames.top;
    if (top) frames.accessory = { x: top.x + top.width * 0.86, y: HEIGHT * 0.42, width: WIDTH * 0.22, height: WIDTH * 0.28, rotate: 0, fit: false, clip: false };

    pmrem.dispose();
    return { photo, body, regions, frames };
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
