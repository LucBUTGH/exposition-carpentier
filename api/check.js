/**
 * api/check.js
 * GET /api/check
 *
 * Vérifie si la session est valide.
 * Répond 200 { ok: true, user } ou 401 { error }.
 */

const { extractToken, verifyToken, json } = require('./_helpers');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Méthode non autorisée' });
  }

  const token = extractToken(req);

  if (!token) {
    return json(res, 401, { error: 'Non authentifié' });
  }

  try {
    const payload = verifyToken(token);
    return json(res, 200, { ok: true, user: payload.user });
  } catch {
    return json(res, 401, { error: 'Session expirée ou invalide' });
  }
};
