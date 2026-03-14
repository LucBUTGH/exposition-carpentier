/**
 * api/logout.js
 * POST /api/logout
 *
 * Supprime le cookie de session.
 */

const { buildExpiredCookie, json } = require('./_helpers');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Méthode non autorisée' });
  }

  res.setHeader('Set-Cookie', buildExpiredCookie());
  return json(res, 200, { ok: true });
};
