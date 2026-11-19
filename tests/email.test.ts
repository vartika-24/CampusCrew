import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { emailConfigured, otpEmail, sendEmail } from '../src/lib/email';

function mock(status = 201) {
  const seen: { url?: string; headers: http.IncomingHttpHeaders; body: any }[] = [];
  const server = http.createServer((req, res) => {
    let raw = ''; req.on('data', (c) => (raw += c));
    req.on('end', () => { seen.push({ url: req.url, headers: req.headers, body: JSON.parse(raw) }); res.statusCode = status; res.end('{}'); });
  });
  return new Promise<{ seen: typeof seen; base: string; close: () => void }>((resolve) => server.listen(0, () => resolve({ seen, base: `http://127.0.0.1:${(server.address() as any).port}`, close: () => server.close() })));
}

test('Brevo request shape', async () => {
  const m = await mock();
  Object.assign(process.env, { EMAIL_PROVIDER: 'brevo', EMAIL_API_KEY: 'k-brevo', EMAIL_FROM_ADDRESS: 'noreply@example.org', EMAIL_API_BASE_URL: m.base });
  assert.equal(emailConfigured(), true);
  await sendEmail({ to: 'a@iiita.ac.in', ...otpEmail('123456') });
  assert.equal(m.seen[0].url, '/v3/smtp/email');
  assert.equal(m.seen[0].headers['api-key'], 'k-brevo');
  assert.equal(m.seen[0].body.to[0].email, 'a@iiita.ac.in');
  assert.match(m.seen[0].body.textContent, /123456/);
  m.close();
});

test('SendGrid request shape', async () => {
  const m = await mock(202);
  Object.assign(process.env, { EMAIL_PROVIDER: 'sendgrid', EMAIL_API_KEY: 'SG.x', EMAIL_FROM_ADDRESS: 'noreply@example.org', EMAIL_API_BASE_URL: m.base });
  await sendEmail({ to: 'b@iiita.ac.in', ...otpEmail('654321') });
  assert.equal(m.seen[0].url, '/v3/mail/send');
  assert.equal(m.seen[0].headers.authorization, 'Bearer SG.x');
  assert.equal(m.seen[0].body.personalizations[0].to[0].email, 'b@iiita.ac.in');
  m.close();
});

test('provider errors surface as failures; unconfigured is detected', async () => {
  const m = await mock(401);
  Object.assign(process.env, { EMAIL_PROVIDER: 'brevo', EMAIL_API_KEY: 'bad', EMAIL_FROM_ADDRESS: 'n@e.org', EMAIL_API_BASE_URL: m.base });
  await assert.rejects(() => sendEmail({ to: 'c@iiita.ac.in', ...otpEmail('111111') }), /401/);
  m.close();
  delete process.env.EMAIL_PROVIDER;
  assert.equal(emailConfigured(), false);
});
