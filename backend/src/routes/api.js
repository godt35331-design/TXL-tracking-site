import express from 'express';
import { Customer, Shipment, Message } from '../db/models.js';
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

// WebSocket broadcast helper register (mounted from server.js)
let wssInstance = null;
export function setWssInstance(wss) {
  wssInstance = wss;
}

function broadcastShipmentUpdate(shipment) {
  if (!wssInstance) return;
  const message = JSON.stringify({
    type: 'SHIPMENT_UPDATE',
    payload: shipment
  });
  
  wssInstance.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// 1. Authentication Router API
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'admin@txlglobaltracking.com').trim().toLowerCase();

  try {
    if (cleanEmail === configuredAdminEmail || cleanEmail === 'admin@txlglobaltracking.com' || cleanEmail === 'admin@dhl.com') {
      const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
      if (password !== adminPass) {
        return res.status(401).json({ error: 'Invalid password credentials for Administrator.' });
      }
      return res.json({
        email: cleanEmail,
        name: 'TXL System Administrator',
        role: 'admin'
      });
    }

    // Lookup customer in MongoDB
    const customer = await Customer.findOne({ email: cleanEmail });
    if (customer) {
      const customerPass = customer.password || 'txl123';
      if (password !== customerPass) {
        return res.status(401).json({ error: 'Invalid password credentials for Customer.' });
      }
      return res.json({
        email: customer.email,
        name: customer.name,
        role: 'customer'
      });
    }

    return res.status(401).json({ error: 'Unauthorized credentials.' });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Server authentication crash.' });
  }
});

