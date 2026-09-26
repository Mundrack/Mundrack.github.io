import { Combat, chapter, DURATION } from "./combat.js";

// Orchestrates the real-time battle without tying repository data to WebGL support.
export class RealmScene {
  constructor(root, { onReveal = () => {}, worldFactory = null } = {}) {
    this.root = root;
    this.onReveal = onReveal;
    this.worldFactory = worldFactory;
    this.world = null;
    this.repos = [];
    this.running = false;
    this.paused = false;
    this.reduced = false;
    this.visible = true;
    this.loading = false;
    this.sound = false;
    this.audio = null;
    this.frameId = 0;
    this.last = 0;
    this.accumulator = 0;
    this.labels = new Map();
    this.shown = new Set();
    this.keyBlocking = false;
    this.buttonBlocking = false;
    this.canvas = root.querySelector("#battle-canvas");
    this.caption = root.querySelector("#battle-caption");
    this.finale = root.querySelector("#finale");
    this.progress = root.querySelector("#timeline-progress");
    this.labelLayer = root.querySelector("#fallen-labels");
    this.controls = root.querySelector("#battle-hud");
    this.manualButton = root.querySelector("#take-control");
    this.simulation = this.newCombat();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(root);
    this.visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting;
        this.syncVisibility();
      },
      { threshold: 0.02 },
    );
    this.visibilityObserver.observe(root);
    document.addEventListener("visibilitychange", () => this.syncVisibility());
    root
      .querySelector("#pause")
      .addEventListener("click", () => this.setPaused(!this.paused));
    root.querySelector("#replay").addEventListener("click", () => this.start());
    root
      .querySelectorAll("[data-camera]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          this.setCamera(button.dataset.camera),
        ),
      );
    this.manualButton.addEventListener("click", () =>
      this.setManual(!this.simulation.manual),
    );
    root
      .querySelector("#attack")
      .addEventListener("click", () => this.attack());
    root.querySelector("#block").addEventListener("click", () => {
      this.buttonBlocking = !this.buttonBlocking;
      this.updateBlock();
    });
    root.addEventListener("keydown", (e) => {
      if (
        !this.running ||
        this.paused ||
        !this.simulation.manual ||
        e.target.matches("input,textarea,a") ||
        e.target.closest(".scene-controls")
      )
        return;
      if (e.code === "KeyF" && !e.repeat) {
        e.preventDefault();
        this.attack();
      }
      if (e.code === "KeyG") {
        e.preventDefault();
        this.keyBlocking = true;
        this.updateBlock();
      }
    });
    root.addEventListener("keyup", (e) => {
      if (e.code === "KeyG") {
        this.keyBlocking = false;
        this.updateBlock();
      }
    });
    root.addEventListener("focusout", () => {
      this.keyBlocking = false;
      this.updateBlock();
    });
  }
  newCombat() {
    return new Combat(this.repos, {
      onHit: (e) => {
        this.world?.hit(e);
        if (e.blocked) this.tone(340, 0.08);
        else this.tone(85, 0.12);
      },
      onDeath: (u) => {
        this.world?.fall(u);
        if (u.repo && !this.shown.has(u.repo.name)) {
          this.shown.add(u.repo.name);
          this.addLabel(u);
          this.onReveal(u.repo);
        }
      },
    });
  }
  setRepos(repos) {
    this.repos = repos.slice(0, 8);
  }
  get elapsed() {
    return this.simulation.time;
  }
  async ensureWorld() {
    if (this.world) return true;
    try {
      if (this.worldFactory) this.world = await this.worldFactory(this.canvas);
      else {
        if (!this.canvas.getContext("webgl2"))
          throw new Error("WebGL2 unavailable");
        const { BattleWorld } = await import("./battle-world.js");
        const { loadCharacters } = await import("./characters.js");
        this.root.querySelector("#battle-feedback").textContent = "Preparando armaduras y animaciones…";
        const characters = await loadCharacters();
        this.world = new BattleWorld(this.canvas, {
          characters,
          onContextLost: () =>
            this.fail(
              "Se interrumpió la escena 3D. Recarga la página o explora los proyectos.",
            ),
        });
      }
      this.resize();
      return true;
    } catch {
      this.fail(
        "No se pudo preparar la batalla. Comprueba la conexión y WebGL 2, o explora los proyectos.",
      );
      return false;
    }
  }
  fail(message) {
    this.running = false;
    this.loading = false;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.root.classList.remove("battle-active");
    this.root.dataset.phase = "idle";
    this.root.querySelector(".hero-copy").inert = false;
    this.caption.textContent = "";
    this.root.querySelector("#battle-feedback").textContent = message;
    this.controls.hidden = true;
    this.root.querySelector("#pause").hidden = true;
    this.root.querySelector("#skip-scene").hidden = true;
    this.root.querySelector("#start-battle").disabled = false;
    this.root.removeAttribute("aria-busy");
  }
  async start() {
    if (this.loading) return;
    this.loading = true;
    this.root.setAttribute("aria-busy", "true");
    const start = this.root.querySelector("#start-battle");
    start.disabled = true;
    if (this.reduced || !this.repos.length) {
      this.loading = false;
      start.disabled = false;
      this.root.removeAttribute("aria-busy");
      this.finish();
      return;
    }
    this.root.querySelector("#battle-feedback").textContent =
      "Preparando el campo de batalla…";
    if (!(await this.ensureWorld())) return;
    // A preference may change while the lazy 3D module is loading.
    if (this.reduced) {
      this.loading = false;
      this.root.removeAttribute("aria-busy");
      start.disabled = false;
      this.finish();
      return;
    }
    this.loading = false;
    this.root.removeAttribute("aria-busy");
    start.disabled = false;
    this.root.querySelector("#battle-feedback").textContent = "";
    this.labels.clear();
    this.labelLayer.replaceChildren();
    this.shown.clear();
    this.simulation = this.newCombat();
    this.world.setUnits(this.simulation.units);
    this.world.cameraMode = "auto";
    this.world.lastCamera = "";
    this.accumulator = 0;
    this.running = true;
    this.paused = false;
    this.keyBlocking = false;
    this.buttonBlocking = false;
    this.finale.hidden = true;
    this.root.dataset.phase = "approach";
    this.root.classList.add("battle-active");
    this.root.classList.remove("paused");
    this.root.querySelector(".hero-copy").inert = true;
    this.controls.hidden = false;
    this.root.querySelector("#pause").hidden = false;
    this.root.querySelector("#skip-scene").hidden = false;
    this.root.querySelector("#replay").hidden = true;
    this.root.querySelector("#pause").textContent = "Pausar";
    this.root.querySelector("#pause").setAttribute("aria-pressed", "false");
    this.setCamera("auto");
    this.setManual(false);
    this.render(0);
    this.root.querySelector("#pause").focus({ preventScroll: true });
    this.wake();
  }
  wake() {
    if (
      !this.frameId &&
      this.running &&
      !this.reduced &&
      !this.paused &&
      this.visible &&
      !document.hidden
    ) {
      this.last = performance.now();
      this.frameId = requestAnimationFrame((t) => this.tick(t));
    }
  }
  tick(now) {
    this.frameId = 0;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.advance(dt);
    if (
      this.running &&
      !this.paused &&
      !this.reduced &&
      this.visible &&
      !document.hidden
    )
      this.frameId = requestAnimationFrame((t) => this.tick(t));
  }
  advance(dt) {
    if (!this.running || this.paused || this.reduced) return;
    this.accumulator += dt;
    while (this.accumulator >= 1 / 60 && this.simulation.time < DURATION) {
      this.simulation.step(1 / 60);
      this.accumulator -= 1 / 60;
    }
    this.render(dt);
    if (this.simulation.time >= DURATION) this.finish();
  }
  render(dt) {
    if (!this.world) return;
    this.world.render(this.simulation, dt);
    const shot = chapter(this.simulation.time);
    this.root.dataset.phase = shot.id;
    this.caption.textContent = shot.title;
    this.progress.style.width = `${Math.min(100, (this.simulation.time / DURATION) * 100)}%`;
    this.root.querySelector("#camera-readout").textContent =
      {
        wide: "Vista lejana",
        follow: "Tras la guardia",
        side: "En el frente",
        first: "Primera persona",
        overhead: "Vista aérea",
        dragon: "El guardián",
      }[this.world.activeCamera] || "Cámara automática";
    const lead = this.simulation.player,
      duel =
        this.simulation.time >= 13 &&
        this.simulation.time < 43 &&
        lead.deadAt === null;
    this.manualButton.disabled = !duel;
    this.root.querySelector("#duel-controls").hidden = !(
      duel && this.simulation.manual
    );
    this.root.querySelector("#player-health").value = lead.hp;
    this.root.querySelector("#player-health").max = lead.maxHp;
    this.root.querySelector("#health-text").textContent =
      `Guardia ${lead.hp}/${lead.maxHp}`;
    if (!duel && this.simulation.manual) this.setManual(false);
    this.updateLabels();
  }
  setCamera(mode) {
    if (this.world) this.world.cameraMode = mode;
    this.root
      .querySelectorAll("[data-camera]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.camera === mode)),
      );
    if (this.paused || !this.running) {
      this.world?.render(this.simulation, 0);
      this.updateLabels();
    }
  }
  setManual(value) {
    if (
      value &&
      (this.simulation.time < 13 ||
        this.simulation.time >= 43 ||
        this.simulation.player.deadAt !== null)
    )
      return;
    this.simulation.setManual(value);
    this.manualButton.textContent = value
      ? "Volver a la cinemática"
      : "Tomar la espada";
    this.manualButton.setAttribute("aria-pressed", String(value));
    this.keyBlocking = false;
    this.buttonBlocking = false;
    this.updateBlock();
    if (value) {
      this.setCamera("first");
      this.root.querySelector("#duel-controls").hidden = false;
      this.root.querySelector("#attack").focus({ preventScroll: true });
    } else {
      this.root.querySelector("#duel-controls").hidden = true;
      if (this.world?.cameraMode === "first") this.setCamera("auto");
    }
  }
  attack() {
    if (this.running && !this.paused) return this.simulation.attack();
    return false;
  }
  updateBlock() {
    this.simulation.blocking = this.keyBlocking || this.buttonBlocking;
    this.root
      .querySelector("#block")
      .setAttribute("aria-pressed", String(this.simulation.blocking));
  }
  setPaused(value) {
    this.paused = value;
    this.root.querySelector("#pause").textContent = value
      ? "Continuar"
      : "Pausar";
    this.root
      .querySelector("#pause")
      .setAttribute("aria-pressed", String(value));
    this.syncVisibility();
  }
  syncVisibility() {
    const suspended = this.paused || document.hidden || !this.visible;
    this.root.classList.toggle("paused", suspended);
    if (suspended) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.keyBlocking = false;
      this.buttonBlocking = false;
      this.updateBlock();
      this.audio?.suspend();
    } else {
      if (this.sound) this.audio?.resume();
      this.wake();
    }
  }
  setReduced(value) {
    this.reduced = value;
    document.documentElement.classList.toggle("reduced-motion", value);
    if (value) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      if (this.running) this.finish();
    } else this.wake();
  }
  stop() {
    this.finish(false);
  }
  finish(focus = true) {
    this.running = false;
    this.paused = false;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.root.classList.remove("paused");
    this.root.dataset.phase = "finale";
    this.caption.textContent = "";
    this.finale.hidden = false;
    this.progress.style.width = "100%";
    this.root.querySelector(".hero-copy").inert = true;
    this.root.querySelector("#pause").hidden = true;
    this.root.querySelector("#skip-scene").hidden = true;
    this.root.querySelector("#replay").hidden = false;
    this.setManual(false);
    this.manualButton.disabled = true;
    if (this.world) {
      this.world.cameraMode = "overhead";
      this.world.render(this.simulation, 0);
      this.updateLabels();
    } else this.controls.hidden = true;
    if (focus) this.finale.querySelector("a").focus({ preventScroll: true });
  }
  addLabel(unit) {
    const a = document.createElement("a");
    a.className = "fallen-label";
    a.href = unit.repo.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = unit.repo.name;
    a.setAttribute(
      "aria-label",
      `Proyecto del soldado caído: ${unit.repo.name}`,
    );
    const name = document.createElement("strong");
    name.textContent = unit.repo.name.replaceAll("_", " ");
    const detail = document.createElement("small");
    detail.textContent = `${unit.repo.language} · ver código ↗`;
    a.append(name, detail);
    this.labelLayer.append(a);
    this.labels.set(unit.id, { element: a, unit });
  }
  updateLabels() {
    if (!this.world) return;
    const occupied = [];
    for (const { element, unit } of this.labels.values()) {
      const p = this.world.project(unit);
      let y = p.y - 48;
      const width = this.world.width < 650 ? 142 : 174;
      let x = Math.max(
        8,
        Math.min(this.world.width - width - 8, p.x - width / 2),
      );
      const collision = occupied.some(
        (r) => Math.abs(r.x - x) < width + 6 && Math.abs(r.y - y) < 54,
      );
      const hidden =
        !p.visible || collision || y < 125 || y > this.world.height - 140;
      element.hidden = hidden;
      if (!hidden) {
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        occupied.push({ x, y });
      }
    }
  }
  resize() {
    if (this.world) {
      const r = this.root.getBoundingClientRect();
      this.world.resize(r.width, r.height);
      if (!this.running || this.paused) {
        this.world.render(this.simulation, 0);
        this.updateLabels();
      }
    }
  }
  async toggleSound() {
    if (!this.audio) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return false;
      this.audio = new A();
    }
    this.sound = !this.sound;
    if (this.sound) {
      await this.audio.resume();
      this.tone(110, 0.4);
    } else await this.audio.suspend();
    return this.sound;
  }
  tone(freq, duration) {
    if (!this.sound || !this.audio || this.audio.state !== "running") return;
    const oscillator = this.audio.createOscillator(),
      gain = this.audio.createGain(),
      t = this.audio.currentTime;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(freq, t);
    oscillator.frequency.exponentialRampToValueAtTime(freq * 0.5, t + duration);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(gain).connect(this.audio.destination);
    oscillator.start();
    oscillator.stop(t + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}
