import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRepos, filterRepos, fetchPublicRepos, loadRepos } from "../js/data.js";

test("fresh cache avoids GitHub requests and expired cache survives a rate limit", async () => {
  let savedAt = Date.now();
  globalThis.localStorage = { getItem: () => JSON.stringify({ savedAt, repos: [{ name: "Cached" }] }) };
  globalThis.fetch = async () => { throw new Error("Network unavailable"); };
  assert.equal((await loadRepos()).source, "cache");
  savedAt = Date.now() - 3600000;
  const result = await loadRepos();
  assert.equal(result.source, "offline-cache");
  assert.equal(result.repos[0].name, "Cached");
});

test("blocked storage and GitHub use local snapshot, total failure stays explicit", async () => {
  globalThis.localStorage = { getItem: () => { throw new Error("Storage denied"); } };
  globalThis.fetch = async url => String(url).startsWith("https:") ? { ok: false, status: 403 } : { ok: true, json: async () => ({ fetchedAt: "2026-09-25", repos: [{ name: "Backup" }] }) };
  assert.equal((await loadRepos()).source, "snapshot");
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(loadRepos(), /Snapshot unavailable/);
});

test("normalizes real repository URLs and excludes profile, portfolio, forks and private data", () => {
  const result = normalizeRepos([
    { name: "Mundrack" },
    { name: "Mundrack.github.io" },
    { name: "forked", fork: true },
    { name: "secret", private: true },
    {
      name: "Good_repo",
      html_url: "javascript:alert(1)",
      description: "<img onerror=evil()>",
      stargazers_count: 3,
      pushed_at: "2026-09-20",
    },
    { name: "Good_repo" },
    { name: "../unsafe" },
    { name: "Old", archived: true, pushed_at: "2020-01-01" },
    null,
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].url, "https://github.com/Mundrack/Good_repo");
  assert.equal(result[0].description, "<img onerror=evil()>");
  assert.equal(result[1].archived, true);
});
test("search and archive filters preserve all matching projects", () => {
  const repos = normalizeRepos([
    { name: "Project_API", language: "JavaScript" },
    { name: "Ancient", archived: true },
    { name: "New" },
  ]);
  assert.equal(filterRepos(repos, "all", " JAVASCRIPT ").length, 1);
  assert.equal(filterRepos(repos, "archived", "").length, 1);
  assert.equal(filterRepos(repos, "active", "").length, 2);
  assert.equal(filterRepos(repos, "all", "missing").length, 0);
});
test("GitHub pagination loads the page after 100 items", async () => {
  const requests = [];
  const repos = await fetchPublicRepos(async (url) => {
    requests.push(url);
    return {
      ok: true,
      json: async () =>
        url.endsWith("page=1")
          ? Array.from({ length: 100 }, (_, i) => ({ name: `repo${i}` }))
          : [{ name: "last" }],
    };
  });
  assert.equal(requests.length, 2);
  assert.equal(repos.length, 101);
  assert.equal(repos.at(-1).name, "last");
});
test("rate limits and malformed data fail instead of appearing as an empty successful sync", async () => {
  await assert.rejects(
    fetchPublicRepos(async () => ({ ok: false, status: 403 })),
    /403/,
  );
  await assert.rejects(
    fetchPublicRepos(async () => ({
      ok: true,
      json: async () => ({ message: "bad" }),
    })),
    /Invalid/,
  );
});
test("snapshot remains compatible with the live adapter", async () => {
  const { readFile } = await import("node:fs/promises");
  const snapshot = JSON.parse(
    (
      await readFile(new URL("../data/repos.json", import.meta.url), "utf8")
    ).replace(/^\uFEFF/, ""),
  );
  const repos = normalizeRepos(snapshot.repos);
  assert.ok(repos.length > 0);
  assert.ok(
    repos.every((r) => r.url.startsWith("https://github.com/Mundrack/")),
  );
});
