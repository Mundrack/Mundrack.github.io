import { writeFile } from "node:fs/promises";
import { fetchPublicRepos } from "../js/data.js";
const source = await fetchPublicRepos();
const keys = [
  "id",
  "name",
  "description",
  "html_url",
  "language",
  "stargazers_count",
  "forks_count",
  "archived",
  "fork",
  "pushed_at",
  "topics",
];
const repos = source.map((repo) =>
  Object.fromEntries(keys.map((key) => [key, repo[key]])),
);
await writeFile(
  new URL("../data/repos.json", import.meta.url),
  JSON.stringify({ fetchedAt: new Date().toISOString(), repos }, null, 2) +
    "\n",
);
console.log(
  `Updated public snapshot: ${repos.length} repositories. No token required.`,
);
