// Genera los iconos PWA desde src/app/icon.png (256x256) hacia public/icons/.
// Uso: node scripts/gen-icons.mjs
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "src/app/icon.png");
const OUT = path.resolve(process.cwd(), "public/icons");
const BG = "#04150c"; // fondo de marca (verde oscuro) para el icono de iOS

fs.mkdirSync(OUT, { recursive: true });

const tasks = [
  { name: "icon-192.png", size: 192, flatten: false },
  { name: "icon-512.png", size: 512, flatten: false },
  // apple-touch-icon: sin transparencia, con fondo de marca
  { name: "apple-touch-icon.png", size: 180, flatten: true },
];

for (const t of tasks) {
  let img = sharp(SRC).resize(t.size, t.size, { fit: "contain", background: t.flatten ? BG : { r: 0, g: 0, b: 0, alpha: 0 } });
  if (t.flatten) img = img.flatten({ background: BG });
  await img.png().toFile(path.join(OUT, t.name));
  console.log("OK →", path.join("public/icons", t.name));
}
