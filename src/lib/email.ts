// Transactional email over HTTPS APIs (Brevo or SendGrid). No SMTP, no SDK dependencies.
//   EMAIL_PROVIDER=brevo|sendgrid   EMAIL_API_KEY=...   EMAIL_FROM_ADDRESS=noreply@your-domain   EMAIL_FROM_NAME=CampusCrew
// EMAIL_API_BASE_URL overrides the provider base URL (used by the automated tests).

export class EmailError extends Error {}

type Provider = 'brevo' | 'sendgrid';

export function emailProvider(): Provider | null {
  const p = (process.env.EMAIL_PROVIDER ?? '').toLowerCase();
  return p === 'brevo' || p === 'sendgrid' ? p : null;
}

export function emailConfigured(): boolean {
  return !!(emailProvider() && process.env.EMAIL_API_KEY && process.env.EMAIL_FROM_ADDRESS);
}

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }): Promise<void> {
  const provider = emailProvider();
  const key = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME || 'CampusCrew';
  if (!provider || !key || !from) throw new EmailError('Email delivery is not configured');

  const base = process.env.EMAIL_API_BASE_URL || (provider === 'brevo' ? 'https://api.brevo.com' : 'https://api.sendgrid.com');
  const req: { url: string; headers: Record<string, string>; body: unknown } = provider === 'brevo'
    ? {
        url: `${base}/v3/smtp/email`,
        headers: { 'api-key': key },
        body: { sender: { name: fromName, email: from }, to: [{ email: msg.to }], subject: msg.subject, textContent: msg.text, htmlContent: msg.html },
      }
    : {
        url: `${base}/v3/mail/send`,
        headers: { Authorization: `Bearer ${key}` },
        body: {
          personalizations: [{ to: [{ email: msg.to }] }], from: { email: from, name: fromName }, subject: msg.subject,
          content: [{ type: 'text/plain', value: msg.text }, { type: 'text/html', value: msg.html }],
        },
      };

  let res: Response;
  try {
    res = await fetch(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...req.headers },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new EmailError(`Email provider unreachable: ${(e as Error).message}`);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new EmailError(`Email provider rejected the message (${res.status}) ${detail}`);
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function otpEmail(code: string) {
  return {
    subject: `${code} is your CampusCrew verification code`,
    text: `Your CampusCrew verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't request it, you can ignore this email.\nNever share this code with anyone.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px"><h2 style="color:#312e81;margin:0 0 12px">CampusCrew</h2><p>Your verification code is</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:8px 0;color:#0f172a">${esc(code)}</p><p style="color:#475569">It expires in 10 minutes. If you didn't request it, you can safely ignore this email. Never share this code with anyone.</p></div>`,
  };
}

export function notice(subject: string, body: string) {
  return {
    subject,
    text: `${body}\n\n— CampusCrew, IIIT Allahabad`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px"><h2 style="color:#312e81;margin:0 0 12px">CampusCrew</h2><p style="color:#0f172a;line-height:1.5">${esc(body).replace(/\n/g, '<br>')}</p></div>`,
  };
}
