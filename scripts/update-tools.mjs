import { readFile, writeFile } from "node:fs/promises";

const toolsPath = new URL("../data/tools.json", import.meta.url);
const headers = {
  "Accept": "application/vnd.github+json",
  "User-Agent": "cybersec-field-notes-tool-updater"
};

function cleanVersion(tag, prefix) {
  if (!tag) return "";
  if (prefix && tag.startsWith(prefix)) return tag.slice(prefix.length);
  if (tag.startsWith("v")) return tag.slice(1);
  return tag;
}

async function latestGithubRelease(repo) {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub release lookup failed for ${repo}: ${response.status}`);
  }
  return response.json();
}

const payload = JSON.parse(await readFile(toolsPath, "utf8"));

for (const tool of payload.tools) {
  if (tool.source?.type !== "github" || !tool.source.repo) continue;

  try {
    const release = await latestGithubRelease(tool.source.repo);
    tool.version = cleanVersion(release.tag_name, tool.source.stripPrefix);
    tool.publishedAt = release.published_at;
    tool.source.releaseUrl = release.html_url;
  } catch (error) {
    tool.updateError = error.message;
  }
}

payload.checkedAt = new Date().toISOString();
await writeFile(toolsPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Updated ${payload.tools.length} tool records in data/tools.json`);
