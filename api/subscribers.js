/**
 * api/subscribers.js
 * CRUD liste d'abonnés — stockage Vercel Blob.
 *
 * GET    /api/subscribers          → liste des abonnés (auth requise)
 * POST   /api/subscribers          → ajouter des emails (merge + dedup, auth requise)
 * DELETE /api/subscribers?email=…  → supprimer un email (auth requise)
 */

const { extractToken, verifyToken, json } = require('./_helpers');
const { put, list } = require('@vercel/blob');

const META_KEY = 'mailing/subscribers.json';

/* ── Cache mémoire (persiste dans l'instance warm) ── */
let _cache = null;

/* ── Helpers ──────────────────────────────────────────────── */

async function getSubscribers() {
  if (_cache !== null) return _cache;

  try {
    const { blobs } = await list({ prefix: META_KEY });
    if (!blobs.length) { _cache = []; return _cache; }

    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    const data = await res.json();
    _cache = data.subscribers || [];
  } catch {
    _cache = [];
  }
  return _cache;
}

async function saveSubscribers(subscribers) {
  await put(META_KEY, JSON.stringify({ subscribers }), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  _cache = subscribers;
}

function requireAuth(req, res) {
  const token = extractToken(req);
  if (!token) { json(res, 401, { error: 'Non authentifié' }); return false; }
  try { verifyToken(token); return true; }
  catch { json(res, 401, { error: 'Session expirée' }); return false; }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Handler ──────────────────────────────────────────────── */

module.exports = async function handler(req, res) {

  // Toutes les routes nécessitent l'auth
  if (!requireAuth(req, res)) return;

  // ── GET — liste complète ──
  if (req.method === 'GET') {
    const subscribers = await getSubscribers();
    return json(res, 200, { ok: true, subscribers });
  }

  // ── POST — ajout d'emails (merge + dedup) ──
  if (req.method === 'POST') {
    const { emails } = req.body || {};

    if (!Array.isArray(emails) || emails.length === 0) {
      return json(res, 400, { error: 'Tableau d\'emails requis' });
    }

    // Valider et normaliser
    const valid = emails
      .map(e => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
      .filter(e => EMAIL_RE.test(e));

    if (valid.length === 0) {
      return json(res, 400, { error: 'Aucun email valide fourni' });
    }

    const current = await getSubscribers();
    const set = new Set(current);
    let added = 0;
    for (const email of valid) {
      if (!set.has(email)) { set.add(email); added++; }
    }

    const merged = [...set];
    await saveSubscribers(merged);

    return json(res, 200, {
      ok: true,
      total: merged.length,
      added,
      subscribers: merged,
    });
  }

  // ── DELETE — suppression d'un email ou de toute la liste ──
  if (req.method === 'DELETE') {
    const email = (req.query.email || '').trim().toLowerCase();

    // DELETE /api/subscribers?all=1 → vider la liste
    if (req.query.all === '1') {
      await saveSubscribers([]);
      return json(res, 200, { ok: true, total: 0 });
    }

    if (!email) return json(res, 400, { error: 'Email requis' });

    const current = await getSubscribers();
    const updated = current.filter(e => e !== email);

    if (updated.length === current.length) {
      return json(res, 404, { error: 'Email introuvable' });
    }

    await saveSubscribers(updated);
    return json(res, 200, { ok: true, total: updated.length });
  }

  return json(res, 405, { error: 'Méthode non autorisée' });
};
