const state = {
  posts: [],
  tools: [],
  playbook: { references: [], phases: [], matrix: [] },
  postCategory: "All",
  toolCategory: "All",
  postSearch: "",
  toolSearch: "",
  matrixSearch: "",
  activePhase: "",
  commandIndex: 0,
  typeTimer: null
};

const fallbackPosts = [
  {
    id: "ubuntu-hardening",
    title: "Hardening a Fresh Ubuntu Server",
    category: "Hardening",
    date: "2026-05-09",
    readTime: "6 min",
    excerpt: "A compact baseline for patching, firewall rules, SSH hygiene, logs, and package inventory.",
    body: [
      "Start every server build with a repeatable baseline. Update packages, remove services you do not need, and keep a note of what changed.",
      "Use firewall defaults before opening ports. SSH should prefer keys, limited users, and clear logging so suspicious access attempts are visible early.",
      "Finish by taking a package inventory and recording the commands in the ticket or change log."
    ],
    commands: [
      "sudo apt update && sudo apt full-upgrade",
      "sudo ufw default deny incoming && sudo ufw allow OpenSSH && sudo ufw enable",
      "sudo journalctl -u ssh --since today"
    ]
  }
];

const fallbackTools = {
  checkedAt: "2026-05-09T18:11:49Z",
  tools: []
};

const fallbackPlaybook = {
  references: [],
  phases: [],
  matrix: []
};

const commandDeck = [
  {
    label: "Baseline audit",
    command: "uname -a && lsb_release -a && ss -tulpn",
    output: [
      "Linux labbox 6.8.0-generic x86_64 GNU/Linux",
      "Distributor ID: Ubuntu",
      "Description: Ubuntu 24.04 LTS",
      "Netid State  Local Address:Port  Process",
      "tcp   LISTEN 127.0.0.1:5432      postgres",
      "tcp   LISTEN 0.0.0.0:22          sshd"
    ]
  },
  {
    label: "Patch check",
    command: "sudo apt update && apt list --upgradable",
    output: [
      "Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease",
      "Reading package lists... Done",
      "3 packages can be upgraded.",
      "openssl/noble-updates 3.0.13-0ubuntu3 amd64",
      "openssh-server/noble-updates 1:9.6p1-3 amd64"
    ]
  },
  {
    label: "Firewall status",
    command: "sudo ufw status verbose",
    output: [
      "Status: active",
      "Logging: on (low)",
      "Default: deny (incoming), allow (outgoing), deny (routed)",
      "22/tcp ALLOW IN 192.0.2.0/24"
    ]
  },
  {
    label: "Service scan",
    command: "nmap -sV --top-ports 50 192.0.2.15",
    output: [
      "Starting Nmap against documentation test address 192.0.2.15",
      "PORT   STATE SERVICE VERSION",
      "22/tcp open  ssh     OpenSSH 9.6p1",
      "80/tcp open  http    nginx 1.24",
      "Scan complete. Confirm every open service has an owner."
    ]
  },
  {
    label: "Header review",
    command: "curl -I -L https://target.example",
    output: [
      "HTTP/2 200",
      "strict-transport-security: max-age=31536000; includeSubDomains",
      "content-security-policy: default-src 'self'",
      "x-content-type-options: nosniff",
      "Record missing or weak headers with affected URL and risk."
    ]
  },
  {
    label: "ZAP baseline",
    command: "zap-baseline.py -t https://target.example -r zap-baseline.html",
    output: [
      "Running passive baseline scan against approved target",
      "WARN: Missing Anti-clickjacking Header",
      "WARN: Cookie without SameSite Attribute",
      "Report saved to zap-baseline.html"
    ]
  },
  {
    label: "Nuclei check",
    command: "nuclei -u https://target.example -severity low,medium,high,critical -rl 5",
    output: [
      "Templates loaded for non-destructive checks",
      "[medium] tech-detect on https://target.example",
      "[low] missing-security-header on https://target.example",
      "Validate scanner output before reporting."
    ]
  },
  {
    label: "Log review",
    command: "sudo journalctl -p warning --since \"1 hour ago\"",
    output: [
      "sshd[1422]: Failed password for invalid user admin from 198.51.100.24",
      "kernel: audit: denied outbound connection from unknown service",
      "Review source, frequency, and affected account before closing."
    ]
  },
  {
    label: "Code scan",
    command: "trivy fs --scanners vuln,secret .",
    output: [
      "Secret scanning is enabled",
      "Detected lockfiles: package-lock.json",
      "HIGH CVE-2026-0000 example-library fixed in 2.4.1",
      "No hard-coded secrets detected in tracked files."
    ]
  }
];

