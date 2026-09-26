import sharp from "sharp";
for (const name of ["realm-cinematic", "knight", "zombie", "dragon"]) {
  const source = `assets/sources/${name}.png`;
  await sharp(source)
    .webp({ quality: 85, alphaQuality: 100 })
    .toFile(`assets/${name}.webp`);
  console.log(`${name}: optimized, transparency preserved`);
}
