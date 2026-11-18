// Dessine les pièces qui manquent aux photos de démonstration (robe, jupe, short, pantalon, manteau),
// posées à plat sur un fond clair, pour tester la cabine d'essayage sur chaque type de vêtement.
// Ce sont des illustrations générées, pas des photos : elles ne servent qu'au faux Supabase de test.
// Usage : node scripts/rapport/vetements/generer.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage();
const images = await page.evaluate(() => {
  const W = 720;
  const H = 960;
  const draw = (paint) => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext("2d");
    c.fillStyle = "#f3f1ee";
    c.fillRect(0, 0, W, H);
    paint(c);
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
  };
  // Un tissu : couleur, léger dégradé de lumière, grain, ombre portée douce.
  const cloth = (c, path, base, light, dark) => {
    c.save();
    c.shadowColor = "rgba(40, 30, 20, 0.22)";
    c.shadowBlur = 24;
    c.shadowOffsetY = 10;
    c.fillStyle = base;
    c.fill(path);
    c.restore();
    c.save();
    c.clip(path);
    const shade = c.createLinearGradient(0, 0, W, H);
    shade.addColorStop(0, light);
    shade.addColorStop(0.5, "rgba(0,0,0,0)");
    shade.addColorStop(1, dark);
    c.fillStyle = shade;
    c.fillRect(0, 0, W, H);
    for (let index = 0; index < 5000; index++) {
      c.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},0.035)`;
      c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    c.restore();
  };
  const seam = (c, points, color) => {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.setLineDash([7, 6]);
    c.beginPath();
    points.forEach(([x, y], index) => (index ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
    c.restore();
  };
  const shape = (points, curve = []) => {
    const path = new Path2D();
    points.forEach(([x, y], index) => (index ? path.lineTo(x, y) : path.moveTo(x, y)));
    curve.forEach((step) => step(path));
    path.closePath();
    return path;
  };

  return {
    "robe-ete": draw((c) => {
      const path = new Path2D();
      path.moveTo(285, 70);
      path.quadraticCurveTo(360, 135, 435, 70);
      path.lineTo(470, 95);
      path.lineTo(462, 300);
      path.quadraticCurveTo(450, 340, 455, 360);
      path.lineTo(585, 880);
      path.quadraticCurveTo(360, 915, 135, 880);
      path.lineTo(265, 360);
      path.quadraticCurveTo(270, 340, 258, 300);
      path.lineTo(250, 95);
      path.closePath();
      cloth(c, path, "#2f5d8c", "rgba(255,255,255,0.18)", "rgba(0,0,0,0.22)");
      c.save();
      c.clip(path);
      for (let y = 90; y < 900; y += 46) {
        for (let x = 140 + ((y / 46) % 2) * 23; x < 590; x += 46) {
          c.fillStyle = "rgba(255, 240, 220, 0.85)";
          c.beginPath();
          c.arc(x, y, 5, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.restore();
      seam(c, [[262, 345], [458, 345]], "rgba(255,255,255,0.5)");
    }),
    "jupe-plissee": draw((c) => {
      const path = shape([[250, 170], [470, 170], [585, 760], [135, 760]]);
      cloth(c, path, "#8a3b3b", "rgba(255,255,255,0.16)", "rgba(0,0,0,0.25)");
      c.save();
      c.clip(path);
      for (let index = 0; index <= 12; index++) {
        const top = 250 + (220 / 12) * index;
        const bottom = 135 + (450 / 12) * index;
        c.strokeStyle = "rgba(0,0,0,0.18)";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(top, 215);
        c.lineTo(bottom, 760);
        c.stroke();
      }
      c.restore();
      seam(c, [[250, 212], [470, 212]], "rgba(255,255,255,0.45)");
    }),
    "short-lin": draw((c) => {
      const path = shape([[215, 250], [505, 250], [560, 640], [385, 665], [360, 430], [335, 665], [160, 640]]);
      cloth(c, path, "#d8c7a4", "rgba(255,255,255,0.25)", "rgba(80,60,30,0.2)");
      seam(c, [[215, 290], [505, 290]], "rgba(90,70,40,0.45)");
      seam(c, [[360, 290], [360, 430]], "rgba(90,70,40,0.45)");
    }),
    "pantalon-chino": draw((c) => {
      const path = shape([[230, 40], [490, 40], [530, 925], [390, 935], [360, 300], [330, 935], [190, 925]]);
      cloth(c, path, "#3d4a3a", "rgba(255,255,255,0.14)", "rgba(0,0,0,0.25)");
      seam(c, [[230, 82], [490, 82]], "rgba(255,255,255,0.35)");
      seam(c, [[360, 82], [360, 300]], "rgba(255,255,255,0.35)");
      seam(c, [[262, 120], [245, 920]], "rgba(0,0,0,0.25)");
      seam(c, [[458, 120], [475, 920]], "rgba(0,0,0,0.25)");
    }),
    "manteau-camel": draw((c) => {
      const path = shape([
        [280, 60], [440, 60], [560, 110], [650, 640], [585, 655], [520, 300], [528, 880], [192, 880], [200, 300], [135, 655], [70, 640], [160, 110],
      ]);
      cloth(c, path, "#b8875a", "rgba(255,255,255,0.18)", "rgba(60,30,10,0.25)");
      c.fillStyle = "rgba(80,50,25,0.5)";
      c.fill(shape([[280, 60], [360, 330], [440, 60], [405, 60], [360, 230], [315, 60]]));
      seam(c, [[360, 330], [360, 880]], "rgba(60,35,15,0.6)");
      for (const y of [400, 520, 640]) {
        c.fillStyle = "#4a3020";
        c.beginPath();
        c.arc(385, y, 9, 0, Math.PI * 2);
        c.fill();
      }
    }),
  };
});
for (const [name, data] of Object.entries(images)) {
  writeFileSync(new URL(`./${name}.jpg`, import.meta.url), Buffer.from(data, "base64"));
}
await browser.close();
console.log(Object.keys(images).join(", "));
