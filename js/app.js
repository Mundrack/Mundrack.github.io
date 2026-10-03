import { loadRepos, filterRepos } from "./data.js";
import { RealmScene } from "./scene.js";
const $ = (selector) => document.querySelector(selector);
const create = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};
let repos = [],
  filter = "all",
  query = "";
const revealed = new Set();
const scene = new RealmScene($("#realm"), {
  onReveal: (repo) => {
    revealed.add(repo.name);
    renderProjects();
  },
});
const preference = matchMedia("(prefers-reduced-motion: reduce)");
function setMotion(reduced) {
  scene.setReduced(reduced);
  $("#motion").setAttribute("aria-pressed", String(reduced));
  $("#motion").textContent = reduced
    ? "Movimiento: reducido"
    : "Reducir movimiento";
}
setMotion(preference.matches);
preference.addEventListener("change", (e) => setMotion(e.matches));
$("#motion").addEventListener("click", () => setMotion(!scene.reduced));
$("#sound").addEventListener("click", async () => {
  try {
    const enabled = await scene.toggleSound();
    $("#sound").setAttribute("aria-pressed", String(enabled));
    $("#sound").textContent = enabled ? "Sonido: activado" : "Sonido: apagado";
  } catch {
    $("#sound").textContent = "Sonido no disponible";
  }
});
$("#start-battle").addEventListener("click", () => scene.start());
$("#skip-scene").addEventListener("click", () => {
  scene.stop();
  $("#projects").scrollIntoView({
    behavior: scene.reduced ? "instant" : "smooth",
  });
  $("#search").focus({ preventScroll: true });
});
document.querySelectorAll('a[href="#projects"]').forEach((a) =>
  a.addEventListener("click", () => {
    if (scene.running) scene.stop();
  }),
);
document.querySelectorAll("[data-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    document
      .querySelectorAll("[data-filter]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    renderProjects();
  }),
);
$("#search").addEventListener("input", (e) => {
  query = e.target.value;
  renderProjects();
});
$("#year").textContent = new Date().getFullYear();

function renderProjects() {
  const matches = filterRepos(repos, filter, query),
    fragment = document.createDocumentFragment();
  matches.forEach((repo, index) => {
    const article = create(
      "article",
      `project-card${revealed.has(repo.name) ? " revealed" : ""}`,
    );
    article.dataset.repo = repo.name;
    const art = create("div", "card-art");
    const image = create("img");
    image.src = `assets/${index % 3 === 2 ? "dragon" : "knight"}.webp`;
    image.alt = "";
    image.loading = "lazy";
    art.append(
      image,
      create("span", "card-number", String(index + 1).padStart(2, "0")),
      create(
        "span",
        "card-badge",
        repo.archived
          ? "RELIQUIA"
          : revealed.has(repo.name)
            ? "REVELADO"
            : "EN CAMPAÑA",
      ),
    );
    const body = create("div", "card-body"),
      title = create("h3", "", repo.name.replaceAll("_", " ")),
      description = create("p", "", repo.description),
      meta = create("div", "card-meta"),
      language = create("span", "", repo.language);
    language.prepend(create("i", "language-dot"));
    const link = create("a", "", "Explorar ↗");
    link.href = repo.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Ver ${repo.name} en GitHub`);
    meta.append(language, create("span", "stars", `☆ ${repo.stars}`), link);
    body.append(title, description, meta);
    article.append(art, body);
    fragment.append(article);
  });
  $("#project-grid").replaceChildren(fragment);
  $("#empty-projects").hidden = matches.length > 0;
}
function renderLanguages() {
  const counts = new Map();
  repos
    .filter((r) => r.language !== "Sin lenguaje indicado")
    .forEach((r) => counts.set(r.language, (counts.get(r.language) || 0) + 1));
  const list = [...counts].sort((a, b) => b[1] - a[1]);
  $("#languages").replaceChildren(
    ...list.map(([language, count]) => {
      const span = create("span", "", language);
      span.append(
        create(
          "small",
          "",
          `${count} ${count === 1 ? "proyecto" : "proyectos"}`,
        ),
      );
      return span;
    }),
  );
  if (!list.length)
    $("#languages").textContent = "Todavía no hay lenguajes indicados.";
}
const start = $("#start-battle");
start.disabled = true;
try {
  const result = await loadRepos();
  repos = result.repos;
  scene.setRepos(repos);
  renderProjects();
  renderLanguages();
  $("#repo-count").textContent = String(repos.length);
  const date = new Date(result.date).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const labels = {
    live: "Sincronizado con GitHub",
    cache: "Datos recientes de GitHub",
    "offline-cache": "Sin conexión con GitHub · última copia disponible",
    snapshot: "GitHub no disponible · copia local",
  };
  $("#data-status").textContent =
    `${labels[result.source]} · ${date} · ${repos.length} proyectos originales`;
  start.disabled = false;
} catch {
  $("#data-status").textContent =
    "No pudimos cargar los proyectos. Puedes verlos directamente en GitHub.";
  $("#languages").textContent = "Consulta mis lenguajes en GitHub.";
  start.disabled = false;
}
const sectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting)
        document
          .querySelectorAll(".site-header nav a")
          .forEach((a) =>
            a.classList.toggle("nav-active", a.hash === `#${entry.target.id}`),
          );
    }
  },
  { rootMargin: "-15% 0px -55% 0px" },
);
document
  .querySelectorAll("main>section")
  .forEach((s) => sectionObserver.observe(s));
