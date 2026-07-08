// ApplyMate — frontend logic. Vanilla JS, same-origin API.
const API_KEY = "dev-key";

/* ---------- tiny helpers ---------- */
const $ = (id) => document.getElementById(id);

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
  return data;
}

const ICONS = {
  success: '<path d="M20 6 9 17l-5-5"/>',
  error: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
};
function toast(message, kind = "success") {
  const host = $("toast-host");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="toast-icon"><svg viewBox="0 0 24 24">${ICONS[kind]}</svg></span><span>${message}</span>`;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove());
  }, 2600);
}

function skeleton(el) {
  el.dataset.empty = "false";
  el.className = "output";
  el.innerHTML =
    '<div class="skeleton">' +
    Array.from({ length: 7 }, () => '<div class="skeleton-line"></div>').join("") +
    "</div>";
}

function showResult(el, text) {
  el.dataset.empty = "false";
  el.className = "output";
  el.textContent = text;
}

function showError(el, text) {
  el.dataset.empty = "false";
  el.className = "output error";
  el.textContent = text;
}

function setProviderBadge(el, provider) {
  el.hidden = false;
  el.className = `badge ${provider}`;
  el.textContent = provider === "gemini" ? "Gemini" : "Mock mode";
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast("Copied to clipboard"));
}

/* ---------- navigation ---------- */
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((n) => {
      n.classList.remove("active");
      n.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.remove("active");
      v.hidden = true;
    });
    item.classList.add("active");
    item.setAttribute("aria-selected", "true");
    const view = $("view-" + item.dataset.view);
    view.hidden = false;
    view.classList.add("active");
  });
});

/* ---------- segmented controls ---------- */
function wireSegmented(groupSelector, hiddenId, attr) {
  document.querySelectorAll(groupSelector + " .seg").forEach((seg) => {
    seg.addEventListener("click", () => {
      seg.parentElement.querySelectorAll(".seg").forEach((s) => {
        s.classList.remove("active");
        s.setAttribute("aria-checked", "false");
      });
      seg.classList.add("active");
      seg.setAttribute("aria-checked", "true");
      $(hiddenId).value = seg.dataset[attr];
    });
  });
}
wireSegmented("#view-write", "gen-kind", "kind");
wireSegmented("#view-polish", "pol-mode", "mode");

/* ---------- provider status ---------- */
(async function loadProvider() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    const box = $("provider-status");
    const label = $("provider-label");
    if (data.provider === "gemini") {
      box.className = "status live";
      label.textContent = "Gemini · live";
    } else {
      box.className = "status mock";
      label.textContent = "Mock mode";
    }
  } catch {
    $("provider-label").textContent = "Offline";
  }
})();

/* ---------- Read link ---------- */
$("gen-fetch").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const url = $("gen-url").value.trim();
  const status = $("gen-fetch-status");
  if (!url) {
    status.className = "help err";
    status.textContent = "Paste a link first.";
    return;
  }
  btn.disabled = true;
  btn.classList.add("loading");
  status.className = "help loading";
  status.textContent = "Reading the posting…";
  try {
    const data = await postJSON("/api/fetch-job", { url });
    $("gen-opportunity").value = data.text;
    status.className = "help ok";
    status.textContent = "✓ Read it. Review the text below, then generate.";
    toast("Posting imported");
  } catch (err) {
    status.className = "help err";
    status.textContent = err.message;
    toast("Couldn't read link", "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
  }
});

/* ---------- Generate (2-step pipeline: analyze → generate) ---------- */
const genOut = $("gen-output");
const genProvider = $("gen-provider");
const genCopy = $("gen-copy");
const genStage = $("gen-stage");
const genStageLabel = $("gen-stage-label");
const genMatch = $("gen-match");

const KIND_LABEL = {
  cover_letter: "cover letter",
  cv_bullets: "CV bullets",
  scholarship_essay: "scholarship essay",
};

function setStage(text) {
  if (text === null) {
    genStage.hidden = true;
    return;
  }
  genStage.hidden = false;
  genStageLabel.textContent = text;
}

function renderChips(container, items, kind) {
  container.innerHTML = "";
  for (const item of items) {
    const chip = document.createElement("span");
    chip.className = `chip chip-${kind}`;
    chip.textContent = item;
    container.appendChild(chip);
  }
}

// Render real job-match result. Honest: if analyzed=false (e.g. mock mode) we
// show a note explaining why — never invent chips.
function renderMatch(data) {
  const matchedBox = $("match-matched");
  const missingBox = $("match-missing");
  const note = $("match-note");
  const groups = $("match-groups");

  if (!data.analyzed) {
    genMatch.hidden = false;
    groups.hidden = true;
    note.hidden = false;
    note.textContent =
      data.provider === "mock"
        ? "Job match needs live AI — it's off in mock mode, so no keywords were analyzed."
        : "Couldn't analyze keywords for this one.";
    return;
  }

  groups.hidden = false;
  note.hidden = true;
  renderChips(matchedBox, data.matched, "ok");
  renderChips(missingBox, data.missing, "gap");
  genMatch.hidden = false;
}

$("gen-run").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const profile = $("gen-profile").value.trim();
  const opportunity = $("gen-opportunity").value.trim();
  const kind = $("gen-kind").value;
  if (!profile || !opportunity) {
    toast("Fill in your profile and the opportunity", "error");
    return;
  }
  btn.disabled = true;
  btn.classList.add("loading");
  genCopy.hidden = true;
  genProvider.hidden = true;
  genMatch.hidden = true;

  try {
    // Step 1 — real keyword match.
    setStage("Matching your profile to the opportunity…");
    try {
      const match = await postJSON("/api/analyze", { profile, opportunity });
      renderMatch(match);
    } catch {
      // Analysis is a helper, not the main event — a failure here shouldn't
      // block the document. Skip the panel and continue.
      genMatch.hidden = true;
    }

    // Step 2 — generate the document.
    setStage(`Generating your ${KIND_LABEL[kind] || "document"}…`);
    skeleton(genOut);
    const data = await postJSON("/api/generate", {
      kind,
      profile,
      opportunity,
      notes: $("gen-notes").value.trim(),
    });
    showResult(genOut, data.output);
    setProviderBadge(genProvider, data.provider);
    genCopy.hidden = false;
  } catch (err) {
    showError(genOut, err.message);
    toast("Generation failed", "error");
  } finally {
    setStage(null);
    btn.disabled = false;
    btn.classList.remove("loading");
  }
});
genCopy.addEventListener("click", () => copyText(genOut.textContent));

/* ---------- Polish ---------- */
const polOut = $("pol-output");
const polProvider = $("pol-provider");
const polCopy = $("pol-copy");

$("pol-run").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const text = $("pol-text").value.trim();
  if (!text) {
    toast("Paste some text first", "error");
    return;
  }
  btn.disabled = true;
  btn.classList.add("loading");
  polCopy.hidden = true;
  polProvider.hidden = true;
  skeleton(polOut);
  try {
    const data = await postJSON("/api/polish", {
      text,
      mode: $("pol-mode").value,
    });
    showResult(polOut, data.output);
    setProviderBadge(polProvider, data.provider);
    polCopy.hidden = false;
  } catch (err) {
    showError(polOut, err.message);
    toast("Polish failed", "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
  }
});
polCopy.addEventListener("click", () => copyText(polOut.textContent));

/* ---------- Tracker ---------- */
const STATUSES = ["planned", "applied", "interview", "accepted", "rejected"];
const rowsEl = $("app-rows");
const emptyEl = $("app-empty");
const DEL_ICON = '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

async function loadApplications() {
  try {
    const res = await fetch("/api/applications");
    const apps = await res.json();
    rowsEl.innerHTML = "";
    emptyEl.style.display = apps.length ? "none" : "block";
    for (const a of apps) rowsEl.appendChild(renderRow(a));
  } catch {
    toast("Couldn't load applications", "error");
  }
}

function renderRow(a) {
  const tr = document.createElement("tr");

  const org = document.createElement("td");
  if (a.link) {
    const link = document.createElement("a");
    link.href = a.link;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = a.organization;
    org.appendChild(link);
  } else {
    org.textContent = a.organization;
  }

  const role = document.createElement("td");
  role.textContent = a.role || "—";
  const kind = document.createElement("td");
  kind.textContent = a.kind;
  const deadline = document.createElement("td");
  deadline.textContent = a.deadline || "—";

  const status = document.createElement("td");
  const sel = document.createElement("select");
  sel.className = "status-select status-" + a.status;
  sel.setAttribute("aria-label", "Status for " + a.organization);
  for (const s of STATUSES) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    if (s === a.status) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", async () => {
    try {
      await fetch(`/api/applications/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: sel.value }),
      });
      sel.className = "status-select status-" + sel.value;
      toast("Status updated");
    } catch {
      toast("Update failed", "error");
    }
  });
  status.appendChild(sel);

  const del = document.createElement("td");
  del.style.textAlign = "right";
  const delBtn = document.createElement("button");
  delBtn.className = "row-del";
  delBtn.title = "Delete";
  delBtn.setAttribute("aria-label", "Delete " + a.organization);
  delBtn.innerHTML = DEL_ICON;
  delBtn.addEventListener("click", async () => {
    try {
      await fetch(`/api/applications/${a.id}`, { method: "DELETE" });
      toast("Application removed");
      loadApplications();
    } catch {
      toast("Delete failed", "error");
    }
  });
  del.appendChild(delBtn);

  tr.append(org, role, kind, deadline, status, del);
  return tr;
}

