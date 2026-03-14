/**
 * api/_helpers.js
 * Utilitaires partagés entre les fonctions serverless.
 * Le préfixe "_" empêche Vercel d'exposer ce fichier comme route HTTP.
 */

const jwt    = require('jsonwebtoken');
const cookie = require('cookie');

/* ── Constants ───────────────────────────────────────────── */
const COOKIE_NAME    = 'expo_session';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 heures

/* ── JWT ─────────────────────────────────────────────────── */

/**
 * Signe un JWT avec le secret d'environnement.
 * @param {object} payload
 * @returns {string}
 */
function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET manquant dans les variables d\'environnement');
  return jwt.sign(payload, secret, { expiresIn: COOKIE_MAX_AGE });
}

/**
 * Vérifie et décode un JWT.
 * Lève une erreur si invalide ou expiré.
 * @param {string} token
 * @returns {object} payload décodé
 */
function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET manquant dans les variables d\'environnement');
  return jwt.verify(token, secret);
}

/* ── Cookie ──────────────────────────────────────────────── */

/**
 * Construit la valeur de l'en-tête Set-Cookie pour la session admin.
 * @param {string} token  JWT à stocker
 * @returns {string}
 */
function buildSessionCookie(token) {
  return cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  });
}

/**
 * Construit un cookie expiré pour la déconnexion.
 * @returns {string}
 */
function buildExpiredCookie() {
  return cookie.serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge:   0,
    path:     '/',
  });
}

/**
 * Extrait le JWT depuis les cookies d'une requête.
 * @param {import('http').IncomingMessage} req
 * @returns {string|null}
 */
function extractToken(req) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const parsed = cookie.parse(raw);
  return parsed[COOKIE_NAME] || null;
}

/* ── Credentials ─────────────────────────────────────────── */

/**
 * Vérifie les identifiants fournis contre les variables d'environnement.
 * En production : stocker ADMIN_PASSWORD_HASH (bcrypt) plutôt qu'en clair.
 * @param {string} username
 * @param {string} password
 * @returns {boolean}
 */
function checkCredentials(username, password) {
  const expectedUser = process.env.ADMIN_USER     || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD || 'admin';
  return username === expectedUser && password === expectedPass;
}

/* ── CORS / JSON helpers ─────────────────────────────────── */

/**
 * Envoie une réponse JSON avec le bon Content-Type.
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {object} body
 */
function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
}

module.exports = {
  signToken,
  verifyToken,
  buildSessionCookie,
  buildExpiredCookie,
  extractToken,
  checkCredentials,
  json,
};
