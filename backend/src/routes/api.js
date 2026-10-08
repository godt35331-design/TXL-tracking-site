import express from 'express';
import { Customer, Shipment, Message } from '../db/models.js';
import { sendEmail } from '../services/emailService.js';
import { advanceShipmentSimulation } from '../services/simulationEngine.js';
import { notifyAdminPhone, sendTelegramText, telegramEnabled, telegramChatId, telegramWebhookSecret } from '../services/notify.js';
import { attachAuth, requireUser, requireAdmin, signToken, isLoginBlocked, recordLoginFailure, clearLoginFailures } from '../services/auth.js';

const router = express.Router();

// Every request gets req.auth (the signed-in user, or null)
router.use(attachAuth);

// WebSocket broadcast helper register (mounted from server.js)
let wssInstance = null;
export function setWssInstance(wss) {
  wssInstance = wss;
}

// Deliver a socket event only to admins, the owning customer, and (optionally) guests who subscribed to a shipment
function sendToClients(type, payload, { email, shipmentId } = {}) {
  if (!wssInstance) return;
  const message = JSON.stringify({ type, payload });
  const cleanEmail = (email || '').trim().toLowerCase();
  wssInstance.clients.forEach(client => {
    if (client.readyState !== 1) return; // OPEN
    const auth = client.auth;
    const allowed = (auth && auth.role === 'admin')
      || (cleanEmail && auth && (auth.email || '').toLowerCase() === cleanEmail)
      || (shipmentId && client.subscribed && client.subscribed.has(String(shipmentId).toUpperCase()));
    if (allowed) client.send(message);
  });
}

// Customers and guests never see internal admin notes
function publicShipment(shipment, auth) {
  const obj = typeof shipment.toObject === 'function' ? shipment.toObject() : { ...shipment };
  if (!auth || auth.role !== 'admin') delete obj.internalNotes;
  return obj;
}

export function broadcastShipmentUpdate(shipment) {
  sendToClients('SHIPMENT_UPDATE', publicShipment(shipment, null), {
    email: shipment.customerEmail,
    shipmentId: shipment.id
  });
}

// Push a customer message to the admin's phone (Telegram); never blocks or breaks the request
async function pingAdminPhone({ customerName, customerEmail, body, channel }) {
  if (!telegramEnabled()) return;
  try {
    const latest = await Shipment.findOne({ customerEmail: (customerEmail || '').toLowerCase() }).sort({ createdAt: -1 });
    await notifyAdminPhone({ customerName, customerEmail, trackingId: latest ? latest.id : '', body, channel });
  } catch (err) {
    console.warn('[Telegram] Notification failed:', err.message);
  }
}

// 1. Authentication Router API (tracking number only)
router.post('/auth/login', async (req, res) => {
  const { trackingId } = req.body;
  const ip = req.ip;

  if (!trackingId) {
    return res.status(400).json({ error: 'Tracking number is required.' });
  }
  if (isLoginBlocked(ip)) {
    return res.status(429).json({ error: 'Too many failed attempts. Please try again in 15 minutes.' });
  }

  const cleanTracking = String(trackingId).trim().toUpperCase();
  const adminTracking = (process.env.ADMIN_TRACKING_ID || '').trim().toUpperCase();

  if (adminTracking && cleanTracking === adminTracking) {
    clearLoginFailures(ip);
    const session = {
      email: (process.env.ADMIN_EMAIL || 'admin@txlglobaltracking.com').trim().toLowerCase(),
      name: 'TXL System Administrator',
      role: 'admin'
    };
    return res.json({ ...session, token: signToken(session) });
  }

  try {
    const shipment = await Shipment.findOne({ id: cleanTracking });
    if (!shipment) {
      recordLoginFailure(ip);
      return res.status(404).json({ error: 'Tracking number not found. Please check and try again.' });
    }
    clearLoginFailures(ip);
    const session = {
      email: (shipment.customerEmail || '').trim().toLowerCase(),
      name: shipment.customerName,
      role: 'customer'
    };
    return res.json({ ...session, token: signToken(session) });
  } catch (error) {
    console.error('Error logging in by tracking number:', error);
    return res.status(500).json({ error: 'Server authentication crash.' });
  }
});