// 2. Fetch Customer Shipments / Admin Directories
router.get('/shipments', async (req, res) => {
  const { email } = req.query;
  const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'admin@txlglobaltracking.com').trim().toLowerCase();

  try {
    let query = {};
    if (email && email.trim().toLowerCase() !== configuredAdminEmail && email.trim().toLowerCase() !== 'admin@txlglobaltracking.com' && email.trim().toLowerCase() !== 'admin@dhl.com') {
      query.customerEmail = email.trim().toLowerCase();
    }
    
    const shipments = await Shipment.find(query).sort({ createdAt: -1 });
    res.json(shipments);
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
    res.json(shipment);
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

// 4. Admin Dispatch Appointment (Insert Cargo Row)
router.post('/shipments', async (req, res) => {
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

    // Check if customer already exists, fetch password if they do, or generate a new one
    const custEmail = sData.customerEmail.trim().toLowerCase();
    let existingCustomer = await Customer.findOne({ email: custEmail });
    let password = '';
    
    if (existingCustomer && existingCustomer.password) {
      password = existingCustomer.password;
    } else {
      // Auto-generate a readable 8-character password
      password = Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    // Create or update Customer volume and password
    await Customer.findOneAndUpdate(
      { email: custEmail },
      { 
        $inc: { volume: 1 }, 
        name: sData.customerName,
        password: password
      },
      { upsert: true, new: true }
    );

    // Format response POJO to include credentials & packageImage
    const responsePayload = typeof newShipment.toObject === 'function' ? newShipment.toObject() : JSON.parse(JSON.stringify(newShipment));
    responsePayload.credentials = {
      email: custEmail,
      password: password,
      trackingId: newShipment.id,
      packageImage: newShipment.packageImage || ''
    };

    // Save outbound registration message to Message collection in DB
    try {
      const regMsg = new Message({
        customerEmail: custEmail,
        customerName: sData.customerName,
        subject: `TXL Shipment Confirmation & Credentials - #${newShipment.id}`,
        body: `Welcome to TXL Express Global Logistics.\n\nYour shipping appointment has been registered.\nTracking Number: #${newShipment.id}\nOrigin: ${newShipment.origin}\nDestination: ${newShipment.destination}\nStatus: Registered\n\nCustomer Portal Login:\nUsername: ${custEmail}\nPassword: ${password}`,
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
      const welcomeMessage = `Your shipping appointment has been successfully registered with TXL Express Global Logistics.\n\nBelow are your Customer Portal login credentials to monitor your package live telemetry, along with your shipment overview.`;

      sendEmail({
        to: custEmail,
        recipientName: sData.customerName,
        subject: `TXL Shipment Confirmation & Credentials - #${newShipment.id}`,
        messageBody: welcomeMessage,
        templateType: 'NEW_REGISTRATION',
        shipment: newShipment,
        packageImage: sData.packageImage || newShipment.packageImage || '',
        credentials: {
          email: custEmail,
          password: password
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
router.put('/shipments/:id/simulation', async (req, res) => {
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
    
    if (updates.simulation) {
      if (updates.simulation.active !== undefined) shipment.simulation.active = updates.simulation.active;
      if (updates.simulation.currentProgress !== undefined) shipment.simulation.currentProgress = updates.simulation.currentProgress;
      if (updates.simulation.waypoints !== undefined) shipment.simulation.waypoints = updates.simulation.waypoints;
      if (updates.simulation.speedMultiplier !== undefined) shipment.simulation.speedMultiplier = updates.simulation.speedMultiplier;
      if (updates.simulation.logs !== undefined) shipment.simulation.logs = updates.simulation.logs;
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

// 6. Fetch Admin Statistics
router.get('/stats', async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const totalShipments = await Shipment.countDocuments();
    const inTransit = await Shipment.countDocuments({ status: 'In Transit' });
    const delivered = await Shipment.countDocuments({ status: 'Delivered' });

    // Fetch lists
    const recentShipments = await Shipment.find().sort({ createdAt: -1 }).limit(10);
    const customers = await Customer.find().sort({ volume: -1 });

    res.json({
      metrics: {
        customers: totalCustomers,
        shipments: totalShipments,
        transit: inTransit,
        delivered: delivered
      },
      recentShipments,
      customers
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Stats computation crash.' });
  }
});

// 7. Delete Shipment (Admin Only)
router.delete('/shipments/:id', async (req, res) => {
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
    if (wssInstance) {
      const message = JSON.stringify({
        type: 'SHIPMENT_DELETED',
        payload: { id: id.toUpperCase() }
      });
      wssInstance.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    }

    res.json({ success: true, message: 'Shipment deleted successfully.' });
  } catch (error) {
    console.error('Error deleting shipment:', error);
    res.status(500).json({ error: 'Database delete failure.' });
  }
});

// 8. Admin Direct Email Dispatch Endpoint
router.post('/admin/send-email', async (req, res) => {
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
    const customerUser = await Customer.findOne({ email: targetEmail });
    const customerPass = customerUser?.password || 'txl123';

    const result = await sendEmail({
      to: targetEmail,
      recipientName: recipientName,
      subject: subject,
      messageBody: messageBody,
      templateType: templateType,
      shipment: shipmentData,
      credentials: {
        email: targetEmail,
        password: customerPass
      }
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
    if (wssInstance) {
      const msgObj = typeof newMessage.toObject === 'function' ? newMessage.toObject() : newMessage;
      const wsMessage = JSON.stringify({ type: 'NEW_MESSAGE', payload: msgObj });
      wssInstance.clients.forEach(c => {
        if (c.readyState === 1) c.send(wsMessage);
      });
    }

    console.log(`[INBOUND EMAIL PROCESSED] Received message from ${senderEmail}`);
    return res.status(200).json({ success: true, id: newMessage._id });
  } catch (error) {
    console.error('[INBOUND EMAIL ERROR]:', error);
    return res.status(200).json({ success: false, error: error.message });
  }
});

// 10. Get Admin / Customer Messages (Email Messages only)
router.get('/messages', async (req, res) => {
  const { email } = req.query;
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
router.post('/admin/messages/reply', async (req, res) => {
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
    if (wssInstance) {
      const msgObj = typeof adminMsg.toObject === 'function' ? adminMsg.toObject() : adminMsg;
      const wsMessage = JSON.stringify({ type: 'NEW_MESSAGE', payload: msgObj });
      wssInstance.clients.forEach(c => {
        if (c.readyState === 1) c.send(wsMessage);
      });
    }

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
router.put('/messages/read', async (req, res) => {
  const { customerEmail } = req.body;
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
router.get('/insite-messages', async (req, res) => {
  const { email } = req.query;
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
router.post('/insite-messages/send', async (req, res) => {
  const { customerEmail, customerName, body, sender } = req.body;

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
    if (wssInstance) {
      const msgObj = typeof newMsg.toObject === 'function' ? newMsg.toObject() : newMsg;
      const wsMessage = JSON.stringify({ type: 'NEW_INSITE_MESSAGE', payload: msgObj });
      wssInstance.clients.forEach(c => {
        if (c.readyState === 1) c.send(wsMessage);
      });
    }

    res.status(201).json({ success: true, message: newMsg });
  } catch (error) {
    console.error('Error sending in-site message:', error);
    res.status(500).json({ error: error.message || 'Failed to send in-site message.' });
  }
});

// 15. Mark In-Site Messages as Read
router.put('/insite-messages/read', async (req, res) => {
  const { customerEmail, reader } = req.body;
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

    if (wssInstance) {
      const wsMessage = JSON.stringify({
        type: 'INSITE_MESSAGES_READ',
        payload: { customerEmail: cleanEmail, reader: reader || 'admin' }
      });
      wssInstance.clients.forEach(c => {
        if (c.readyState === 1) c.send(wsMessage);
      });
    }

    res.json({ success: true, message: `Marked in-site messages for ${cleanEmail} as read.` });
  } catch (error) {
    console.error('Error marking in-site messages read:', error);
    res.status(500).json({ error: 'Failed to update in-site message status.' });
  }
});

export default router;
