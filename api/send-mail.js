/**
 * api/send-mail.js
 * Envoi d'emails via Resend.
 *
 * POST /api/send-mail  { subject, body, recipients }  (auth requise)
 */

const { Resend } = require('resend');
const { extractToken, verifyToken, json } = require('./_helpers');

function requireAuth(req, res) {
  const token = extractToken(req);
  if (!token) { json(res, 401, { error: 'Non authentifié' }); return false; }
  try { verifyToken(token); return true; }
  catch { json(res, 401, { error: 'Session expirée' }); return false; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Méthode non autorisée' });
  }

  if (!requireAuth(req, res)) return;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    return json(res, 500, { error: 'Configuration Resend manquante (RESEND_API_KEY / RESEND_FROM)' });
  }

  const { subject, body, recipients } = req.body || {};

  if (!subject || !subject.trim()) {
    return json(res, 400, { error: 'Objet requis' });
  }
  if (!body || !body.trim()) {
    return json(res, 400, { error: 'Contenu requis' });
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return json(res, 400, { error: 'Liste de destinataires requise' });
  }

  const resend = new Resend(apiKey);

  // Resend supporte jusqu'à 50 destinataires par appel batch
  const BATCH_SIZE = 50;
  let sent = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    // Créer un message par destinataire dans le batch
    const messages = batch.map(to => ({
      from,
      to,
      subject: subject.trim(),
      html: body.trim().replace(/\n/g, '<br>'),
    }));

    try {
      const result = await resend.batch.send(messages);

      if (result.error) {
        errors.push(result.error.message || 'Erreur batch Resend');
      } else {
        sent += batch.length;
      }
    } catch (err) {
      errors.push(err.message || 'Erreur réseau Resend');
    }
  }

  if (sent === 0 && errors.length > 0) {
    return json(res, 500, {
      error: `Échec de l'envoi : ${errors[0]}`,
    });
  }

  return json(res, 200, {
    ok: true,
    sent,
    total: recipients.length,
    message: errors.length > 0
      ? `${sent}/${recipients.length} email(s) envoyé(s). ${errors.length} erreur(s).`
      : `${sent} email(s) envoyé(s) avec succès.`,
  });
};
