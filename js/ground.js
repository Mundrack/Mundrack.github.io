// One source of truth for visible paving and character contact heights.
export function terrainHeight(x, z) {
  const smooth = (v, a, b) => { const t = Math.max(0, Math.min(1, (v-a)/(b-a))); return t*t*(3-2*t); };
  const edge = smooth(Math.abs(x), 12, 30), distant = smooth(Math.abs(z), 22, 60);
  return -.08 + Math.max(edge, distant) * (1.7 + Math.sin(x*.17)*Math.cos(z*.12)*1.4);
}
export const paving = [];
for (let row=0; row<30; row++) for (let col=0; col<6; col++) {
  if ((row*13+col*7)%11<3) continue;
  paving.push({ x:(col-2.5)*1.15+(row%2)*.22, z:13-row*1.55,
    angle:Math.sin(row*9+col*3)*.025 });
}
export function groundHeight(x, z) {
  const soil = terrainHeight(x,z);
  if (Math.abs(x)>4 || z>14 || z< -33) return soil;
  for (const tile of paving) {
    if (Math.abs(z-tile.z)>.72 || Math.abs(x-tile.x)>.58) continue;
    const dx=x-tile.x, dz=z-tile.z, c=Math.cos(tile.angle), s=Math.sin(tile.angle);
    if (Math.abs(c*dx-s*dz)<=.525 && Math.abs(s*dx+c*dz)<=.675) return Math.max(0,soil);
  }
  return soil;
}