const $ = (selector) => document.querySelector(selector);
const playbookStorageKey = "cybersec-playbook-progress-v1";

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load ${path}`);
    return await response.json();
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function setIconRefresh() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function makeButton(label, active, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `filter-button${active ? " active" : ""}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function safeStorageRead(key, fallback = {}) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (error) {
    return fallback;
  }
}

function safeStorageWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(error);
  }
}

function taskKey(phaseId, index) {
  return `${phaseId}:${index}`;
}

function getPlaybookProgress() {
  return safeStorageRead(playbookStorageKey, {});
}

function setTaskComplete(phaseId, index, complete) {
  const progress = getPlaybookProgress();
  progress[taskKey(phaseId, index)] = complete;
  safeStorageWrite(playbookStorageKey, progress);
  renderPlaybookProgress();
  renderPhaseList();
}

function countPlaybookTasks() {
  return state.playbook.phases.reduce((total, phase) => total + phase.tasks.length, 0);
}

function countCompletedTasks() {
  const progress = getPlaybookProgress();
  return state.playbook.phases.reduce((total, phase) => {
    const completed = phase.tasks.filter((_, index) => progress[taskKey(phase.id, index)]).length;
    return total + completed;
  }, 0);
}

function renderPlaybookProgress() {
  const total = countPlaybookTasks();
  const complete = countCompletedTasks();
  const percent = total ? Math.round((complete / total) * 100) : 0;
  $("#playbookProgressText").textContent = `${percent}% complete (${complete}/${total})`;
  $("#playbookProgressBar").style.width = `${percent}%`;
}

function renderReferences() {
  const row = $("#referenceRow");
  row.replaceChildren(...state.playbook.references.map((reference) => {
    const link = document.createElement("a");
    link.className = "reference-chip";
    link.href = reference.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.innerHTML = `<i data-lucide="external-link"></i><span></span>`;
    link.querySelector("span").textContent = reference.name;
    return link;
  }));
}

