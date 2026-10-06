import { CONTACT } from './fight-motion.js';
export const DURATION = 50;
export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const smooth = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};

export function chapter(t) {
  if (t < 6)
    return { id: "approach", title: "I · El campo de batalla", camera: "wide" };
  if (t < 13)
    return {
      id: "charge",
      title: "II · Tras la última guardia",
      camera: "follow",
    };
  if (t < 22)
    return { id: "clash", title: "III · Acero contra sombras", camera: "side" };
  if (t < 32)
    return { id: "duel", title: "IV · A través del yelmo", camera: "first" };
  if (t < 43)
    return {
      id: "overhead",
      title: "V · Historias entre las cenizas",
      camera: "overhead",
    };
  if (t < DURATION)
    return {
      id: "dragon",
      title: "VI · El guardián del reino",
      camera: "dragon",
    };
  return { id: "finale", title: "El código permanece", camera: "overhead" };
}

export class Combat {
  constructor(repos = [], { onHit = () => {}, onDeath = () => {} } = {}) {
    this.repos = repos;
    this.onHit = onHit;
    this.onDeath = onDeath;
    this.reset();
  }
  reset() {
    this.time = 0;
    this.events = 0;
    this.manual = false;
    this.blocking = false;
    this.fireApplied = false;
    this.units = [];
    for (let pair = 0; pair < 8; pair++)
      for (const team of ["knight", "zombie"]) {
        const lead = pair === 0,
          x = lead ? 0 : ((pair % 4) - 1.5) * 3.2 + (pair > 3 ? 1.2 : 0);
        const hp =
          (team === "knight"
            ? lead
              ? 210
              : pair % 2
                ? 65
                : 95
            : lead
              ? 230
              : pair % 2
                ? 120
                : 65) + (pair > 3 ? 40 : 0);
        this.units.push({
          id: `${team}-${pair}`,
          team,
          pair,
          x,
          z:
            team === "knight"
              ? 15 + Math.floor(pair / 4) * 3
              : -13 - Math.floor(pair / 4) * 3,
          hp,
          maxHp: hp,
          yaw: team === "knight" ? 0 : Math.PI,
          attack: -1,
          hit: false,
          targetId: null,
          hitAt: -Infinity,
          blockedHit: false,
          hitDirection: { x: 0, z: 1 },
          cooldown: pair * 0.21 + (team === "zombie" ? 0.8 : 0),
          deadAt: null,
          recoil: 0,
          guard: false,
          speed: 0,
          kills: 0,
          repo:
            team === "knight"
              ? this.repos[pair % Math.max(this.repos.length, 1)]
              : null,
        });
      }
  }
  get player() {
    return this.units[0];
  }
  attack() {
    const u = this.player;
    if (
      this.manual &&
      !this.blocking &&
      this.time >= 13 &&
      u.deadAt === null &&
      u.attack < 0 &&
      u.cooldown <= 0
    ) {
      u.attack = 0;
      u.hit = false;
      u.targetId = null;
      return true;
    }
    return false;
  }
  setManual(value) {
    this.manual = value;
    this.blocking = false;
  }
  step(dt) {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    for (const u of this.units) {
      if (u.deadAt !== null) continue;
      const wasMoving = u.moving;
      const delay = u.pair < 4 ? 0 : u.pair < 6 ? 8 : 13;
      const advance = smooth((this.time - 6 - delay) / 7);
      const end =
        (u.team === "knight" ? .8 : -.8) + (u.pair > 3 ? -4.5 : 0);
      const start =
        u.team === "knight"
          ? 15 + Math.floor(u.pair / 4) * 3
          : -13 - Math.floor(u.pair / 4) * 3;
      if (this.time <= 13 + delay) {
        u.z = start + (end - start) * advance;
        const progress = clamp((this.time - 6 - delay) / 7);
        u.speed = Math.abs(end - start) / 7 * 6 * progress * (1 - progress);
      }
      u.moving = this.time >= 6 + delay && this.time < 13 + delay;
      u.recoil = Math.max(0, u.recoil - dt * 3);
      u.cooldown -= dt;
      if (this.time < 13 + delay) continue;
      const enemies = this.units.filter(
        (other) =>
          other.team !== u.team &&
          other.deadAt === null &&
          this.time >= 13 + (other.pair < 4 ? 0 : other.pair < 6 ? 8 : 13) &&
          !(other.pair === 0 && u.pair !== 0 && this.time < 32),
      );
      const opponent = (u.attack >= 0 && u.targetId
        ? enemies.find(other => other.id === u.targetId)
        : enemies.find((other) => other.pair === u.pair) ||
        enemies.sort(
          (a, b) =>
            Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z),
        )[0]);
      // Defend against a visible wind-up, not an unrelated global timer.
      u.guard = u.team === 'knight' && u.attack < 0 && !u.moving &&
        (u === this.player && this.manual ? this.blocking :
          opponent?.attack >= .08 && opponent.attack < .65 &&
          Math.hypot(opponent.x - u.x, opponent.z - u.z) < 2.5 &&
          (u.pair + Math.floor(this.time / 2)) % 3 === 0);
      if (!opponent) {
        u.attack = -1;
        u.guard = false;
        u.speed = 0;
        continue;
      }
      const dx = opponent.x - u.x,
        dz = opponent.z - u.z,
        distance = Math.hypot(dx, dz);
      const desiredYaw = Math.atan2(-dx, -dz);
      const turn = Math.atan2(Math.sin(desiredYaw - u.yaw), Math.cos(desiredYaw - u.yaw));
      u.yaw += turn * (1 - Math.exp(-dt * 9));
      // Commit to the swing before chasing again, and use a small dead band
      // around melee range to avoid flickering between walk and attack.
      const chasing = u.attack < 0 && distance > (wasMoving ? 1.65 : 1.85);
      const desiredSpeed = chasing ? Math.min(1.4, Math.sqrt(8 * Math.max(0, distance - 1.55))) : 0;
      u.speed += clamp(desiredSpeed - u.speed, -4 * dt, 2.5 * dt);
      if (u.attack >= 0) u.speed = 0;
      const step = Math.min(u.speed * dt, Math.max(0, distance - 1.55));
      u.moving = step > .00001;
      if (u.moving) {
        u.x += (dx / distance) * step;
        u.z += (dz / distance) * step;
        continue;
      }
      if (
        u.attack < 0 &&
        u.cooldown <= 0 &&
        !u.guard &&
        this.time - u.hitAt > (u.blockedHit ? .12 : .28) &&
        !(u === this.player && this.manual)
      ) {
        u.attack = 0;
        u.hit = false;
        u.targetId = opponent.id;
      }
      if (u.attack >= 0) {
        u.targetId ??= opponent.id;
        u.attack += dt;
        if (u.attack >= CONTACT && !u.hit) {
          u.hit = true;
          const facing = distance > 0 ? (-Math.sin(u.yaw) * dx - Math.cos(u.yaw) * dz) / distance : 1;
          if (distance < 2.4 && facing > .65) {
            const defenseFacing = distance > 0 ? (Math.sin(opponent.yaw) * dx + Math.cos(opponent.yaw) * dz) / distance : 1;
            const blocked = opponent.team === 'knight' && opponent.guard && opponent.attack < 0 && defenseFacing > .5;
            const damage = blocked ? 3 : u.team === "knight" ? 22 : 20;
            this.damage(opponent, damage, u, blocked);
          }
        }
        if (u.attack >= 1) {
          u.attack = -1;
          u.cooldown = 0.45 + (u.pair % 3) * 0.15;
        }
      }
    }
    if (this.time >= 46 && !this.fireApplied) {
      this.fireApplied = true;
      for (const u of this.units)
        if (u.team === "zombie" && u.deadAt === null)
          this.damage(u, 500, null, false);
    }
  }
  damage(target, amount, attacker, blocked) {
    if (target.deadAt !== null) return;
    target.hp = Math.max(0, target.hp - amount);
    target.recoil = 1;
    target.hitAt = this.time;
    target.blockedHit = blocked;
    if (attacker) {
      const length = Math.hypot(target.x - attacker.x, target.z - attacker.z) || 1;
      target.hitDirection = { x: (target.x - attacker.x) / length, z: (target.z - attacker.z) / length };
    }
    this.events++;
    this.onHit({ target, attacker, blocked, time: this.time });
    if (target.hp === 0) {
      target.deadAt = this.time;
      target.attack = -1;
      target.guard = false;
      if (attacker) attacker.kills++;
      this.onDeath(target);
    }
  }
}
