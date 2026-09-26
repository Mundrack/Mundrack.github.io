export const OWNER = "Mundrack";
const CACHE_KEY = "mundrack-repositories-v2";
const TTL = 15 * 60 * 1000;

export function normalizeRepos(input) {
  if (!Array.isArray(input)) throw new TypeError("Invalid repository list");
  const seen = new Set();
  return input
    .filter((repo) => {
      if (
        !repo ||
        typeof repo.name !== "string" ||
        !/^[\w.-]+$/.test(repo.name)
      )
        return false;
      if (
        repo.private ||
        repo.fork ||
        ["mundrack", "mundrack.github.io"].includes(repo.name.toLowerCase()) ||
        seen.has(repo.name)
      )
        return false;
      seen.add(repo.name);
      return true;
    })
    .map((repo) => ({
      name: repo.name,
      description:
        typeof repo.description === "string" && repo.description.trim()
          ? repo.description.slice(0, 600)
          : "Una historia del archivo de Mundrack. Explora el código y su evolución en GitHub.",
      url: `https://github.com/${OWNER}/${encodeURIComponent(repo.name)}`,
      language:
        typeof repo.language === "string"
          ? repo.language
          : "Sin lenguaje indicado",
      stars: Number.isFinite(repo.stargazers_count)
        ? Math.max(0, repo.stargazers_count)
        : 0,
      archived: repo.archived === true,
      updated: typeof repo.pushed_at === "string" ? repo.pushed_at : "",
    }))
    .sort(
      (a, b) =>
        (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0) ||
        a.name.localeCompare(b.name),
    );
}

export function filterRepos(repos, filter, query) {
  const needle = query.trim().toLocaleLowerCase("es");
  return repos.filter(
    (repo) =>
      (filter === "all" ||
        (filter === "archived" ? repo.archived : !repo.archived)) &&
      `${repo.name} ${repo.description} ${repo.language}`
        .toLocaleLowerCase("es")
        .includes(needle),
  );
}

export async function fetchPublicRepos(fetcher = fetch) {
  const repos = [];
  for (let page = 1; page <= 20; page++) {
    const response = await fetcher(
      `https://api.github.com/users/${OWNER}/repos?per_page=100&sort=updated&type=owner&page=${page}`,
      {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("Invalid GitHub response");
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
  throw new Error("Repository pagination limit exceeded");
}

export async function loadRepos() {
  let cached;
  try {
    cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!Array.isArray(cached?.repos)) cached = null;
  } catch {
    cached = null;
  }
  if (
    cached &&
    Date.now() - cached.savedAt < TTL &&
    Date.now() >= cached.savedAt
  )
    return {
      repos: normalizeRepos(cached.repos),
      source: "cache",
      date: cached.savedAt,
    };
  try {
    const repos = await fetchPublicRepos();
    const savedAt = Date.now();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt, repos }));
    } catch {
      /* Storage is optional. */
    }
    return { repos: normalizeRepos(repos), source: "live", date: savedAt };
  } catch {
    if (cached)
      return {
        repos: normalizeRepos(cached.repos),
        source: "offline-cache",
        date: cached.savedAt,
      };
    const response = await fetch("data/repos.json", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Snapshot unavailable");
    const snapshot = await response.json();
    return {
      repos: normalizeRepos(snapshot.repos),
      source: "snapshot",
      date: snapshot.fetchedAt,
    };
  }
}