$("app-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const org = $("app-org");
  if (!org.value.trim()) return;
  try {
    await postJSON("/api/applications", {
      organization: org.value.trim(),
      role: $("app-role").value.trim(),
      kind: $("app-kind").value,
      deadline: $("app-deadline").value,
      link: $("app-link").value.trim(),
    });
    e.target.reset();
    toast("Application added");
    loadApplications();
  } catch {
    toast("Couldn't add application", "error");
  }
});

/* ---------- landing → workspace ---------- */
function enterWorkspace(kind) {
  // Set the document type by triggering the existing segmented handler,
  // so active state + hidden input stay in sync (single source of truth).
  if (kind) {
    const seg = document.querySelector(`#view-write .seg[data-kind="${kind}"]`);
    if (seg) seg.click();
  }
  const landing = $("landing");
  const app = document.querySelector(".app");
  if (landing) landing.hidden = true;
  if (app) app.hidden = false;
  window.scrollTo(0, 0);
  // Move focus into the workspace for keyboard users.
  const profile = $("gen-profile");
  if (profile) profile.focus();
}

document.querySelectorAll("[data-enter]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    enterWorkspace(el.dataset.enter);
  });
});

/* ---------- keyboard: Ctrl/Cmd+Enter to run active view ---------- */
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    const active = document.querySelector(".view.active");
    if (!active) return;
    const btn = active.querySelector(".btn-primary");
    if (btn) btn.click();
  }
});

loadApplications();
