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

  const { recipients } = req.body || {};

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return json(res, 400, { error: 'Liste de destinataires requise' });
  }

  const subject = process.env.RESEND_SUBJECT || 'Exposition Ombres & Lumières';
  const imageUrl = process.env.RESEND_IMAGE_URL || 'https://placehold.co/600x400?text=Image';
  const textContent = `Bonjour,\n\nVous trouverez ci-dessous l'affiche de l'exposition ayant lieu du 30 avril au 13 mai 2026.\n\nLien vers l'affiche : ${imageUrl}\n\nBonne journée`;

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
    <p style="margin:0 0 16px">Bonjour,</p>
    <p style="margin:0 0 16px">Vous trouverez ci-dessous l'affiche de l'exposition ayant lieu du 30 avril au 13 mai 2026.</p>
    <p style="margin:0 0 16px">Nous vous invitons à venir découvrir cette exposition qui mettra en lumière les œuvres de l'artiste. L'entrée est libre et gratuite. N'hésitez pas à partager cette invitation avec vos proches, amis et collègues qui pourraient être intéressés.</p>
    <p style="margin:0 0 16px">L'exposition se tiendra du mercredi 30 avril au mardi 13 mai 2026. Nous serions ravis de vous y accueillir.</p>
    <div style="text-align:center;margin:24px 0"><img src="${imageUrl}" alt="Affiche de l'exposition Ombres et Lumières - du 30 avril au 13 mai 2026" style="max-width:100%;height:auto" /></div>
    <p style="margin:16px 0 0">Bonne journée,</p>
    <p style="margin:0">Cordialement</p>
  </div>`;

  const resend = new Resend(apiKey);

  // Resend supporte jusqu'à 50 destinataires par appel batch
  const BATCH_SIZE = 50;
  let sent = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    const messages = batch.map(to => ({
      from,
      to,
      subject,
      html,
      text: textContent,
    }));

    try {
      const result = await resend.batch.send(messages);
      console.log('Resend batch result:', JSON.stringify(result));

      if (result.error) {
        console.error('Resend error:', result.error);
        errors.push(result.error.message || 'Erreur batch Resend');
      } else {
        sent += batch.length;
      }
    } catch (err) {
      console.error('Resend exception:', err);
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