// 2. Fetch Customer Shipments / Admin Directories (admin: all, customer: only their own)
router.get('/shipments', requireUser, async (req, res) => {
  try {
    const query = req.auth.role === 'admin' ? {} : { customerEmail: req.auth.email };

    const shipments = await Shipment.find(query).sort({ createdAt: -1 });
    // Autonomously advance any active real-time schedule simulations
    for (const s of shipments) {
      if (s.simulation && s.simulation.active && s.simulation.mode === 'realtime') {
        const changed = advanceShipmentSimulation(s);
        if (changed) await s.save();
      }
    }
    res.json(shipments.map(s => publicShipment(s, req.auth)));
  } catch (error) {
    console.error('Error retrieving shipments:', error);
    res.status(500).json({ error: 'Database read failure.' });
  }
});

// 3. Retrieve Single Shipment Details
router.get('/shipments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const shipment = await Shipment.findOne({ id: id.toUpperCase() });
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment ID not registered.' });
    }
    // Autonomously advance simulation if real-time active
    if (shipment.simulation && shipment.simulation.active && shipment.simulation.mode === 'realtime') {
      const changed = advanceShipmentSimulation(shipment);
      if (changed) await shipment.save();
    }
    res.json(publicShipment(shipment, req.auth));
  } catch (error) {
    console.error('Error searching shipment details:', error);
    res.status(500).json({ error: 'Database search fault.' });
  }
});

// 3b. Stream Package Photo Binary (for external email clients, Gmail proxy, and direct browser display)
router.get('/shipments/:id/image', async (req, res) => {
  const { id } = req.params;
  try {
    const shipment = await Shipment.findOne({ id: id.toUpperCase() });
    if (!shipment || !shipment.packageImage) {
      return res.status(404).send('No package image registered for this shipment.');
    }

    if (shipment.packageImage.startsWith('data:')) {
      const matches = shipment.packageImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
      }
    } else if (shipment.packageImage.startsWith('http')) {
      return res.redirect(shipment.packageImage);
    }

    res.status(404).send('Unrecognized image format.');
  } catch (error) {
    console.error('Error serving shipment package image:', error);
    res.status(500).send('Failed to retrieve package image.');
  }
});

// Keep only well-formed custom map places (waypoint code -> name + coordinates)
function sanitizeCustomPlaces(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const [code, p] of Object.entries(input).slice(0, 12)) {
    if (!/^[A-Z0-9]{3,10}$/.test(code) || !p || !Array.isArray(p.coords) || p.coords.length !== 2) continue;
    const [lat, lng] = p.coords.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    out[code] = {
      name: String(p.name || code).slice(0, 120),
      stateName: String(p.stateName || '').slice(0, 120),
      country: String(p.country || '').slice(0, 80),
      coords: [lat, lng]
    };
  }
  return out;
}

// Validate the delivery address map pin
function sanitizeDeliveryPoint(p) {
  if (!p || !Array.isArray(p.coords) || p.coords.length !== 2) return null;
  const [lat, lng] = p.coords.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { label: String(p.label || '').slice(0, 200), coords: [lat, lng] };
}

