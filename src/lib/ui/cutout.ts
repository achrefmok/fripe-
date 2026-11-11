// Détourage d'une photo de pièce, dans le navigateur et sans service extérieur. La plupart des
// photos sont prises sur un fond uni (drap, mur, table) : on part des bords de l'image et on
// retire tout ce qui ressemble au fond, de proche en proche. Si le fond n'est pas uni, ou si la
// pièce se confond avec lui, on renonce et l'appelant garde la photo entière.

const MAX_SIDE = 480;
// Écart de couleur toléré avec le fond, et écart toléré de proche en proche pour suivre une ombre.
const NEAR = 46;
const FAR = 92;
const STEP = 9;

const cache = new Map<string, Promise<string | null>>();

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

type Rgb = [number, number, number];

function patch(data: Uint8ClampedArray, width: number, x0: number, y0: number, size: number): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) {
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
  }
  const n = size * size;
  return [r / n, g / n, b / n];
}

function gap(a: Rgb, b: Rgb) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function cut(src: string): Promise<string | null> {
  const image = await load(src);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(16, Math.round(image.naturalWidth * scale));
  const height = Math.max(16, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;

  // Le fond se lit dans les quatre coins. Une pièce peut en toucher un : trois coins d'accord
  // suffisent, le quatrième prend alors leur couleur.
  const size = Math.max(4, Math.round(Math.min(width, height) * 0.035));
  const corners: Rgb[] = [
    patch(data, width, 0, 0, size),
    patch(data, width, width - size, 0, size),
    patch(data, width, 0, height - size, size),
    patch(data, width, width - size, height - size, size),
  ];
  const agree = corners.map((corner) => corners.filter((other) => gap(corner, other) < 70).length);
  const best = Math.max(...agree);
  if (best < 3) return null;
  const reference = corners[agree.indexOf(best)];
  const trusted = corners.map((corner) => (gap(corner, reference) < 70 ? corner : reference));

  // Le fond attendu en un point : le mélange des quatre coins, ce qui suit un dégradé d'éclairage.
  const background = (x: number, y: number, out: Rgb) => {
    const u = x / (width - 1);
    const v = y / (height - 1);
    for (let c = 0; c < 3; c++) {
      const top = trusted[0][c] * (1 - u) + trusted[1][c] * u;
      const bottom = trusted[2][c] * (1 - u) + trusted[3][c] * u;
      out[c] = top * (1 - v) + bottom * v;
    }
  };

  const total = width * height;
  const removed = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const local: Rgb = [0, 0, 0];

  const distance = (index: number) => {
    background(index % width, (index / width) | 0, local);
    const i = index * 4;
    return Math.hypot(data[i] - local[0], data[i + 1] - local[1], data[i + 2] - local[2]);
  };

  const seed = (index: number) => {
    if (!removed[index] && distance(index) < NEAR) {
      removed[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  const visit = (from: number, to: number) => {
    if (removed[to]) return;
    const d = distance(to);
    let accept = d < NEAR;
    if (!accept && d < FAR) {
      const a = from * 4;
      const b = to * 4;
      accept = Math.hypot(data[a] - data[b], data[a + 1] - data[b + 1], data[a + 2] - data[b + 2]) < STEP;
    }
    if (accept) {
      removed[to] = 1;
      queue[tail++] = to;
    }
  };

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    if (x > 0) visit(index, index - 1);
    if (x < width - 1) visit(index, index + 1);
    if (index >= width) visit(index, index - width);
    if (index < total - width) visit(index, index + width);
  }

  // Rien retiré, ou presque tout : le fond n'était pas lisible.
  const share = tail / total;
  if (share < 0.12 || share > 0.9) return null;

  // Les miettes restées dans le fond (plis, ombres) s'en vont : on ne garde que les grands morceaux.
  const label = new Int32Array(total);
  const areas: number[] = [0];
  for (let start = 0; start < total; start++) {
    if (removed[start] || label[start]) continue;
    const id = areas.length;
    let area = 0;
    head = 0;
    tail = 0;
    queue[tail++] = start;
    label[start] = id;
    while (head < tail) {
      const index = queue[head++];
      area++;
      const x = index % width;
      const push = (to: number) => {
        if (!removed[to] && !label[to]) {
          label[to] = id;
          queue[tail++] = to;
        }
      };
      if (x > 0) push(index - 1);
      if (x < width - 1) push(index + 1);
      if (index >= width) push(index - width);
      if (index < total - width) push(index + width);
    }
    areas.push(area);
  }
  const largest = Math.max(...areas);
  if (largest / total < 0.05) return null;

  const alpha = new Uint8Array(total);
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  for (let index = 0; index < total; index++) {
    if (removed[index] || areas[label[index]] < largest * 0.06) continue;
    alpha[index] = 255;
    const x = index % width;
    const y = (index / width) | 0;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }

  // Une pièce bien détourée flotte au milieu de l'image. Si ce qui reste longe les bords, c'est
  // qu'un morceau de décor (sol, table) est resté, ou que la photo est un gros plan : on renonce.
  let edge = 0;
  for (let x = 0; x < width; x++) edge += (alpha[x] ? 1 : 0) + (alpha[(height - 1) * width + x] ? 1 : 0);
  for (let y = 0; y < height; y++) edge += (alpha[y * width] ? 1 : 0) + (alpha[y * width + width - 1] ? 1 : 0);
  if (edge / (2 * (width + height)) > 0.14) return null;

  // Le bord s'adoucit sans jamais déborder sur le fond : on prend le plus petit entre le masque et
  // sa moyenne locale.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (!alpha[index]) {
        data[index * 4 + 3] = 0;
        continue;
      }
      let sum = 0;
      let count = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += alpha[yy * width + xx];
          count++;
        }
      }
      const soft = sum / count;
      // Une moyenne de 60 % correspond au bord franc : en dessous, la transparence gagne vite.
      data[index * 4 + 3] = Math.max(0, Math.min(255, (soft - 140) * 2.4));
    }
  }
  context.putImageData(pixels, 0, 0);

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const output = document.createElement("canvas");
  output.width = cropWidth;
  output.height = cropHeight;
  output.getContext("2d")?.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
  return blob ? URL.createObjectURL(blob) : null;
}

// L'adresse d'une version détourée de l'image, ou null quand le détourage n'est pas fiable.
export function cutoutUrl(src: string): Promise<string | null> {
  let pending = cache.get(src);
  if (!pending) {
    pending = cut(src).catch(() => null);
    cache.set(src, pending);
  }
  return pending;
}
