/**
 * js/admin.js
 * Panneau d'administration — auth JWT + upload CSV + envoi mail
 */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ── Toast ── */
function showToast(message, duration = 3500) {
  const toast = $(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}

/* ── UI state ── */
const UI = {
  loginView: null,
  adminView: null,
  loginForm: null,
  loginError: null,
  adminUserSpan: null,

  init() {
    this.loginView = $("#view-login");
    this.adminView = $("#view-admin");
    this.loginForm = $("#login-form");
    this.loginError = $("#login-error");
    this.adminUserSpan = $("#admin-username");
  },

  showLogin() {
    this.loginView?.removeAttribute("hidden");
    this.adminView?.setAttribute("hidden", "");
    $('input[name="username"]')?.focus();
  },

  showAdmin(username) {
    this.loginView?.setAttribute("hidden", "");
    this.adminView?.removeAttribute("hidden");
    if (this.adminUserSpan) this.adminUserSpan.textContent = username;
    initDate();
    loadSubscribers();
    loadGalerie();
  },

  setLoginError(msg) {
    if (!this.loginError) return;
    this.loginError.textContent = msg;
    this.loginError.removeAttribute("hidden");
  },

  clearLoginError() {
    if (!this.loginError) return;
    this.loginError.textContent = "";
    this.loginError.setAttribute("hidden", "");
  },
};

/* ── API helpers ── */
async function apiPost(endpoint, body) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function apiGet(endpoint) {
  const res = await fetch(endpoint, {
    method: "GET",
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/* ── Auth ── */
async function checkSession() {
  const { ok, data } = await apiGet("/api/check");
  if (ok && data.ok) UI.showAdmin(data.user);
  else UI.showLogin();
}

async function handleLogin(e) {
  e.preventDefault();
  UI.clearLoginError();
  const form = e.currentTarget;
  const btn = form.querySelector(".btn-login");
  const username = form.querySelector('[name="username"]')?.value.trim();
  const password = form.querySelector('[name="password"]')?.value;

  if (!username || !password) {
    UI.setLoginError("Veuillez remplir tous les champs.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Connexion…";

  const { ok, status, data } = await apiPost("/api/login", {
    username,
    password,
  });

  btn.disabled = false;
  btn.textContent = "Accéder au panneau";

  if (ok) {
    UI.showAdmin(data.user);
  } else if (status === 429) {
    UI.setLoginError(data.error || "Trop de tentatives. Réessayez plus tard.");
  } else {
    UI.setLoginError(data.error || "Identifiants incorrects.");
    form.querySelector('[name="password"]').value = "";
    form.querySelector('[name="password"]').focus();
  }
}

async function handleLogout() {
  await apiPost("/api/logout", {});
  UI.showLogin();
  showToast("Déconnecté avec succès.");
}

/* ── Mailing list ── */
let mailingList = [];

async function loadSubscribers() {
  const { ok, data } = await apiGet("/api/subscribers");
  if (ok && Array.isArray(data.subscribers)) {
    mailingList = data.subscribers;
  }
  updateMailingUI();
  renderInscrits();
}

function updateMailingUI() {
  const n = mailingList.length;
  const s = n > 1 ? "s" : "";
  const statValue = $("#stat-recipients");
  const statLabel = $("#stat-recipients-label");
  const countLabel = $("#recipients-count-label");
  const hintEl = $("#csv-current-count");

  if (n > 0) {
    if (statValue) statValue.textContent = n;
    if (statLabel) statLabel.textContent = "Dans la liste";
    if (countLabel) countLabel.textContent = `${n} destinataire${s}`;
    if (hintEl) hintEl.textContent = `Liste actuelle : ${n} adresse${s}`;
  } else {
    if (statValue) statValue.textContent = "0";
    if (statLabel) statLabel.textContent = "Aucune liste importée";
    if (countLabel) countLabel.textContent = "— destinataires";
    if (hintEl) hintEl.textContent = "Aucune liste importée";
  }
}

/* ── CSV Upload — parsing côté client, aucune API ── */
function initCsvUpload() {
  const zone = $("#csv-upload-zone");
  const fileInput = $("#csv-file-input");
  const statusEl = $("#csv-status");

  if (!zone || !fileInput) return;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  zone.addEventListener("click", () => fileInput.click());
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) parseCsv(file);
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) parseCsv(fileInput.files[0]);
    fileInput.value = "";
  });

  async function parseCsv(file) {
    if (!file.name.endsWith(".csv")) {
      showCsvStatus("error", "Seuls les fichiers .csv sont acceptés.");
      return;
    }

    showCsvStatus("loading", "Lecture en cours…");
    zone.classList.add("uploading");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        if (lines.length < 2) {
          showCsvStatus("error", "Fichier vide ou sans données.");
          return;
        }

        const sep = lines[0].includes(";") ? ";" : ",";
        const headers = lines[0]
          .split(sep)
          .map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
        const emailIdx = headers.findIndex(
          (h) => h === "email" || h === "e-mail" || h === "mail",
        );

        if (emailIdx === -1) {
          showCsvStatus(
            "error",
            "Colonne « email » introuvable dans le fichier.",
          );
          return;
        }

        const emails = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(sep);
          const email = (cols[emailIdx] || "")
            .trim()
            .replace(/['"]/g, "")
            .toLowerCase();
          if (EMAIL_RE.test(email)) emails.push(email);
        }

        const unique = [...new Set(emails)];

        const skipped = lines.length - 1 - unique.length;

        // Persister côté serveur (merge + dedup avec la liste existante)
        showCsvStatus("loading", "Sauvegarde en cours…");
        const { ok: saveOk, data: saveData } = await apiPost(
          "/api/subscribers",
          { emails: unique },
        );

        if (saveOk && Array.isArray(saveData.subscribers)) {
          mailingList = saveData.subscribers;
          const msg =
            skipped > 0
              ? `${unique.length} adresse(s) importée(s) — ${skipped} ignorée(s). Total : ${mailingList.length}.`
              : `${unique.length} adresse(s) importée(s). Total : ${mailingList.length}.`;
          showCsvStatus("success", msg);
        } else {
          // Fallback client-side si l'API échoue
          mailingList = [...new Set([...mailingList, ...unique])];
          showCsvStatus("success", `${unique.length} adresse(s) importée(s) (non sauvegardées côté serveur).`);
        }

        updateMailingUI();
        renderInscrits();
      } catch {
        showCsvStatus("error", "Erreur lors de la lecture du fichier.");
      } finally {
        zone.classList.remove("uploading");
      }
    };

    reader.onerror = () => {
      showCsvStatus("error", "Impossible de lire le fichier.");
      zone.classList.remove("uploading");
    };

    reader.readAsText(file, "UTF-8");
  }

  function showCsvStatus(type, message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `csv-status csv-status--${type}`;
    statusEl.removeAttribute("hidden");
    if (type !== "loading")
      setTimeout(() => statusEl.setAttribute("hidden", ""), 5000);
  }
}

/* ── Inscrits table ── */
function renderInscrits(filter = "") {
  const empty = $("#inscrits-empty");
  const table = $("#inscrits-table");
  const tbody = $("#inscrits-tbody");
  const counter = $("#inscrits-count");

  if (!tbody) return;

  const term = filter.trim().toLowerCase();
  const visible = term
    ? mailingList.filter((e) => e.includes(term))
    : mailingList;

  // Update counter
  if (counter) {
    const n = mailingList.length;
    counter.textContent =
      n === 0
        ? "0 adresse"
        : term
          ? `${visible.length} / ${n}`
          : `${n} adresse${n > 1 ? "s" : ""}`;
  }

  if (mailingList.length === 0) {
    empty?.removeAttribute("hidden");
    table?.setAttribute("hidden", "");
    return;
  }

  empty?.setAttribute("hidden", "");
  table?.removeAttribute("hidden");

  tbody.innerHTML = "";
  visible.forEach((email) => {
    const realIdx = mailingList.indexOf(email) + 1;
    const tr = document.createElement("tr");

    const tdIdx = document.createElement("td");
    tdIdx.textContent = realIdx;

    const tdEmail = document.createElement("td");
    if (term) {
      // Highlight sécurisé sans innerHTML
      const re = new RegExp(`(${escapeRe(term)})`, "gi");
      let last = 0;
      let match;
      while ((match = re.exec(email)) !== null) {
        if (match.index > last)
          tdEmail.appendChild(
            document.createTextNode(email.slice(last, match.index)),
          );
        const mark = document.createElement("mark");
        mark.textContent = match[1];
        tdEmail.appendChild(mark);
        last = re.lastIndex;
      }
      if (last < email.length)
        tdEmail.appendChild(document.createTextNode(email.slice(last)));
    } else {
      tdEmail.textContent = email;
    }

    const tdAction = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "btn-remove-email";
    btn.title = "Supprimer";
    btn.setAttribute("aria-label", `Supprimer ${email}`);
    btn.textContent = "\u2715";
    btn.addEventListener("click", async () => {
      // Supprimer côté serveur
      await fetch(`/api/subscribers?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      mailingList = mailingList.filter((e) => e !== email);
      updateMailingUI();
      renderInscrits($("#inscrits-search")?.value || "");
    });
    tdAction.appendChild(btn);

    tr.appendChild(tdIdx);
    tr.appendChild(tdEmail);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function initInscrits() {
  const search = $("#inscrits-search");
  if (!search) return;
  search.addEventListener("input", () => renderInscrits(search.value));
}

/* ── Send mail ── */
function initMailForm() {
  const sendBtn = $(".btn-send-mail");
  if (!sendBtn) return;

  sendBtn.addEventListener("click", async () => {
    if (mailingList.length === 0) {
      showToast("Aucun destinataire. Importez d'abord une liste CSV.");
      return;
    }

    const original = sendBtn.textContent;
    sendBtn.disabled = true;
    sendBtn.textContent = "Envoi…";

    const { ok, data } = await apiPost("/api/send-mail", {
      recipients: mailingList,
    });

    sendBtn.textContent = original;
    sendBtn.disabled = false;

    if (ok) {
      showToast(data.message || "Message envoyé.");
    } else {
      showToast(data.error || "Erreur lors de l'envoi.");
    }
  });
}

/* ── Quick links ── */
function initQuickLinks() {
  $$(".quick-link-item").forEach((link) => {
    const handler = () => {
      const action = link.dataset.action;
      if (action === "site") window.open("/", "_blank");
      else if (action === "galerie") location.hash = "#galerie-admin";
      else showToast(`Action « ${action} » — à implémenter.`);
    };
    link.addEventListener("click", handler);
    link.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") handler();
    });
  });
}

/* ── Date + countdown ── */
function initDate() {
  // Jours restants avant clôture
  const closeDate = new Date("2026-05-13");
  const now = new Date();
  const diff = Math.max(0, Math.ceil((closeDate - now) / 86400000));
  const daysEl = $("#days-remaining");
  if (daysEl) daysEl.textContent = diff;

  const el = $(".header-date .date-str");
  if (!el) return;
  el.textContent = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* ── Gallery management ── */
let galerieArtworks = [];
let galerieSelectedFile = null;

async function loadGalerie() {
  const { ok, data } = await apiGet("/api/gallery");
  if (ok) {
    galerieArtworks = data.artworks || [];
    renderGalerie();
  }
}

function renderGalerie() {
  const empty = $("#galerie-empty");
  const grid = $("#galerie-grid");
  const counter = $("#galerie-count");

  if (!grid) return;

  const n = galerieArtworks.length;
  if (counter) counter.textContent = `${n} œuvre${n > 1 ? "s" : ""}`;

  if (n === 0) {
    empty?.removeAttribute("hidden");
    grid?.setAttribute("hidden", "");
    return;
  }

  empty?.setAttribute("hidden", "");
  grid?.removeAttribute("hidden");

  grid.innerHTML = "";
  galerieArtworks.forEach((a) => {
    const card = document.createElement("div");
    card.className = "galerie-admin-card";
    card.dataset.id = a.id;

    const img = document.createElement("img");
    img.src = a.imageUrl;
    img.alt = a.title;
    img.className = "galerie-admin-card__img";

    const info = document.createElement("div");
    info.className = "galerie-admin-card__info";

    const titleEl = document.createElement("p");
    titleEl.className = "galerie-admin-card__title";
    titleEl.textContent = a.title;

    const techEl = document.createElement("span");
    techEl.className = "galerie-admin-card__technique";
    techEl.textContent = a.technique || "";

    info.appendChild(titleEl);
    info.appendChild(techEl);

    const btn = document.createElement("button");
    btn.className = "btn-remove-artwork";
    btn.title = "Supprimer";
    btn.setAttribute("aria-label", `Supprimer ${a.title}`);
    btn.textContent = "\u2715";
    btn.addEventListener("click", () => deleteArtwork(a.id));

    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(btn);
    grid.appendChild(card);
  });
}

async function deleteArtwork(id) {
  if (!confirm("Supprimer cette œuvre de la galerie ?")) return;

  const res = await fetch(`/api/gallery?id=${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));

  if (res.ok) {
    galerieArtworks = galerieArtworks.filter((a) => a.id !== id);
    renderGalerie();
    showToast("Œuvre supprimée.");
  } else {
    showToast(data.error || "Erreur lors de la suppression.");
  }
}

function initGalerie() {
  const zone = $("#galerie-upload-zone");
  const fileInput = $("#galerie-file-input");
  const preview = $("#galerie-preview");
  const previewImg = $("#galerie-preview-img");
  const saveBtn = $("#btn-galerie-save");
  const cancelBtn = $("#btn-galerie-cancel");
  const statusEl = $("#galerie-status");

  if (!zone || !fileInput) return;

  zone.addEventListener("click", () => fileInput.click());
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) showImagePreview(file);
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) showImagePreview(fileInput.files[0]);
    fileInput.value = "";
  });

  function showImagePreview(file) {
    if (!file.type.startsWith("image/")) {
      showGalerieStatus("error", "Seules les images sont acceptées.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showGalerieStatus("error", "Image trop volumineuse (max 4 Mo).");
      return;
    }
    galerieSelectedFile = file;
    previewImg.src = URL.createObjectURL(file);
    preview.removeAttribute("hidden");
    zone.setAttribute("hidden", "");
    $("#galerie-title").value = "";
    $("#galerie-technique").value = "";
    $("#galerie-title").focus();
  }

  cancelBtn?.addEventListener("click", () => {
    preview.setAttribute("hidden", "");
    zone.removeAttribute("hidden");
    galerieSelectedFile = null;
  });

  saveBtn?.addEventListener("click", async () => {
    const title = $("#galerie-title")?.value.trim();
    const technique = $("#galerie-technique")?.value.trim();

    if (!galerieSelectedFile) {
      showGalerieStatus("error", "Aucune image sélectionnée.");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Envoi…";
    showGalerieStatus("loading", "Upload en cours…");

    try {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(galerieSelectedFile);
      });

      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          technique,
          image: base64,
          imageType: galerieSelectedFile.type,
        }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        galerieArtworks.push(data.artwork);
        renderGalerie();
        preview.setAttribute("hidden", "");
        zone.removeAttribute("hidden");
        galerieSelectedFile = null;
        showGalerieStatus("success", "Œuvre ajoutée avec succès.");
        showToast("Œuvre ajoutée à la galerie.");
      } else {
        showGalerieStatus("error", data.error || "Erreur lors de l'upload.");
      }
    } catch {
      showGalerieStatus("error", "Erreur réseau.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Enregistrer";
    }
  });

  function showGalerieStatus(type, message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `csv-status csv-status--${type}`;
    statusEl.removeAttribute("hidden");
    if (type !== "loading")
      setTimeout(() => statusEl.setAttribute("hidden", ""), 5000);
  }
}

/* ── Init ── */
document.addEventListener("DOMContentLoaded", async () => {
  UI.init();
  UI.loginForm?.addEventListener("submit", handleLogin);
  $("#btn-logout")?.addEventListener("click", handleLogout);
  initMailForm();
  initCsvUpload();
  initInscrits();
  initGalerie();
  initQuickLinks();
  await checkSession();
});
