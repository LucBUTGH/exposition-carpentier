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

/* ── Validation image (magic numbers) ──────────────────────── */
const ALLOWED_TYPES = {
  'image/jpeg': { ext: 'jpg',  magic: [0xFF, 0xD8, 0xFF] },
  'image/png':  { ext: 'png',  magic: [0x89, 0x50, 0x4E, 0x47] },
  'image/webp': { ext: 'webp', magic: null }, // RIFF....WEBP
  'image/gif':  { ext: 'gif',  magic: [0x47, 0x49, 0x46] },
};
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 Mo

function validateImage(buffer, declaredType) {
  if (!buffer || !buffer.length) return { valid: false, error: 'Image invalide' };
  if (buffer.length > MAX_IMAGE_SIZE) return { valid: false, error: 'Image trop volumineuse (max 4 Mo)' };

  // Détecter le vrai type par les magic bytes
  let detectedType = null;
  for (const [mime, info] of Object.entries(ALLOWED_TYPES)) {
    if (mime === 'image/webp') {
      // RIFF header + WEBP at offset 8
      if (buffer.length >= 12 &&
          buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
          buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        detectedType = mime;
        break;
      }
    } else if (info.magic && info.magic.every((b, i) => buffer[i] === b)) {
      detectedType = mime;
      break;
    }
  }

  if (!detectedType) return { valid: false, error: 'Format non supporté (JPEG, PNG, WebP, GIF uniquement)' };

  const info = ALLOWED_TYPES[detectedType];
  return { valid: true, contentType: detectedType, ext: info.ext };
}

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
    allowOverwrite: true,
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

    if (!image) return json(res, 400, { error: 'Image requise' });

    const buffer = Buffer.from(image, 'base64');
    const validation = validateImage(buffer, imageType);
    if (!validation.valid) return json(res, 400, { error: validation.error });

    const { contentType, ext } = validation;
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
      return json(res, 500, { error: 'Erreur lors de l\'upload de l\'image' });
    }

    const artwork = {
      id,
      title: (title || '').trim(),
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
      return json(res, 500, { error: 'Erreur lors de la sauvegarde' });
    }

    return json(res, 201, { ok: true, artwork });
  }

  // ── DELETE — suppression ──
  if (req.method === 'DELETE') {
    if (!requireAuth(req, res)) return;

    const id = (req.query.id || '').trim();
    if (!id) return json(res, 400, { error: 'ID requis' });

    // Invalider le cache pour relire depuis le Blob Store
    _cache = null;
    const artworks = await getArtworks();
    const artwork = artworks.find(a => a.id === id);
    if (!artwork) return json(res, 404, { error: 'Œuvre introuvable' });

    try {
      console.log('Deleting blob:', artwork.imageUrl);
      await del(artwork.imageUrl);
      console.log('Blob deleted OK');
    } catch (err) {
      console.error('Blob del error:', err.message, err.stack);
      // on continue même si le blob est déjà supprimé
    }

    try {
      const updated = artworks.filter(a => a.id !== id);
      console.log('Saving metadata, remaining:', updated.length);
      await saveArtworks(updated);
      console.log('Metadata saved OK');
    } catch (err) {
      console.error('Metadata save error:', err.message, err.stack);
      return json(res, 500, { error: 'Erreur lors de la suppression (sauvegarde métadonnées)' });
    }

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
