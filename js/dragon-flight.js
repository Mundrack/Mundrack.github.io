export const WING_PERIOD = 2;
export function dragonFlight(time) {
  const elapsed = Math.max(0, time - 43);
  const progress = Math.min(1, elapsed / 7);
  const phase = elapsed / WING_PERIOD * Math.PI * 2;
  const dz = 10 + 1.4 * Math.PI * Math.cos(progress * Math.PI);
  return {
    x: -10 + progress * 18,
    y: 12 + .18 * Math.sin(phase - .6),
    z: -8 + progress * 10 + 1.4 * Math.sin(progress * Math.PI),
    yaw: Math.atan2(-18, -dz),
    pitch: .022 * Math.sin(phase - .35),
    roll: .028 * Math.sin(progress * Math.PI),
  };
}
