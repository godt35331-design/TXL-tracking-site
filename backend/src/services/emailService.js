import 'dotenv/config';
import { Resend } from 'resend';

const getResendClient = () => {
  return new Resend(process.env.RESEND_API_KEY);
};

/**
 * Clean corporate email layout with TXL Express brand identity (TXL Navy #0F172A & TXL Orange #FF6B00)
 */
function buildHtmlEmail({ recipientName, title, message, trackingNumber, status, origin, destination, credentials, packageImage }) {
  const domain = process.env.PORTAL_DOMAIN || 'txlglobaltracking.com';
  const supportEmail = process.env.FROM_EMAIL?.includes('<') 
    ? process.env.FROM_EMAIL.match(/<([^>]+)>/)[1] 
    : (process.env.FROM_EMAIL || `support@${domain}`);
  const siteUrl = `https://www.${domain}/#login`;
  const backendBase = (process.env.BACKEND_URL || (process.env.PORTAL_DOMAIN ? `https://${process.env.PORTAL_DOMAIN}` : '') || 'https://dhl-shipping-express.onrender.com').replace(/\/$/, '');

  // If backend base is a public HTTPS domain, use the streaming endpoint for webmail compatibility (e.g. Gmail proxy)
  let imageDisplaySrc = packageImage;
  if (packageImage && trackingNumber && backendBase && !backendBase.includes('localhost')) {
    imageDisplaySrc = `${backendBase}/api/shipments/${trackingNumber}/image`;
  }

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 30px 15px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
    <div style="max-width: 580px; margin: 0 auto;">
      
      <!-- Top TXL Brand Header Bar -->
      <div style="background-color: #0F172A; border-radius: 8px 8px 0 0; padding: 20px 24px; text-align: left; display: flex; align-items: center; border-bottom: 3px solid #FF6B00;">
        <span style="font-size: 26px; font-weight: 900; font-style: italic; color: #FFFFFF; letter-spacing: 1.5px; font-family: 'Arial Black', Impact, sans-serif;">TXL</span>
        <span style="font-size: 16px; font-weight: 700; color: #FF6B00; margin-left: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Express Logistics</span>
      </div>

      <!-- Main Content Card -->
      <div style="background-color: #ffffff; border-radius: 0 0 8px 8px; padding: 32px; margin-bottom: 16px; border: 1px solid #e2e8f0; border-top: none; box-shadow: 0 4px 12px rgba(15,23,42,0.06);">
        
        <p style="font-size: 16px; color: #0f172a; margin-top: 0; margin-bottom: 18px; font-weight: 700;">
          Dear ${recipientName || 'Valued Customer'},
        </p>

        <div style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
          ${message.replace(/\n/g, '<br/>')}
        </div>

        ${credentials ? `
        <!-- Credentials Box -->
        <div style="background-color: #FFF7ED; border-left: 4px solid #FF6B00; border: 1px solid #FFEDD5; border-left-width: 4px; border-radius: 4px; padding: 18px; margin-bottom: 24px; font-size: 14px;">
          <div style="font-weight: 800; color: #EA580C; margin-bottom: 10px; text-transform: uppercase; font-size: 13px; letter-spacing: 0.5px;">🔐 Customer Portal Credentials</div>
          <div style="margin-bottom: 8px; color: #0f172a;"><strong>Portal Username / Email:</strong> <span style="font-family: monospace; font-size: 14px; background: #ffffff; padding: 3px 8px; border-radius: 3px; border: 1px solid #E2E8F0;">${credentials.email}</span></div>
          <div style="color: #0f172a;"><strong>Access Password:</strong> <span style="font-family: monospace; font-weight: 800; background: #FF6B00; padding: 3px 8px; border-radius: 3px; color: #ffffff;">${credentials.password}</span></div>
        </div>
        ` : ''}

        ${packageImage ? `
        <!-- Verified Package Intake Photo Card (Under Credentials) -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <div style="font-weight: 800; color: #0F172A; margin-bottom: 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
            📸 Verified Package Intake Photo
          </div>
          <div style="display: inline-block; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(15,23,42,0.08); background: #ffffff; max-width: 100%;">
            <img src="${imageDisplaySrc}" alt="Verified Package Intake Photo" style="max-width: 100%; width: 440px; max-height: 320px; display: block; object-fit: contain; margin: 0 auto;" />
          </div>
          <div style="margin-top: 10px; font-size: 11px; color: #64748B;">
            Intake photograph registered at carrier cargo facility &bull; Tracking ID #${trackingNumber || ''}
          </div>
        </div>
        ` : ''}

        ${trackingNumber ? `
        <!-- Tracking Summary Box -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px; margin-bottom: 24px; font-size: 14px;">
          <div style="margin-bottom: 8px; color: #0f172a;"><strong>Tracking Code:</strong> <span style="font-family: monospace; font-weight: 800; color: #FF6B00; font-size: 15px;">${trackingNumber}</span></div>
          ${status ? `<div style="margin-bottom: 8px; color: #0f172a;"><strong>Live Status:</strong> <span style="font-weight: 600; color: #10B981; text-transform: uppercase;">${status}</span></div>` : ''}
          ${origin || destination ? `<div style="color: #64748b;"><strong>Route Transit:</strong> ${origin || 'N/A'} &rarr; ${destination || 'N/A'}</div>` : ''}
        </div>
        ` : ''}

        <!-- Track Shipment CTA Button -->
        <div style="margin-top: 28px; text-align: center;">
          <a href="${siteUrl}" style="display: inline-block; background-color: #FF6B00; color: #ffffff; font-weight: 800; font-size: 15px; padding: 14px 32px; border-radius: 6px; text-decoration: none; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3);">
            Track Your Shipment Live &rarr;
          </a>
        </div>

      </div>

      <!-- Contact & Legal Footer Card -->
      <div style="background-color: #ffffff; border-radius: 6px; padding: 20px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; box-shadow: 0 2px 6px rgba(15,23,42,0.03); text-align: center;">
        <p style="margin: 0 0 6px 0; font-weight: 800; color: #0f172a; font-size: 13px;">TXL Express Global Logistics Services</p>
        <p style="margin: 0 0 4px 0;">Official Automated Shipment Notification</p>
        <p style="margin: 0 0 4px 0;">Customer Portal: <a href="${siteUrl}" style="color: #FF6B00; font-weight: 600; text-decoration: underline;">${domain}</a></p>
        <p style="margin: 0; color: #94a3b8;">Support Desk: ${supportEmail}</p>
        <div style="margin-top: 12px; border-top: 1px solid #f1f5f9; padding-top: 10px; font-size: 11px; color: #94a3b8;">
          &copy; ${new Date().getFullYear()} TXL Express Global Logistics. All rights reserved.
        </div>
      </div>

    </div>
  </body>
  </html>
  `;
}

/**
 * Main email sender service
 */
export async function sendEmail({ to, recipientName, subject, messageBody, templateType, shipment, credentials, packageImage, inReplyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const domain = process.env.PORTAL_DOMAIN || 'txlglobaltracking.com';
  const fromEmail = process.env.FROM_EMAIL || `TXL Express Support <support@${domain}>`;
  const supportEmail = fromEmail.includes('<') ? fromEmail.match(/<([^>]+)>/)[1] : fromEmail;

  let emailSubject = subject || 'Update regarding your TXL Shipment';
  let trackingCode = shipment?.id || '';
  let status = shipment?.status || '';
  let origin = shipment?.origin || '';
  let destination = shipment?.destination || '';
  const imgToUse = packageImage || shipment?.packageImage || '';

  if (templateType === 'OUT_FOR_DELIVERY') {
    emailSubject = subject || `Out for Delivery: TXL Package #${trackingCode}`;
  } else if (templateType === 'SHIPMENT_UPDATE') {
    emailSubject = subject || `Shipment Update: TXL Package #${trackingCode}`;
  } else if (templateType === 'DELAY_NOTICE') {
    emailSubject = subject || `Important Notice: Update on TXL Package #${trackingCode}`;
  } else if (templateType === 'NEW_REGISTRATION') {
    emailSubject = subject || `TXL Shipment Confirmation & Credentials - #${trackingCode}`;
  }

  const html = buildHtmlEmail({
    recipientName: recipientName || to.split('@')[0],
    title: emailSubject,
    message: messageBody,
    trackingNumber: trackingCode,
    status: status,
    origin: origin,
    destination: destination,
    credentials: credentials,
    packageImage: imgToUse
  });

  const textContent = `Dear ${recipientName || 'Customer'},\n\n${messageBody}\n\n${credentials ? `CUSTOMER PORTAL CREDENTIALS:\nUsername: ${credentials.email}\nPassword: ${credentials.password}\n\n` : ''}${trackingCode ? `SHIPMENT DETAILS:\nTracking Code: ${trackingCode}\nStatus: ${status || 'IN TRANSIT'}\nRoute: ${origin || 'N/A'} -> ${destination || 'N/A'}\n` : ''}\nTrack Shipment: https://www.${domain}/#login\n\nTXL Express Global Logistics Services\nWebsite: https://www.${domain}/#login\nEmail: ${supportEmail}`;

  try {
    const resend = new Resend(apiKey);
    const emailHeaders = {
      'X-Entity-Ref-ID': `TXL-MSG-${Date.now()}`
    };
    if (inReplyTo) {
      emailHeaders['In-Reply-To'] = inReplyTo;
      emailHeaders['References'] = inReplyTo;
    }

    const replyToAddress = process.env.REPLY_TO_EMAIL || supportEmail;

    const emailOptions = {
      from: fromEmail,
      to: [to],
      replyTo: replyToAddress,
      subject: emailSubject,
      text: textContent,
      html: html,
      headers: emailHeaders
    };

    // Attach image file to email if base64 data URL
    if (imgToUse && imgToUse.startsWith('data:')) {
      const matches = imgToUse.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches) {
        const mime = matches[1] || 'image/jpeg';
        const ext = mime.includes('png') ? 'png' : 'jpg';
        emailOptions.attachments = [{
          filename: `package-${trackingCode || 'intake'}.${ext}`,
          content: matches[2]
        }];
      }
    }

    const response = await resend.emails.send(emailOptions);

    console.log(`[RESEND EMAIL SUCCESS] Successfully sent email to ${to}:`, response);
    return response;
  } catch (error) {
    console.error(`[RESEND EMAIL FAILED] Error sending email to ${to}:`, error.message);
    throw error;
  }
}