// 4. Admin Dispatch Appointment (Insert Cargo Row)
router.post('/shipments', requireAdmin, async (req, res) => {
  const sData = req.body;

  try {
    if (!sData || !sData.customerEmail || !sData.customerName || !sData.id) {
      return res.status(400).json({ error: 'Missing required shipment parameters.' });
    }

    // Check if tracking number already in database
    const existing = await Shipment.findOne({ id: sData.id.toUpperCase() });
    if (existing) {
      return res.status(400).json({ error: 'Tracking number code duplicate.' });
    }

    const newShipment = new Shipment({
      id: sData.id,
      customerName: sData.customerName,
      customerEmail: sData.customerEmail,
      customerPhone: sData.customerPhone,
      address: sData.address,
      weight: sData.weight,
      desc: sData.desc,
      vessel: sData.vessel,
      origin: sData.origin,
      destination: sData.destination,
      originCode: sData.originCode || 'FRA',
      destCode: sData.destCode || 'NYC',
      eta: sData.eta,
      packageImage: sData.packageImage || '',
      internalNotes: sData.internalNotes || '',
      customPlaces: sanitizeCustomPlaces(sData.customPlaces),
      deliveryPoint: sanitizeDeliveryPoint(sData.deliveryPoint),
      status: 'Registered',
      currentLocationName: `Scheduled for departure at ${sData.origin}`,
      simulation: {
        active: false,
        currentProgress: 0,
        waypoints: sData.waypoints || ['FRA', 'LHR', 'BOS', 'NYC'],
        speedMultiplier: 1,
        logs: 'Shipping appointment created in TXL database.'
      }
    });

    await newShipment.save();

    // Create or update the customer record (customers sign in with their tracking number, no password)
    const custEmail = sData.customerEmail.trim().toLowerCase();
    await Customer.findOneAndUpdate(
      { email: custEmail },
      { 
        $inc: { volume: 1 }, 
        name: sData.customerName
      },
      { upsert: true, new: true }
    );

    // Format response POJO to include credentials & packageImage
    const responsePayload = typeof newShipment.toObject === 'function' ? newShipment.toObject() : JSON.parse(JSON.stringify(newShipment));
    responsePayload.credentials = {
      email: custEmail,
      password: newShipment.id,
      trackingId: newShipment.id,
      packageImage: newShipment.packageImage || ''
    };

    // Save outbound registration message to Message collection in DB
    try {
      const regMsg = new Message({
        customerEmail: custEmail,
        customerName: sData.customerName,
        subject: `TXL Shipment Confirmation - #${newShipment.id}`,
        body: `Welcome to TXL Express Global Logistics.\n\nYour shipping appointment has been registered.\nTracking Number: #${newShipment.id}\nOrigin: ${newShipment.origin}\nDestination: ${newShipment.destination}\nStatus: Registered\n\nUse your tracking number to access your portal: ${newShipment.id}`,
        sender: 'admin',
        channel: 'email',
        read: true
      });
      await regMsg.save();
    } catch (msgErr) {
      console.warn('Could not save registration message to message history:', msgErr);
    }

    // Automatically send registration & credentials email to customer
    try {
      const welcomeMessage = `Your shipping appointment has been successfully registered with TXL Express Global Logistics.\n\nUse your tracking number below to access your Customer Portal and monitor your package live telemetry, along with your shipment overview.`;

      sendEmail({
        to: custEmail,
        recipientName: sData.customerName,
        subject: `TXL Shipment Confirmation - #${newShipment.id}`,
        messageBody: welcomeMessage,
        templateType: 'NEW_REGISTRATION',
        shipment: newShipment,
        packageImage: sData.packageImage || newShipment.packageImage || '',
        credentials: {
          email: custEmail,
          password: newShipment.id
        }
      }).catch(emailErr => {
        console.error('[AUTO EMAIL ERROR] Registration email failed to dispatch:', emailErr);
      });
    } catch (e) {
      console.error('Error triggering automated registration email:', e);
    }

    res.status(201).json(responsePayload);
  } catch (error) {
    console.error('Error registering cargo shipment:', error);
    res.status(500).json({ error: 'Database write error. Check parameter formats.' });
  }
});

// 5. Update Live Simulation Controls (Play, Pause, Stop, Waypoints, Logs, Status, Package Image)
router.put('/shipments/:id/simulation', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const shipment = await Shipment.findOne({ id: id.toUpperCase() });
    if (!shipment) {
      return res.status(404).json({ error: 'Target shipment not registered.' });
    }

    // Apply updates
    if (updates.status !== undefined) shipment.status = updates.status;
    if (updates.currentLocationName !== undefined) shipment.currentLocationName = updates.currentLocationName;
    if (updates.vessel !== undefined) shipment.vessel = updates.vessel;
    if (updates.packageImage !== undefined) shipment.packageImage = updates.packageImage;
    if (updates.internalNotes !== undefined) shipment.internalNotes = updates.internalNotes;
    if (updates.eta !== undefined) shipment.eta = updates.eta;
    
    if (updates.simulation) {
      if (updates.simulation.active !== undefined) shipment.simulation.active = updates.simulation.active;
      if (updates.simulation.mode !== undefined) shipment.simulation.mode = updates.simulation.mode;
      if (updates.simulation.durationDays !== undefined) shipment.simulation.durationDays = updates.simulation.durationDays;
      if (updates.simulation.startedAt !== undefined) shipment.simulation.startedAt = updates.simulation.startedAt;
      if (updates.simulation.targetCompletionDate !== undefined) shipment.simulation.targetCompletionDate = updates.simulation.targetCompletionDate;
      if (updates.simulation.startProgress !== undefined) shipment.simulation.startProgress = updates.simulation.startProgress;
      if (updates.simulation.currentProgress !== undefined) shipment.simulation.currentProgress = updates.simulation.currentProgress;
      if (updates.simulation.waypoints !== undefined) shipment.simulation.waypoints = updates.simulation.waypoints;
      if (updates.simulation.speedMultiplier !== undefined) shipment.simulation.speedMultiplier = updates.simulation.speedMultiplier;
      if (updates.simulation.logs !== undefined) shipment.simulation.logs = updates.simulation.logs;

      // If initiating or un-pausing realtime schedule mode
      if (shipment.simulation.active && shipment.simulation.mode === 'realtime') {
        if (!updates.simulation.startedAt && !shipment.simulation.startedAt) {
          shipment.simulation.startedAt = new Date().toISOString();
          shipment.simulation.startProgress = shipment.simulation.currentProgress || 0;
        }
        advanceShipmentSimulation(shipment);
      }
    }

    await shipment.save();

    // Broadcast live update to Socket channels!
    broadcastShipmentUpdate(shipment);

    res.json(shipment);
  } catch (error) {
    console.error('Simulation write error:', error);
    res.status(500).json({ error: 'Simulation save failed.' });
  }
});

