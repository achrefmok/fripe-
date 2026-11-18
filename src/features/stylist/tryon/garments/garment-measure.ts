// Ce qu'on lit sur la photo détourée d'une pièce, sans la modifier : la largeur de chaque rangée,
// l'écart entre les jambes (short ou jupe ?), le côté de la pointe (chaussures).
export type GarmentShape = {
  width: number;
  height: number;
  // first/last : les bords extrêmes de la rangée ; core : la portion continue qui passe par le milieu
  // de la photo (le corps du vêtement, sans les manches écartées ni le fond resté entre elles).
  rows: { first: number; last: number; runs: number; coreFirst: number; coreLast: number }[];
  columns: number[];
};

export function measureAlpha(alpha: ArrayLike<number>, width: number, height: number, stride = 4, offset = 3): GarmentShape {
  const rows: GarmentShape["rows"] = [];
  const columns = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y++) {
    const spans: [number, number][] = [];
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const opaque = x < width && alpha[(y * width + x) * stride + offset] > 110;
      if (opaque) {
        columns[x]++;
        if (start < 0) start = x;
      } else if (start >= 0) {
        spans.push([start, x - 1]);
        start = -1;
      }
    }
    const first = spans.length ? spans[0][0] : -1;
    const last = spans.length ? spans[spans.length - 1][1] : -1;
    const runs = spans.length;
    // Le corps : la portion qui contient le milieu ; si le milieu est vide (veste ouverte, entrejambe),
    // les deux portions qui l'encadrent, quand l'écart reste étroit ; sinon la plus proche du milieu.
    const middle = width / 2;
    let coreFirst = -1;
    let coreLast = -1;
    const containing = spans.find(([from, to]) => from <= middle && to >= middle);
    if (containing) [coreFirst, coreLast] = containing;
    else if (spans.length) {
      const left = spans.filter(([, to]) => to < middle).at(-1);
      const right = spans.find(([from]) => from > middle);
      if (left && right && right[0] - left[1] < width * 0.25) [coreFirst, coreLast] = [left[0], right[1]];
      else {
        const nearest = [left, right].filter(Boolean).sort((a, b) => Math.min(Math.abs(a![0] - middle), Math.abs(a![1] - middle)) - Math.min(Math.abs(b![0] - middle), Math.abs(b![1] - middle)))[0]!;
        [coreFirst, coreLast] = nearest;
      }
    }
    rows.push({ first, last, runs, coreFirst, coreLast });
  }
  return { width, height, rows, columns };
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// La largeur (et le centre) de la pièce sur une bande de rangées, en pixels.
export function bandWidth(shape: GarmentShape, [from, to]: [number, number]) {
  const start = Math.floor(from * shape.height);
  const end = Math.max(start + 1, Math.ceil(to * shape.height));
  const rows = shape.rows.slice(start, end).filter((row) => row.coreFirst >= 0);
  if (!rows.length) return { width: shape.width, center: shape.width / 2 };
  return { width: median(rows.map((row) => row.coreLast - row.coreFirst + 1)), center: median(rows.map((row) => (row.coreFirst + row.coreLast) / 2)) };
}

// Les manches posées à plat, écartées du corps du vêtement, ne peuvent pas suivre les bras du mannequin
// sans déformer la photo : on ne garde, rangée par rangée, que la portion qui passe par le milieu.
// Les manches attachées au corps (t-shirt) restent. Rien n'est étiré ni déplacé.
export function keepCore(data: Uint8ClampedArray, shape: GarmentShape) {
  for (let y = 0; y < shape.height; y++) {
    const row = shape.rows[y];
    if (row.runs < 2 || row.coreFirst < 0) continue;
    for (let x = 0; x < shape.width; x++) {
      if (x < row.coreFirst || x > row.coreLast) data[(y * shape.width + x) * 4 + 3] = 0;
    }
  }
}

// La première rangée qui appartient vraiment au vêtement : un cintre ou une étiquette au-dessus, fins,
// ne comptent pas (sinon la pièce serait posée trop bas).
export function contentTop(shape: GarmentShape, referenceWidth: number) {
  const index = shape.rows.findIndex((row) => row.first >= 0 && row.last - row.first + 1 >= referenceWidth * 0.3);
  return Math.max(0, index);
}

// Short ou jupe, d'après le bas de la photo : deux jambes séparées, ou un seul ourlet. null si on ne sait pas.
export function bottomFromShape(shape: GarmentShape): "shorts" | "skirt" | null {
  const start = Math.floor(shape.height * 0.86);
  const rows = shape.rows.slice(start).filter((row) => row.first >= 0);
  if (rows.length < 4) return null;
  const split = rows.filter((row) => row.runs >= 2).length / rows.length;
  if (split > 0.7) return "shorts";
  if (split < 0.08) return "skirt";
  return null;
}

// Les chaussures sont photographiées de profil : la pointe est le côté le plus bas.
export function toeSide(shape: GarmentShape): "left" | "right" {
  const band = Math.max(1, Math.floor(shape.width * 0.22));
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const left = average(shape.columns.slice(0, band));
  const right = average(shape.columns.slice(shape.width - band));
  return left < right ? "left" : "right";
}
