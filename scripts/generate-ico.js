const fs = require("fs");
const path = require("path");
const toIco = require("to-ico");
const sharp = require("sharp");

const inputPng = path.resolve(__dirname, "../src/favicon_io/android-chrome-512x512.png");
const outputIco = path.resolve(__dirname, "../src/favicon_io/favicon.ico");

async function run() {
  const sourceBuffer = fs.readFileSync(inputPng);
  const pngBuffer = await sharp(sourceBuffer)
    .resize(256, 256)
    .png()
    .toBuffer();
  const icoBuffer = await toIco([pngBuffer], { sizes: [256] });
  fs.writeFileSync(outputIco, icoBuffer);
  console.log("Generated:", outputIco);
}

run().catch((error) => {
  console.error("Failed to generate ICO:", error);
  process.exit(1);
});
