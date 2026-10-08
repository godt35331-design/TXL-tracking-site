import crypto from 'crypto';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret() {
  return process.env.SESSION_SECRET
    || crypto.createHash('sha256')
      .update(`txl-session:${process.env.ADMIN_TRACKING_ID || ''}:${process.env.MONGODB_URI || ''}`)
      .digest('hex');
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (body) => crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');

export function signToken({ email, name, role }) {
  const body = b64(JSON.stringify({ email, name, role, exp: Date.now() + SESSION_TTL_MS }));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return { email: data.email, name: data.name, role: data.role };
  } catch {
    return null;
  }
}

// Reads "Authorization: Bearer <token>" and attaches req.auth (or null)
export function attachAuth(req, res, next) {
  const header = req.headers.authorization || '';
  req.auth = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
  next();
}

export function requireUser(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (req.auth.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}

// Failed-login throttle: 10 failures per 15 minutes per IP
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

export function isLoginBlocked(ip) {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (entry.reset < Date.now()) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordLoginFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || entry.reset < Date.now()) {
    failures.set(ip, { count: 1, reset: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(ip) {
  failures.delete(ip);
}
