import 'dotenv/config';
import { Resend } from 'resend';

const getResendClient = () => {
  return new Resend(process.env.RESEND_API_KEY);
};

/**
 * Clean corporate email layout. One brand color (TXL Navy #0F172A) with neutral greys, no icons or emoji.
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

  const NAVY = '#0F172A';
  const label = 'font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 30px 15px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${NAVY}; line-height: 1.6;">
    <div style="max-width: 580px; margin: 0 auto;">

      <!-- Header -->
      <div style="background-color: ${NAVY}; border-radius: 6px 6px 0 0; padding: 22px 32px;">
        <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 2px;">TXL</span>
        <span style="font-size: 13px; font-weight: 600; color: #cbd5e1; margin-left: 10px; text-transform: uppercase; letter-spacing: 1.5px;">Express Logistics</span>
      </div>

      <!-- Main Content -->
      <div style="background-color: #ffffff; border-radius: 0 0 6px 6px; padding: 32px; margin-bottom: 16px; border: 1px solid #e2e8f0; border-top: none;">

        <p style="font-size: 16px; color: ${NAVY}; margin: 0 0 16px 0; font-weight: 600;">
          Dear ${recipientName || 'Valued Customer'},
        </p>

        <div style="font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 28px;">
          ${message.replace(/\n/g, '<br/>')}
        </div>

        ${credentials ? `
        <!-- Portal access -->
        <div style="border: 1px solid #e2e8f0; border-left: 4px solid ${NAVY}; border-radius: 4px; padding: 16px 20px; margin-bottom: 20px;">
          <p style="${label}">Your Tracking Number</p>
          <p style="margin: 0 0 6px 0; font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; color: ${NAVY}; letter-spacing: 1px;">${credentials.password}</p>
          <p style="margin: 0; font-size: 13px; color: #64748b;">Enter this number on our website to open your portal.</p>
        </div>
        ` : ''}

        ${packageImage ? `
        <!-- Package photo -->
        <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 16px 20px; margin-bottom: 20px; text-align: center;">
          <p style="${label} text-align: left;">Package Photo</p>
          <img src="${imageDisplaySrc}" alt="Package photo" style="max-width: 100%; width: 440px; max-height: 320px; display: block; object-fit: contain; margin: 0 auto; border-radius: 4px;" />
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b; text-align: left;">Photographed at our facility. Tracking number ${trackingNumber || ''}</p>
        </div>
        ` : ''}

        ${trackingNumber ? `
        <!-- Shipment details -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 24px; font-size: 14px;">
          <tr>
            <td style="padding: 12px 20px; color: #64748b; width: 40%; border-bottom: 1px solid #e2e8f0;">Tracking number</td>
            <td style="padding: 12px 20px; color: ${NAVY}; font-weight: 600; border-bottom: 1px solid #e2e8f0; font-family: 'Courier New', monospace;">${trackingNumber}</td>
          </tr>
          ${status ? `<tr>
            <td style="padding: 12px 20px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Status</td>
            <td style="padding: 12px 20px; color: ${NAVY}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${status}</td>
          </tr>` : ''}
          ${origin || destination ? `<tr>
            <td style="padding: 12px 20px; color: #64748b;">Route</td>
            <td style="padding: 12px 20px; color: ${NAVY}; font-weight: 600;">${origin || 'N/A'} to ${destination || 'N/A'}</td>
          </tr>` : ''}
        </table>
        ` : ''}

        <!-- Call to action -->
        <div style="margin-top: 28px; text-align: center;">
          <a href="${siteUrl}" style="display: inline-block; background-color: ${NAVY}; color: #ffffff; font-weight: 600; font-size: 14px; padding: 14px 36px; border-radius: 4px; text-decoration: none; letter-spacing: 0.5px;">
            Track Your Shipment
          </a>
        </div>

      </div>

      <!-- Footer -->
      <div style="padding: 16px 20px; font-size: 12px; color: #64748b; text-align: center;">
        <p style="margin: 0 0 4px 0; font-weight: 700; color: ${NAVY};">TXL Express Global Logistics</p>
        <p style="margin: 0 0 4px 0;">Customer portal: <a href="${siteUrl}" style="color: ${NAVY}; text-decoration: underline;">${domain}</a></p>
        <p style="margin: 0 0 10px 0;">Support: ${supportEmail}</p>
        <p style="margin: 0; color: #94a3b8;">&copy; ${new Date().getFullYear()} TXL Express Global Logistics. All rights reserved.</p>
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
    emailSubject = subject || `TXL Shipment Confirmation - #${trackingCode}`;
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

  const textContent = `Dear ${recipientName || 'Customer'},\n\n${messageBody}\n\n${credentials ? `YOUR TRACKING NUMBER (use it to access your portal): ${credentials.password}\n\n` : ''}${trackingCode ? `SHIPMENT DETAILS:\nTracking Code: ${trackingCode}\nStatus: ${status || 'IN TRANSIT'}\nRoute: ${origin || 'N/A'} -> ${destination || 'N/A'}\n` : ''}\nTrack Shipment: https://www.${domain}/#login\n\nTXL Express Global Logistics Services\nWebsite: https://www.${domain}/#login\nEmail: ${supportEmail}`;

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
