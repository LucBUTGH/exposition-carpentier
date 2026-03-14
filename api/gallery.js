/**
 * api/gallery.js
 * CRUD galerie d'œuvres — stockage Vercel Blob.
 *
 * GET    /api/gallery          → liste publique des œuvres
 * POST   /api/gallery?title=…&technique=…  → ajout (image en body brut, auth requise)
 * DELETE /api/gallery?id=…     → suppression (auth requise)
 */

const { extractToken, verifyToken, json } = require('./_helpers');
const { put, del, list } = require('@vercel/blob');
const crypto = require('crypto');

const META_KEY = 'gallery/artworks.json';

/* ── Cache mémoire (persiste dans l'instance warm) ── */
let _cache = null;  // null = pas encore chargé, [] = vide

/* ── Helpers ──────────────────────────────────────────────── */

async function getArtworks() {
  if (_cache !== null) return _cache;

  try {
    const { blobs } = await list({ prefix: META_KEY });
    if (!blobs.length) { _cache = []; return _cache; }

    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    const data = await res.json();
    _cache = data.artworks || [];
  } catch {
    _cache = [];
  }
  return _cache;
}

async function saveArtworks(artworks) {
  await put(META_KEY, JSON.stringify({ artworks }), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  _cache = artworks;
}

function requireAuth(req, res) {
  const token = extractToken(req);
  if (!token) { json(res, 401, { error: 'Non authentifié' }); return false; }
  try { verifyToken(token); return true; }
  catch { json(res, 401, { error: 'Session expirée' }); return false; }
}

/* ── Handler ──────────────────────────────────────────────── */

module.exports = async function handler(req, res) {

  // ── GET — liste publique ──
  if (req.method === 'GET') {
    const artworks = await getArtworks();
    return json(res, 200, { ok: true, artworks });
  }

  // ── POST — ajout d'œuvre ──
  if (req.method === 'POST') {
    if (!requireAuth(req, res)) return;

    const { title, technique, image, imageType } = req.body || {};

    if (!title || !title.trim()) return json(res, 400, { error: 'Titre requis' });
    if (!image) return json(res, 400, { error: 'Image requise' });

    const buffer = Buffer.from(image, 'base64');
    if (!buffer.length) return json(res, 400, { error: 'Image invalide' });

    const contentType = imageType || 'image/jpeg';
    const ext = contentType.split('/')[1]?.split('+')[0] || 'jpg';
    const id = crypto.randomBytes(4).toString('hex');
    const blobPath = `gallery/${id}.${ext}`;

    let blob;
    try {
      blob = await put(blobPath, buffer, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      });
    } catch (err) {
      console.error('Blob upload error:', err);
      return json(res, 500, { error: 'Erreur upload image: ' + err.message });
    }

    const artwork = {
      id,
      title: title.trim(),
      technique: (technique || '').trim(),
      imageUrl: blob.url,
      addedAt: new Date().toISOString(),
    };

    try {
      const artworks = await getArtworks();
      artworks.push(artwork);
      await saveArtworks(artworks);
    } catch (err) {
      console.error('Metadata save error:', err);
      return json(res, 500, { error: 'Erreur sauvegarde: ' + err.message });
    }

    return json(res, 201, { ok: true, artwork });
  }

  // ── DELETE — suppression ──
  if (req.method === 'DELETE') {
    if (!requireAuth(req, res)) return;

    const id = (req.query.id || '').trim();
    if (!id) return json(res, 400, { error: 'ID requis' });

    const artworks = await getArtworks();
    const artwork = artworks.find(a => a.id === id);
    if (!artwork) return json(res, 404, { error: 'Œuvre introuvable' });

    try { await del(artwork.imageUrl); } catch { /* blob déjà supprimé */ }

    const updated = artworks.filter(a => a.id !== id);
    await saveArtworks(updated);

    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'Méthode non autorisée' });
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};