// 5a. Admin edits the details of an existing shipment
router.put('/shipments/:id', requireAdmin, async (req, res) => {
  const b = req.body || {};
  try {
    const shipment = await Shipment.findOne({ id: req.params.id.toUpperCase() });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

    const text = (v, max = 300) => String(v).trim().slice(0, max);
    if (b.customerName !== undefined && text(b.customerName)) shipment.customerName = text(b.customerName, 120);
    if (b.customerPhone !== undefined && text(b.customerPhone)) shipment.customerPhone = text(b.customerPhone, 40);
    if (b.address !== undefined && text(b.address)) shipment.address = text(b.address);
    if (b.desc !== undefined && text(b.desc)) shipment.desc = text(b.desc, 1000);
    if (b.origin !== undefined && text(b.origin)) shipment.origin = text(b.origin);
    if (b.destination !== undefined && text(b.destination)) shipment.destination = text(b.destination);
    if (b.eta !== undefined && text(b.eta, 40)) shipment.eta = text(b.eta, 40);
    if (b.status !== undefined && text(b.status, 40)) shipment.status = text(b.status, 40);
    if (b.internalNotes !== undefined) shipment.internalNotes = text(b.internalNotes, 2000);
    if (b.vessel !== undefined) {
      if (!['Truck', 'Plane', 'Ship'].includes(b.vessel)) return res.status(400).json({ error: 'Invalid transport type.' });
      shipment.vessel = b.vessel;
    }
    if (b.weight !== undefined) {
      const w = Number(b.weight);
      if (!Number.isFinite(w) || w <= 0) return res.status(400).json({ error: 'Weight must be a positive number.' });
      shipment.weight = w;
    }

    // Changing the customer email moves the shipment between customer accounts
    if (b.customerEmail !== undefined && text(b.customerEmail)) {
      const newEmail = text(b.customerEmail, 200).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return res.status(400).json({ error: 'Enter a valid customer email.' });
      const oldEmail = (shipment.customerEmail || '').toLowerCase();
      if (newEmail !== oldEmail) {
        shipment.customerEmail = newEmail;
        await Customer.findOneAndUpdate({ email: newEmail }, { $inc: { volume: 1 }, name: shipment.customerName }, { upsert: true, new: true });
        await Customer.findOneAndUpdate({ email: oldEmail }, { $inc: { volume: -1 } });
        const oldCust = await Customer.findOne({ email: oldEmail });
        if (oldCust && oldCust.volume <= 0) await Customer.deleteOne({ email: oldEmail });
      }
    }

    await shipment.save();
    broadcastShipmentUpdate(shipment);
    res.json(publicShipment(shipment, req.auth));
  } catch (error) {
    console.error('Error editing shipment:', error);
    res.status(500).json({ error: 'Failed to save changes.' });
  }
});

