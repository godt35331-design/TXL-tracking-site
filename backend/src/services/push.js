import mongoose from 'mongoose';
import webpush from 'web-push';

// Browser push notifications for the admin's installed "TXL Inbox" app.
// Needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (create them once with: npx web-push generate-vapid-keys)

const subscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: String, auth: String },
  email: String
}, { timestamps: true });

const Subscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', subscriptionSchema);

// Used only when no database is connected (local development)
const memorySubs = new Map();
const usingDb = () => mongoose.connection.readyState === 1;

export const pushEnabled = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || `mailto:${process.env.ADMIN_EMAIL || 'admin@txlglobaltracking.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

export async function saveSubscription(sub, email) {
  if (!sub || typeof sub.endpoint !== 'string' || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    throw new Error('Invalid push subscription.');
  }
  const doc = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, email };
  if (usingDb()) {
    await Subscription.findOneAndUpdate({ endpoint: doc.endpoint }, doc, { upsert: true, new: true });
  } else {
    memorySubs.set(doc.endpoint, doc);
  }
}

export async function removeSubscription(endpoint) {
  if (usingDb()) {
    await Subscription.deleteOne({ endpoint });
  } else {
    memorySubs.delete(endpoint);
  }
}

async function allSubscriptions() {
  if (usingDb()) {
    return (await Subscription.find()).map(s => ({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }));
  }
  return [...memorySubs.values()];
}

// Send a notification to every device the admin has enabled; forget devices that no longer exist
export async function pushToAdmins({ title, body, url = '/#inbox', tag }) {
  if (!pushEnabled()) return;
  configure();
  const payload = JSON.stringify({ title, body: String(body || '').slice(0, 180), url, tag });
  const subs = await allSubscriptions();
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await removeSubscription(sub.endpoint).catch(() => {});
      } else {
        console.warn('[Push] Send failed:', err.statusCode || err.message);
      }
    }
  }));
}
