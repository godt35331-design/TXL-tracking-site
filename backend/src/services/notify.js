import crypto from 'crypto';

// Phone notifications through a Telegram bot. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to turn it on.
const token = () => process.env.TELEGRAM_BOT_TOKEN || '';
const chatId = () => String(process.env.TELEGRAM_CHAT_ID || '');

export const telegramEnabled = () => Boolean(token() && chatId());

export const telegramChatId = () => chatId();

// Telegram sends this value back in a header on every webhook call, so we can reject anyone else
export const telegramWebhookSecret = () =>
  process.env.TELEGRAM_WEBHOOK_SECRET || crypto.createHash('sha256').update(`txl-telegram:${token()}`).digest('hex').slice(0, 32);

async function telegram(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(`Telegram ${method} failed: ${data.description || res.status}`);
  }
  return data;
}

// Tell the admin's phone that a customer wrote in. The customer's email is kept in the text so a reply can be routed back.
export async function notifyAdminPhone({ customerName, customerEmail, trackingId, body, channel }) {
  if (!telegramEnabled()) return;
  const lines = [
    channel === 'email' ? 'New email from a customer' : 'New chat message',
    `From: ${customerName || 'Customer'} <${customerEmail}>`
  ];
  if (trackingId) lines.push(`Tracking: ${trackingId}`);
  lines.push('', String(body || '').slice(0, 1500), '', 'Reply to this message to answer the customer.');
  const text = lines.join('\n');

  await telegram('sendMessage', { chat_id: chatId(), text });
}

export async function sendTelegramText(text) {
  if (!telegramEnabled()) return;
  await telegram('sendMessage', { chat_id: chatId(), text });
}

// Point the bot at this server so replies typed on the phone come back to us
export async function setupTelegramWebhook() {
  if (!telegramEnabled()) {
    console.log('[Telegram] Not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing). Phone notifications are off.');
    return;
  }
  const base = (process.env.PUBLIC_BACKEND_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
  if (!base) {
    console.log('[Telegram] Notifications on. Set PUBLIC_BACKEND_URL to also receive replies from your phone.');
    return;
  }
  try {
    await telegram('setWebhook', {
      url: `${base}/api/telegram-webhook`,
      secret_token: telegramWebhookSecret(),
      allowed_updates: ['message']
    });
    console.log(`[Telegram] Webhook registered at ${base}/api/telegram-webhook`);
  } catch (err) {
    console.warn('[Telegram] Could not register webhook:', err.message);
  }
}