// 5b. Add or replace the package photo of an existing shipment (optionally email it to the customer)
router.put('/shipments/:id/image', requireAdmin, async (req, res) => {
  const { packageImage, sendEmail: shouldEmail } = req.body;
  if (typeof packageImage !== 'string' || !/^data:image\/[a-z+.-]+;base64,/i.test(packageImage)) {
    return res.status(400).json({ error: 'A valid image is required.' });
  }
  if (packageImage.length > 12 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image is too large.' });
  }

  try {
    const shipment = await Shipment.findOne({ id: req.params.id.toUpperCase() });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

    shipment.packageImage = packageImage;
    await shipment.save();
    broadcastShipmentUpdate(shipment);

    let emailSent = false;
    let emailError = null;
    if (shouldEmail) {
      try {
        await sendEmail({
          to: shipment.customerEmail,
          recipientName: shipment.customerName,
          subject: `Package Photo - TXL Shipment #${shipment.id}`,
          messageBody: 'Here is the photo of your package as prepared for shipping. Use your tracking number below to follow it live in your portal.',
          shipment,
          packageImage,
          credentials: { email: shipment.customerEmail, password: shipment.id }
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('[PACKAGE PHOTO EMAIL FAILED]:', mailErr);
        emailError = mailErr.message;
      }
    }

    res.json({ success: true, shipment, emailSent, emailError });
  } catch (error) {
    console.error('Error saving package image:', error);
    res.status(500).json({ error: 'Failed to save package image.' });
  }
});

// 6. Fetch Admin Statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const totalShipments = await Shipment.countDocuments();
    const inTransit = await Shipment.countDocuments({ status: 'In Transit' });
    const delivered = await Shipment.countDocuments({ status: 'Delivered' });

    // Fetch lists
    const recentShipments = await Shipment.find().sort({ createdAt: -1 }).limit(10);
    const customers = await Customer.find().sort({ volume: -1 });
    const safeCustomers = customers.map(c => { const o = typeof c.toObject === 'function' ? c.toObject() : { ...c }; delete o.password; return o; });

    res.json({
      metrics: {
        customers: totalCustomers,
        shipments: totalShipments,
        transit: inTransit,
        delivered: delivered
      },
      recentShipments,
      customers: safeCustomers
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Stats computation crash.' });
  }
});

// 7. Delete Shipment (Admin Only)
router.delete('/shipments/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Shipment.findOneAndDelete({ id: id.toUpperCase() });
    if (!deleted) {
      return res.status(404).json({ error: 'Shipment not found.' });
    }
    
    // Decrease customer volume count
    const custEmail = deleted.customerEmail.trim().toLowerCase();
    await Customer.findOneAndUpdate(
      { email: custEmail },
      { $inc: { volume: -1 } }
    );
    
    // Delete customer if volume reaches 0
    const checkCust = await Customer.findOne({ email: custEmail });
    if (checkCust && checkCust.volume <= 0) {
      await Customer.deleteOne({ email: custEmail });
    }
    
    // Broadcast a deletion/update event via WebSocket
    sendToClients('SHIPMENT_DELETED', { id: id.toUpperCase() }, { email: deleted.customerEmail, shipmentId: deleted.id });

    res.json({ success: true, message: 'Shipment deleted successfully.' });
  } catch (error) {
    console.error('Error deleting shipment:', error);
    res.status(500).json({ error: 'Database delete failure.' });
  }
});

// 8. Admin Direct Email Dispatch Endpoint
router.post('/admin/send-email', requireAdmin, async (req, res) => {
  const { toEmail, recipientName, subject, messageBody, templateType, shipmentId } = req.body;

  if (!toEmail || !toEmail.trim()) {
    return res.status(400).json({ error: 'Recipient email address is required.' });
  }
  if (!messageBody || !messageBody.trim()) {
    return res.status(400).json({ error: 'Message body cannot be empty.' });
  }

  try {
    let shipmentData = null;
    if (shipmentId) {
      shipmentData = await Shipment.findOne({ id: shipmentId.toUpperCase() });
    }

    const targetEmail = toEmail.trim().toLowerCase();

    const result = await sendEmail({
      to: targetEmail,
      recipientName: recipientName,
      subject: subject,
      messageBody: messageBody,
      templateType: templateType,
      shipment: shipmentData,
      credentials: shipmentData ? { email: targetEmail, password: shipmentData.id } : undefined
    });

    res.json({
      success: true,
      message: result.simulated ? 'Email simulated in backend console.' : 'Email sent successfully via Resend API.',
      id: result.id
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch email.' });
  }
});

// --- INBOUND & MESSAGING SYSTEM ENDPOINTS ---

// Helper: Strip quoted email reply lines
function stripQuotedReplyText(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const cleanLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^On\s+.*wrote:\s*$/i.test(trimmed) ||
        /^On\s+.*<.*>:\s*$/i.test(trimmed) ||
        /^-+Original Message-+/i.test(trimmed) ||
        /^>/.test(trimmed)) {
      break;
    }
    cleanLines.push(line);
  }
  const result = cleanLines.join('\n').trim();
  return result || text.trim();
}

