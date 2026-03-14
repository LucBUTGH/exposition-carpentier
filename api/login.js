/**
 * api/login.js
 * POST /api/login
 *
 * Vérifie les identifiants, émet un JWT dans un cookie httpOnly.
 * Répond 200 { ok: true } ou 401 { error: '...' }.
 */

const {
  checkCredentials,
  signToken,
  buildSessionCookie,
  json,
} = require("./_helpers");

/* ── Body parsing helper ─────────────────────────────────── */
function parseBody(req) {
  return new Promise((resolve) => {
    // Vercel dev parfois ne parse pas automatiquement le body
    if (req.body && typeof req.body === "object") {
      return resolve(req.body);
    }
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

/* ── Handler ─────────────────────────────────────────────── */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Méthode non autorisée" });
  }

  const { username, password } = await parseBody(req);

  if (!username || !password) {
    return json(res, 400, { error: "Identifiant et mot de passe requis" });
  }

  // Limiter la longueur des entrées pour éviter les abus
  if (username.length > 100 || password.length > 200) {
    return json(res, 400, { error: "Identifiants invalides" });
  }

  if (!(await checkCredentials(username, password))) {
    // Délai constant pour éviter le timing attack
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
    return json(res, 401, { error: "Identifiants incorrects" });
  }

  const token = signToken({ user: username, role: "admin" });
  const cookie = buildSessionCookie(token);

  res.setHeader("Set-Cookie", cookie);
  return json(res, 200, { ok: true, user: username });
};