function renderPhaseList() {
  const list = $("#phaseList");
  const progress = getPlaybookProgress();
  list.replaceChildren(...state.playbook.phases.map((phase) => {
    const complete = phase.tasks.filter((_, index) => progress[taskKey(phase.id, index)]).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `phase-button${phase.id === state.activePhase ? " active" : ""}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", phase.id === state.activePhase ? "true" : "false");

    const title = document.createElement("span");
    title.textContent = phase.title;
    const small = document.createElement("small");
    small.textContent = `${complete}/${phase.tasks.length} tasks`;
    button.append(title, small);

    button.addEventListener("click", () => {
      state.activePhase = phase.id;
      renderPhaseList();
      renderPhaseDetail();
    });
    return button;
  }));
}

function renderPhaseDetail() {
  const phase = state.playbook.phases.find((item) => item.id === state.activePhase) || state.playbook.phases[0];
  const detail = $("#phaseDetail");
  detail.replaceChildren();
  if (!phase) return;

  const eyebrow = document.createElement("span");
  eyebrow.className = "tag";
  eyebrow.textContent = "Playbook phase";

  const title = document.createElement("h3");
  title.textContent = phase.title;

  const objective = document.createElement("p");
  objective.className = "phase-objective";
  objective.textContent = phase.objective;

  const tasksTitle = document.createElement("h4");
  tasksTitle.textContent = "Checklist";
  const checklist = document.createElement("div");
  checklist.className = "checklist";
  const progress = getPlaybookProgress();

  phase.tasks.forEach((task, index) => {
    const label = document.createElement("label");
    label.className = "check-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(progress[taskKey(phase.id, index)]);
    input.addEventListener("change", () => setTaskComplete(phase.id, index, input.checked));
    const span = document.createElement("span");
    span.textContent = task;
    label.append(input, span);
    checklist.append(label);
  });

  const evidenceTitle = document.createElement("h4");
  evidenceTitle.textContent = "Evidence to collect";
  const evidence = document.createElement("ul");
  evidence.className = "compact-list";
  phase.evidence.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    evidence.append(li);
  });

  const commandTitle = document.createElement("h4");
  commandTitle.textContent = "Safe starter commands";
  const commands = document.createElement("pre");
  commands.className = "phase-command";
  commands.textContent = phase.commands.map((command) => `$ ${command}`).join("\n");

  const refs = document.createElement("div");
  refs.className = "phase-refs";
  phase.refs.forEach((ref) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = ref;
    refs.append(chip);
  });

  detail.append(eyebrow, title, objective, tasksTitle, checklist, evidenceTitle, evidence, commandTitle, commands, refs);
}

function filteredMatrix() {
  const query = state.matrixSearch.trim().toLowerCase();
  return state.playbook.matrix.filter((item) => {
    const haystack = `${item.name} ${item.severity} ${item.category} ${item.checks.join(" ")} ${item.tools.join(" ")}`.toLowerCase();
    return !query || haystack.includes(query);
  });
}

function renderMatrix() {
  const grid = $("#matrixGrid");
  const items = filteredMatrix();
  grid.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "section-note";
    empty.textContent = "No checks match that search.";
    grid.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "matrix-card";

    const top = document.createElement("div");
    top.className = "matrix-card-top";
    const title = document.createElement("h3");
    title.textContent = item.name;
    const severity = document.createElement("span");
    severity.className = `severity ${item.severity.toLowerCase()}`;
    severity.textContent = item.severity;
    top.append(title, severity);

    const category = document.createElement("span");
    category.className = "tag";
    category.textContent = item.category;

    const checks = document.createElement("ul");
    checks.className = "compact-list";
    item.checks.forEach((check) => {
      const li = document.createElement("li");
      li.textContent = check;
      checks.append(li);
    });

    const tools = document.createElement("p");
    tools.className = "matrix-tools-line";
    tools.textContent = `Tools: ${item.tools.join(", ")}`;

    const report = document.createElement("p");
    report.textContent = item.report;

    card.append(top, category, checks, tools, report);
    grid.append(card);
  });
}

function extractHost(url) {
  try {
    return new URL(url).hostname || "target.example";
  } catch (error) {
    return "target.example";
  }
}

function generateRunbookMarkdown() {
  const project = $("#projectName").value.trim() || "Web App Assessment";
  const target = $("#targetUrl").value.trim() || "https://target.example";
  const host = extractHost(target);
  const appType = $("#appType").value;
  const depth = $("#testDepth").value;
  const authorized = $("#authorizedCheck").checked;

  if (!authorized) {
    return [
      "# Scope confirmation required",
      "",
      "Check the authorization box before generating active testing steps.",
      "Use this runbook only for systems you own, labs, or client-approved scopes."
    ].join("\n");
  }

  const phaseLines = state.playbook.phases.map((phase) => {
    const tasks = phase.tasks.map((task) => `- [ ] ${task}`).join("\n");
    return `## ${phase.title}\n${phase.objective}\n\n${tasks}`;
  }).join("\n\n");

  return [
    `# ${project}`,
    "",
    `Target: ${target}`,
    `Host: ${host}`,
    `Type: ${appType}`,
    `Depth: ${depth}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Scope Gate",
    "- Written authorization saved",
    "- Scope, exclusions, test window, accounts, and emergency contact confirmed",
    "- Active testing rate limits agreed",
    "",
    "## Starter Commands",
    "```bash",
    "mkdir -p assessment/{notes,evidence,scans,reports}",
    `curl -I -L ${target}`,
    `nmap -sV -T3 --top-ports 100 ${host}`,
    `zap-baseline.py -t ${target} -r assessment/scans/zap-baseline.html`,
    `nuclei -u ${target} -severity low,medium,high,critical -rl 5 -o assessment/scans/nuclei.txt`,
    "gitleaks detect --source . --redact",
    "semgrep scan --config auto",
    "trivy fs --scanners vuln,secret .",
    "```",
    "",
    phaseLines,
    "",
    "## Report Template",
    "- Title:",
    "- Severity and rationale:",
    "- Affected asset:",
    "- Evidence:",
    "- Impact:",
    "- Recommended fix:",
    "- Retest steps:"
  ].join("\n");
}

function updateRunbookOutput() {
  $("#runbookOutput").textContent = generateRunbookMarkdown();
}

function copyRunbook() {
  const text = $("#runbookOutput").textContent || generateRunbookMarkdown();
  navigator.clipboard?.writeText(text);
  const label = $("#copyRunbook span");
  const previous = label.textContent;
  label.textContent = "Copied";
  window.setTimeout(() => {
    label.textContent = previous;
  }, 1200);
}

function renderPostFilters() {
  const target = $("#postFilters");
  const categories = ["All", ...new Set(state.posts.map((post) => post.category))];
  target.replaceChildren(...categories.map((category) =>
    makeButton(category, state.postCategory === category, () => {
      state.postCategory = category;
      renderPosts();
      renderPostFilters();
    })
  ));
}

function filteredPosts() {
  const query = state.postSearch.trim().toLowerCase();
  return state.posts.filter((post) => {
    const matchesCategory = state.postCategory === "All" || post.category === state.postCategory;
    const haystack = `${post.title} ${post.category} ${post.excerpt}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });
}

function renderPosts() {
  const posts = filteredPosts();
  const grid = $("#postGrid");
  grid.replaceChildren();

  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "section-note";
    empty.textContent = "No posts match that filter.";
    grid.append(empty);
    return;
  }

  posts.forEach((post, index) => {
    const card = document.createElement("article");
    card.className = "post-card";

    const title = document.createElement("h3");
    title.textContent = post.title;

    const meta = document.createElement("div");
    meta.className = "post-meta";
    meta.innerHTML = `<span class="tag"></span><span></span><span></span>`;
    meta.children[0].textContent = post.category;
    meta.children[1].textContent = formatDate(post.date);
    meta.children[2].textContent = post.readTime;

    const excerpt = document.createElement("p");
    excerpt.textContent = post.excerpt;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Read note";
    button.addEventListener("click", () => selectPost(post));

    card.append(title, meta, excerpt, button);
    grid.append(card);

    if (index === 0 && !$("#articleReader").dataset.postId) {
      selectPost(post);
    }
  });
}

function selectPost(post) {
  const reader = $("#articleReader");
  reader.dataset.postId = post.id;
  reader.replaceChildren();

  const category = document.createElement("span");
  category.className = "tag";
  category.textContent = post.category;

  const title = document.createElement("h3");
  title.textContent = post.title;

  const meta = document.createElement("div");
  meta.className = "article-meta";
  meta.textContent = `${formatDate(post.date)} / ${post.readTime}`;

  reader.append(category, title, meta);

  post.body.forEach((paragraph) => {
    const p = document.createElement("p");
    p.textContent = paragraph;
    reader.append(p);
  });

  if (post.commands?.length) {
    const pre = document.createElement("pre");
    pre.textContent = post.commands.map((command) => `$ ${command}`).join("\n");
    reader.append(pre);
  }
}

function renderToolFilters() {
  const target = $("#toolFilters");
  const categories = ["All", ...new Set(state.tools.map((tool) => tool.category))];
  target.replaceChildren(...categories.map((category) =>
    makeButton(category, state.toolCategory === category, () => {
      state.toolCategory = category;
      renderTools();
      renderToolFilters();
    })
  ));
}

function filteredTools() {
  const query = state.toolSearch.trim().toLowerCase();
  return state.tools.filter((tool) => {
    const matchesCategory = state.toolCategory === "All" || tool.category === state.toolCategory;
    const haystack = `${tool.name} ${tool.category} ${tool.summary} ${tool.version}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });
}

function renderTools() {
  const grid = $("#toolGrid");
  const tools = filteredTools();
  grid.replaceChildren();

  if (!tools.length) {
    const empty = document.createElement("p");
    empty.className = "section-note";
    empty.textContent = "No tools match that filter.";
    grid.append(empty);
    return;
  }

  tools.forEach((tool) => {
    const card = document.createElement("article");
    card.className = "tool-card";

    const title = document.createElement("h3");
    title.textContent = tool.name;

    const meta = document.createElement("div");
    meta.className = "tool-meta";
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = tool.category;
    const date = document.createElement("span");
    date.textContent = tool.publishedAt ? `Released ${formatDate(tool.publishedAt)}` : "Manual version";
    meta.append(tag, date);

    const summary = document.createElement("p");
    summary.textContent = tool.summary;

    const version = document.createElement("div");
    version.className = "version-line";
    version.innerHTML = `<span>Latest</span><strong></strong>`;
    version.querySelector("strong").textContent = tool.version || "Track manually";

    const command = document.createElement("pre");
    command.className = "tool-command";
    command.textContent = tool.install || "See project documentation";

    const links = document.createElement("div");
    links.className = "tool-links";
    if (tool.source?.url) {
      const source = document.createElement("a");
      source.href = tool.source.url;
      source.target = "_blank";
      source.rel = "noreferrer";
      source.textContent = "Source";
      links.append(source);
    }
    if (tool.source?.releaseUrl) {
      const release = document.createElement("a");
      release.href = tool.source.releaseUrl;
      release.target = "_blank";
      release.rel = "noreferrer";
      release.textContent = "Release";
      links.append(release);
    }

    card.append(title, meta, summary, version, command, links);
    grid.append(card);
  });
}

function renderTerminalButtons() {
  const strip = $("#commandStrip");
  strip.replaceChildren(...commandDeck.map((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `command-pill${index === state.commandIndex ? " active" : ""}`;
    button.textContent = item.label;
    button.addEventListener("click", () => {
      state.commandIndex = index;
      playTerminal();
      renderTerminalButtons();
    });
    return button;
  }));
}

function playTerminal() {
  const current = commandDeck[state.commandIndex];
  const output = $("#terminalOutput");
  $("#terminalTopic").textContent = current.label;
  window.clearInterval(state.typeTimer);

  const lines = [
    `analyst@lab:~$ ${current.command}`,
    ...current.output,
    "",
    "analyst@lab:~$ "
  ];
  const text = lines.join("\n");
  let index = 0;
  output.textContent = "";

  state.typeTimer = window.setInterval(() => {
    output.textContent = text.slice(0, index);
    output.scrollTop = output.scrollHeight;
    index += 2;
    if (index > text.length) {
      output.textContent = text;
      window.clearInterval(state.typeTimer);
    }
  }, 12);
}

function copyCurrentCommand() {
  const current = commandDeck[state.commandIndex];
  navigator.clipboard?.writeText(current.command);
  const button = $("#copyCommand span");
  const previous = button.textContent;
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.textContent = previous;
  }, 1200);
}

