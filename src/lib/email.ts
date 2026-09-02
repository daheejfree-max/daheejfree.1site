import nodemailer from 'nodemailer';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

let transporter: nodemailer.Transporter | null = null;

export function getEmailTransporter(): nodemailer.Transporter | null {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.zeptomail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.warn('[Email] SMTP_USER or SMTP_PASS not set. Emails will log to console in dev mode.');
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: true,
      },
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, from, cc, bcc }: SendEmailParams) {
  const mailClient = getEmailTransporter();
  const defaultFrom = process.env.SMTP_FROM || 'DaheejFree Notifications <noreply@daheejfree.site>';

  if (!mailClient) {
    const recipientStr = Array.isArray(to) ? to.join(', ') : to;
    const ccStr = cc ? ` | CC: ${Array.isArray(cc) ? cc.join(', ') : cc}` : '';
    console.info(`[Email Simulated] To: ${recipientStr}${ccStr} | Subject: ${subject}`);
    return { success: true, simulated: true };
  }

  try {
    const info = await mailClient.sendMail({
      from: from || defaultFrom,
      to,
      cc,
      bcc,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('[Email Error] Failed sending email:', error);
    return { success: false, error: error?.message };
  }
}

export async function notifyMatchProposalReceived({
  recipientEmail,
  waliEmail,
  senderName,
  senderCity,
  candidateName,
}: {
  recipientEmail: string;
  waliEmail?: string | null;
  senderName: string;
  senderCity?: string;
  candidateName?: string;
}) {
  const cleanWaliEmail = waliEmail?.trim();
  const ccList = (cleanWaliEmail && cleanWaliEmail.toLowerCase() !== recipientEmail.toLowerCase())
    ? [cleanWaliEmail]
    : undefined;

  return await sendEmail({
    to: recipientEmail,
    cc: ccList,
    subject: `New Nikah Proposal from ${senderName} on DaheejFree`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
          <div style="border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 20px;">
            <h1 style="color: #059669; font-size: 22px; margin: 0;">DaheejFree Matrimonial</h1>
            <p style="color: #6b7280; font-size: 12px; margin: 4px 0 0 0;">100% Dowry-Free Islamic Matrimonial Platform</p>
          </div>
          
          <p style="font-size: 15px; color: #1f2937;">Assalamu Alaikum wa Rahmatullahi wa Barakatuh,</p>
          
          <p style="font-size: 14px; color: #374151; line-height: 1.6;">
            ${cleanWaliEmail ? `<strong>Respected Guardian (Wali) & ${candidateName ? candidateName : 'Candidate'}:</strong><br/>` : ''}
            <strong>${senderName}</strong> ${senderCity ? `from ${senderCity}` : ''} has sent you a formal Nikah match proposal on DaheejFree.
          </p>
          
          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <p style="font-size: 13px; color: #065f46; margin: 0;">
              Both profiles are registered under our solemn Anti-Dowry (Bila-Daheej) pledge.
            </p>
          </div>

          ${cleanWaliEmail ? `
          <div style="background-color: #f0fdf4; border: 1px dashed #86efac; padding: 12px 16px; margin: 16px 0; border-radius: 8px;">
            <p style="font-size: 12px; color: #166534; margin: 0;">
              🛡️ <strong>Wali Notification Active:</strong> This proposal notification has been automatically routed to the registered Guardian email (${cleanWaliEmail}) in accordance with Islamic matchmaking etiquette.
            </p>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 28px 0;">
            <a href="https://daheejfree.site/dashboard" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 10px;">
              View Proposal & Profile
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
            © 2026 DaheejFree Platform • Strictly Dowry-Free Islamic Matrimony
          </p>
        </div>
      </body>
      </html>
    `,
  });
}
