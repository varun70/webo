# CyberSec Field Notes

A GitHub Pages-ready cybersecurity blog with:

- Editable blog posts in `data/posts.json`
- Editable web testing playbooks in `data/playbooks.json`
- A saved-progress checklist for authorized vulnerability assessments
- A Markdown runbook generator for assessment planning
- An interactive Linux command terminal section
- A searchable security tools tracker in `data/tools.json`
- A Node updater for GitHub release versions
- GitHub Actions workflows for Pages deploys and weekly tool refreshes

## Run Locally

Use a small static server so the JSON files load correctly:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Add a Blog Post

Edit `data/posts.json` and add another object:

```json
{
  "id": "my-new-post",
  "title": "My New Post",
  "category": "Detection",
  "date": "2026-05-09",
  "readTime": "5 min",
  "excerpt": "Short summary for the post card.",
  "body": ["Paragraph one.", "Paragraph two."],
  "commands": ["sudo journalctl -p warning --since today"]
}
```

## Edit the Playbook

Edit `data/playbooks.json` to add phases, checklist tasks, evidence items, commands, references, or vulnerability matrix cards. The checklist progress is saved in the browser with `localStorage`, so the site still works as a static GitHub Pages project.

## Update Tool Versions

Run:

```bash
node scripts/update-tools.mjs
```

The script updates tools whose `source.type` is `github` by reading the latest release for the configured repository. The included `update-tool-versions.yml` workflow can run this weekly on GitHub.

## Host on GitHub Pages

1. Push these files to a GitHub repository.
2. In the repository, go to **Settings > Pages**.
3. Choose **GitHub Actions** as the Pages source.
4. Push to `main` or run the `Deploy static site to GitHub Pages` workflow manually.

The `.nojekyll` file is included because this is a plain static site.

## Version Data Sources

Tool versions are refreshed from official GitHub release data when `scripts/update-tools.mjs` runs. The web testing playbook references OWASP WSTG, OWASP ASVS, and the current OWASP Top 10 project pages.