// 9. Inbound Webhook Endpoint (Resend / SendGrid / Mailgun / Cloudflare Worker Parse)
router.post('/inbound-email', async (req, res) => {
  const webhookSecret = process.env.INBOUND_WEBHOOK_SECRET;
  const isResendWebhook = Boolean(
    req.headers['svix-id'] || 
    req.headers['svix-signature'] || 
    req.headers['resend-signature'] || 
    (req.headers['user-agent'] && req.headers['user-agent'].toLowerCase().includes('resend'))
  );

  if (webhookSecret && !isResendWebhook) {
    const reqSecret = req.headers['x-webhook-secret'] || 
                      req.query.secret || 
                      req.body?.secret || 
                      req.headers['authorization']?.replace('Bearer ', '');
    if (reqSecret !== webhookSecret) {
      console.warn('[INBOUND WEBHOOK] Unauthorized request received (missing or invalid secret).');
      return res.status(401).json({ error: 'Unauthorized webhook secret.' });
    }
  }

  try {
    const rawReqBody = req.body || {};
    console.log('[INBOUND WEBHOOK RECEIVED]:', JSON.stringify(rawReqBody, null, 2));

    const payload = rawReqBody.data || rawReqBody.payload || rawReqBody;
    const domain = process.env.PORTAL_DOMAIN || 'txlglobaltracking.com';
    
    // Extract Sender Email
    let rawFrom = payload.from || payload.sender || payload.envelope?.from || payload.fromEmail || payload['stripped-prefix'] || '';
    if (typeof rawFrom === 'object' && rawFrom !== null) {
      rawFrom = rawFrom.email || rawFrom.address || '';
    }
    const emailMatch = String(rawFrom).match(/<([^>]+)>/);
    let senderEmail = emailMatch ? emailMatch[1] : String(rawFrom);
    senderEmail = senderEmail.trim().toLowerCase();

    if (!senderEmail || !senderEmail.includes('@')) {
      console.warn('[INBOUND WEBHOOK] Could not parse sender email address:', payload);
      return res.status(200).json({ success: true, warning: 'Unrecognized sender format.' });
    }

    // Extract Sender Name
    let fromName = payload.fromName || payload.senderName || payload.from?.name || '';
    if (!fromName && String(rawFrom).includes('<')) {
      fromName = String(rawFrom).split('<')[0].replace(/"/g, '').trim();
    }

    // Extract Subject & Body
    let subject = payload.subject || payload.headers?.Subject || payload.headers?.subject || 'Customer Inquiry';
    let rawBody = payload.text || payload['stripped-text'] || payload.body || payload.html || '';

    // If body is missing but email ID exists (Resend email.received sends metadata only), fetch full body from Resend
    const resendEmailId = payload.email_id || payload.emailId || payload.id;
    if ((!rawBody || !String(rawBody).trim()) && resendEmailId && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resendClient = new Resend(process.env.RESEND_API_KEY);
        let emailContent = null;
        if (resendClient.emails?.receiving?.get) {
          const resendRes = await resendClient.emails.receiving.get(resendEmailId);
          emailContent = resendRes.data || resendRes;
        } else if (resendClient.emails?.get) {
          const resendRes = await resendClient.emails.get(resendEmailId);
          emailContent = resendRes.data || resendRes;
        }
        if (emailContent) {
          rawBody = emailContent.text || emailContent.html || emailContent.body || '';
          if (emailContent.subject && subject === 'Customer Inquiry') {
            subject = emailContent.subject;
          }
        }
      } catch (err) {
        console.warn('[INBOUND WEBHOOK] Could not retrieve email body from Resend receiving API:', err.message);
      }
    }

    if (typeof rawBody !== 'string') rawBody = String(rawBody);

    // Strip HTML tags if body contains HTML
    if (rawBody.includes('<') && rawBody.includes('>')) {
      rawBody = rawBody.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                       .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                       .replace(/<br\s*[\/]?>/gi, '\n')
                       .replace(/<\/p>/gi, '\n')
                       .replace(/<[^>]+>/g, '');
    }

    const stripped = stripQuotedReplyText(rawBody);
    const cleanBody = stripped || rawBody.trim() || 'New message received from customer.';

    // Extract Message-ID & In-Reply-To
    const messageId = payload['message-id'] || payload.messageId || payload.headers?.['message-id'] || payload.id || `<msg-inbound-${Date.now()}@${domain}>`;
    const inReplyTo = payload['in-reply-to'] || payload.inReplyTo || payload.headers?.['in-reply-to'] || '';

    // Customer Lookup
    const existingCustomer = await Customer.findOne({ email: senderEmail });
    const customerName = existingCustomer?.name || fromName || senderEmail.split('@')[0];

    // Save Message
    const newMessage = new Message({
      customerEmail: senderEmail,
      customerName: customerName,
      subject: subject,
      body: cleanBody,
      sender: 'customer',
      read: false,
      messageId: messageId,
      inReplyTo: inReplyTo
    });

    await newMessage.save();

    // Broadcast over WebSocket
    sendToClients('NEW_MESSAGE', typeof newMessage.toObject === 'function' ? newMessage.toObject() : newMessage, { email: senderEmail });
    pingAdminPhone({ customerName, customerEmail: senderEmail, body: cleanBody, channel: 'email' });

    console.log(`[INBOUND EMAIL PROCESSED] Received message from ${senderEmail}`);
    return res.status(200).json({ success: true, id: newMessage._id });
  } catch (error) {
    console.error('[INBOUND EMAIL ERROR]:', error);
    return res.status(200).json({ success: false, error: error.message });
  }
});