function nextCommand() {
  state.commandIndex = (state.commandIndex + 1) % commandDeck.length;
  playTerminal();
  renderTerminalButtons();
}

function initTheme() {
  const saved = localStorage.getItem("cybersec-theme");
  if (saved === "dark") {
    document.body.classList.add("dark");
  }
  $("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("cybersec-theme", document.body.classList.contains("dark") ? "dark" : "light");
  });
}

async function init() {
  initTheme();

  const [posts, toolsPayload, playbook] = await Promise.all([
    loadJson("data/posts.json", fallbackPosts),
    loadJson("data/tools.json", fallbackTools),
    loadJson("data/playbooks.json", fallbackPlaybook)
  ]);

  state.posts = posts;
  state.tools = toolsPayload.tools || [];
  state.playbook = playbook;
  state.activePhase = state.playbook.phases[0]?.id || "";
  $("#postCountMetric").textContent = state.posts.length;
  $("#toolCountMetric").textContent = state.tools.length;
  $("#phaseCountMetric").textContent = state.playbook.phases.length;
  $("#toolsCheckedAt").textContent = `Version data checked ${formatDate(toolsPayload.checkedAt)}.`;

  $("#postSearch").addEventListener("input", (event) => {
    state.postSearch = event.target.value;
    $("#articleReader").dataset.postId = "";
    renderPosts();
  });

  $("#toolSearch").addEventListener("input", (event) => {
    state.toolSearch = event.target.value;
    renderTools();
  });

  $("#matrixSearch").addEventListener("input", (event) => {
    state.matrixSearch = event.target.value;
    renderMatrix();
  });

  $("#assessmentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    updateRunbookOutput();
  });

  ["projectName", "targetUrl", "appType", "testDepth", "authorizedCheck"].forEach((id) => {
    $(`#${id}`).addEventListener("input", updateRunbookOutput);
    $(`#${id}`).addEventListener("change", updateRunbookOutput);
  });

  $("#copyRunbook").addEventListener("click", copyRunbook);
  $("#replayTerminal").addEventListener("click", playTerminal);
  $("#copyCommand").addEventListener("click", copyCurrentCommand);
  $("#nextCommand").addEventListener("click", nextCommand);

  renderReferences();
  renderPlaybookProgress();
  renderPhaseList();
  renderPhaseDetail();
  renderMatrix();
  updateRunbookOutput();
  renderPostFilters();
  renderPosts();
  renderToolFilters();
  renderTools();
  renderTerminalButtons();
  playTerminal();
  setIconRefresh();
}

document.addEventListener("DOMContentLoaded", init);
