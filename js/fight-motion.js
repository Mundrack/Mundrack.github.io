// Shared contact time keeps damage and the authored strike on the same beat.
export const CONTACT = .47;
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const keys = [[0, 0], [.32, .24], [CONTACT, CONTACT], [.61, .76], [1, 1]];
const slopes = keys.map((key, i) => {
  if (i === 0 || i === keys.length - 1) return 0;
  const before = keys[i - 1], after = keys[i + 1];
  return (after[1] - before[1]) / (after[0] - before[0]);
});

export function strikeTime(progress) {
  // Hold the preparation, accelerate through contact, then recover slowly.
  const p = clamp(progress);
  for (let i = 1; i < keys.length; i++) {
    const [a, x] = keys[i - 1], [b, y] = keys[i];
    if (p <= b) {
      // Hermite segments share tangents: velocity stays continuous at the beats.
      const t = (p - a) / (b - a), t2 = t * t, t3 = t2 * t;
      return (2*t3-3*t2+1)*x + (t3-2*t2+t)*(b-a)*slopes[i-1]
        + (-2*t3+3*t2)*y + (t3-t2)*(b-a)*slopes[i];
    }
  }
  return 1;
}

export function strikeLunge(progress) {
  if (progress < 0) return 0;
  return progress < CONTACT ? ease(progress / CONTACT) : 1 - ease((progress - CONTACT) / (1 - CONTACT));
}

export function reactionWeight(age, blocked = false) {
  const duration = blocked ? .22 : .38;
  if (age < 0 || age >= duration) return 0;
  return age < .045 ? ease(age / .045) : 1 - ease((age - .045) / (duration - .045));
}