// 10. Get Admin / Customer Messages (Email Messages only)
router.get('/messages', requireUser, async (req, res) => {
  const email = req.auth.role === 'admin' ? req.query.email : req.auth.email;
  try {
    let query = { channel: { $ne: 'insite' } };
    if (email) {
      query.customerEmail = email.trim().toLowerCase();
    }
    const sortOrder = email ? { createdAt: 1 } : { createdAt: -1 };
    const messages = await Message.find(query).sort(sortOrder);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to retrieve messages.' });
  }
});

// 11. Admin Reply to Customer Message (via Resend Email)
router.post('/admin/messages/reply', requireAdmin, async (req, res) => {
  const { customerEmail, customerName, subject, body, inReplyTo } = req.body;

  if (!customerEmail || !customerEmail.trim()) {
    return res.status(400).json({ error: 'Customer email is required.' });
  }
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Message body cannot be empty.' });
  }

  const cleanEmail = customerEmail.trim().toLowerCase();
  const domain = process.env.PORTAL_DOMAIN || 'txlglobaltracking.com';

  try {
    const formattedSubject = subject ? (subject.startsWith('Re:') ? subject : `Re: ${subject}`) : 'Re: Customer Inquiry';

    // 1. Save Admin Message to Database (channel: email)
    const adminMsg = new Message({
      customerEmail: cleanEmail,
      customerName: customerName || cleanEmail.split('@')[0],
      subject: formattedSubject,
      body: body.trim(),
      sender: 'admin',
      channel: 'email',
      read: true,
      messageId: `<msg-admin-${Date.now()}@${domain}>`,
      inReplyTo: inReplyTo || ''
    });

    await adminMsg.save();

    // 2. Dispatch Email via Resend
    let emailSent = false;
    let emailError = null;
    try {
      await sendEmail({
        to: cleanEmail,
        recipientName: customerName,
        subject: formattedSubject,
        messageBody: body.trim(),
        inReplyTo: inReplyTo
      });
      emailSent = true;
    } catch (mailErr) {
      console.error('[ADMIN REPLY EMAIL FAILED]:', mailErr);
      emailError = mailErr.message;
    }

    // 3. Broadcast WebSocket event
    sendToClients('NEW_MESSAGE', typeof adminMsg.toObject === 'function' ? adminMsg.toObject() : adminMsg, { email: cleanEmail });

    res.json({
      success: true,
      message: adminMsg,
      emailSent: emailSent,
      emailError: emailError
    });
  } catch (error) {
    console.error('Error recording admin reply:', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch reply.' });
  }
});

// 12. Mark Customer Email Messages as Read
router.put('/messages/read', requireUser, async (req, res) => {
  const customerEmail = req.auth.role === 'admin' ? req.body.customerEmail : req.auth.email;
  if (!customerEmail) {
    return res.status(400).json({ error: 'Customer email required.' });
  }

  try {
    const cleanEmail = customerEmail.trim().toLowerCase();
    await Message.updateMany(
      { customerEmail: cleanEmail, channel: { $ne: 'insite' }, sender: 'customer', read: false },
      { $set: { read: true } }
    );

    res.json({ success: true, message: `Marked email messages from ${cleanEmail} as read.` });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to update message read status.' });
  }
});

// --- IN-SITE LIVE CHAT ENDPOINTS ---

// 13. Get In-Site Messages (Dedicated In-Site Chat)
router.get('/insite-messages', requireUser, async (req, res) => {
  const email = req.auth.role === 'admin' ? req.query.email : req.auth.email;
  try {
    let query = { channel: 'insite' };
    if (email) {
      query.customerEmail = email.trim().toLowerCase();
    }
    const sortOrder = email ? { createdAt: 1 } : { createdAt: -1 };
    const messages = await Message.find(query).sort(sortOrder);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching in-site messages:', error);
    res.status(500).json({ error: 'Failed to retrieve in-site messages.' });
  }
});

