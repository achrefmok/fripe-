// Génère les icônes PWA depuis un seul dessin : l'étiquette FRIPE.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const HARISSA = "#c23f28";
const PAPER = "#f3efe4";

const tag = (scale) => {
  const offset = (512 - 512 * scale) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})">
    <path fill-rule="evenodd" fill="${PAPER}" d="M176 84h160l72 72v300a12 12 0 0 1-12 12H116a12 12 0 0 1-12-12V156z
      M256 124a34 34 0 1 0 0 68 34 34 0 0 0 0-68z"/>
    <path fill="${HARISSA}" d="M186 250h148v42H234v40h84v42h-84v62h-48z"/>
  </g>`;
};

const svg = (scale) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${HARISSA}"/>${tag(scale)}</svg>`,
  );

mkdirSync("public/icons", { recursive: true });

await sharp(svg(0.9)).resize(192).png().toFile("public/icons/icon-192.png");
await sharp(svg(0.9)).resize(512).png().toFile("public/icons/icon-512.png");
await sharp(svg(0.68)).resize(512).png().toFile("public/icons/maskable-512.png");
await sharp(svg(0.9)).resize(180).png().toFile("src/app/apple-icon.png");
await sharp(svg(0.9)).resize(48).png().toFile("src/app/icon.png");

