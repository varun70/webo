const state = {
  posts: [],
  tools: [],
  postCategory: "All",
  toolCategory: "All",
  postSearch: "",
  toolSearch: "",
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

  const [posts, toolsPayload] = await Promise.all([
    loadJson("data/posts.json", fallbackPosts),
    loadJson("data/tools.json", fallbackTools)
  ]);

  state.posts = posts;
  state.tools = toolsPayload.tools || [];
  $("#postCountMetric").textContent = state.posts.length;
  $("#toolCountMetric").textContent = state.tools.length;
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

  $("#replayTerminal").addEventListener("click", playTerminal);
  $("#copyCommand").addEventListener("click", copyCurrentCommand);
  $("#nextCommand").addEventListener("click", nextCommand);

  renderPostFilters();
  renderPosts();
  renderToolFilters();
  renderTools();
  renderTerminalButtons();
  playTerminal();
  setIconRefresh();
}

document.addEventListener("DOMContentLoaded", init);