// 14. Send In-Site Message (Customer or Admin)
router.post('/insite-messages/send', requireUser, async (req, res) => {
  const isAdmin = req.auth.role === 'admin';
  const { customerName, body } = req.body;
  const customerEmail = isAdmin ? req.body.customerEmail : req.auth.email;
  const sender = isAdmin ? 'admin' : 'customer';

  if (!customerEmail || !customerEmail.trim()) {
    return res.status(400).json({ error: 'Customer email is required.' });
  }
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Message body cannot be empty.' });
  }

  const cleanEmail = customerEmail.trim().toLowerCase();
  const validSender = sender === 'admin' ? 'admin' : 'customer';

  try {
    const newMsg = new Message({
      customerEmail: cleanEmail,
      customerName: customerName || (validSender === 'admin' ? 'TXL Logistics Support' : cleanEmail.split('@')[0]),
      subject: 'In-Site Support Chat',
      body: body.trim(),
      sender: validSender,
      channel: 'insite',
      read: false,
      messageId: `<insite-${Date.now()}@${cleanEmail}>`
    });

    await newMsg.save();

    // Broadcast over WebSocket for instant live delivery
    sendToClients('NEW_INSITE_MESSAGE', typeof newMsg.toObject === 'function' ? newMsg.toObject() : newMsg, { email: cleanEmail });

    if (validSender === 'customer') {
      pingAdminPhone({ customerName: newMsg.customerName, customerEmail: cleanEmail, body: newMsg.body, channel: 'chat' });
    }

    res.status(201).json({ success: true, message: newMsg });
  } catch (error) {
    console.error('Error sending in-site message:', error);
    res.status(500).json({ error: error.message || 'Failed to send in-site message.' });
  }
});

// 15. Mark In-Site Messages as Read
router.put('/insite-messages/read', requireUser, async (req, res) => {
  const isAdmin = req.auth.role === 'admin';
  const customerEmail = isAdmin ? req.body.customerEmail : req.auth.email;
  const reader = isAdmin ? 'admin' : 'customer';
  if (!customerEmail) {
    return res.status(400).json({ error: 'Customer email required.' });
  }

  const cleanEmail = customerEmail.trim().toLowerCase();
  const targetSender = reader === 'customer' ? 'admin' : 'customer';

  try {
    await Message.updateMany(
      { customerEmail: cleanEmail, channel: 'insite', sender: targetSender, read: false },
      { $set: { read: true } }
    );

    sendToClients('INSITE_MESSAGES_READ', { customerEmail: cleanEmail, reader: reader || 'admin' }, { email: cleanEmail });

    res.json({ success: true, message: `Marked in-site messages for ${cleanEmail} as read.` });
  } catch (error) {
    console.error('Error marking in-site messages read:', error);
    res.status(500).json({ error: 'Failed to update in-site message status.' });
  }
});

// 16. Telegram webhook: replies typed on the admin's phone go back into the customer's chat
router.post('/telegram-webhook', async (req, res) => {
  // Always answer 200 so Telegram does not keep retrying
  if (!telegramEnabled() || req.headers['x-telegram-bot-api-secret-token'] !== telegramWebhookSecret()) {
    return res.status(200).json({ ok: false });
  }

  try {
    const msg = req.body && req.body.message;
    if (!msg || !msg.text || String(msg.chat && msg.chat.id) !== telegramChatId()) {
      return res.status(200).json({ ok: true });
    }

    const quoted = msg.reply_to_message && msg.reply_to_message.text;
    const match = quoted && quoted.match(/<([^>\s]+@[^>\s]+)>/);
    if (!match) {
      await sendTelegramText('To answer a customer, long-press their notification and use Reply.');
      return res.status(200).json({ ok: true });
    }

    const customerEmail = match[1].toLowerCase();
    const customer = await Customer.findOne({ email: customerEmail });
    const adminMsg = new Message({
      customerEmail,
      customerName: customer ? customer.name : 'TXL Logistics Support',
      subject: 'In-Site Support Chat',
      body: msg.text.trim().slice(0, 4000),
      sender: 'admin',
      channel: 'insite',
      read: false,
      messageId: `<insite-${Date.now()}@${customerEmail}>`
    });
    await adminMsg.save();
    sendToClients('NEW_INSITE_MESSAGE', typeof adminMsg.toObject === 'function' ? adminMsg.toObject() : adminMsg, { email: customerEmail });
    await sendTelegramText(`Sent to ${customerEmail}`);
  } catch (err) {
    console.error('[Telegram] Webhook error:', err);
  }
  res.status(200).json({ ok: true });
});

export default router;

