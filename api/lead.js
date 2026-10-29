// Receives the contact form and forwards it to LEAD_WEBHOOK_URL
// (for example a GoHighLevel, Zapier or Make inbound webhook).
// Set LEAD_WEBHOOK_URL in the Vercel project's environment variables.
// If it is not set, the form shows the "call or text us" message instead of losing the lead silently.

const LINES = ['health', 'life', 'renters', 'auto', 'home'];
const ROLES = ['agent', 'agency', 'carrier', 'call_center'];
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const b = req.body && typeof req.body === 'object' ? req.body : {};

  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (clip(b.website, 200)) return res.status(200).json({ ok: true });

  const lead = {
    name: clip(b.name, 120),
    company: clip(b.company, 160),
    email: clip(b.email, 200),
    phone: clip(b.phone, 40),
    role: ROLES.includes(b.role) ? b.role : 'agent',
    states: clip(b.states, 200),
    lines: Array.isArray(b.lines) ? b.lines.filter((l) => LINES.includes(l)) : [],
    message: clip(b.message, 3000),
    sms_consent: b.sms_consent === true,
    page: clip(b.page, 200),
    source: 'aperiansolutions.com',
    submitted_at: new Date().toISOString(),
  };

  const errors = [];
  if (!lead.name) errors.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) errors.push('email');
  if (lead.phone.replace(/\D/g, '').length < 10) errors.push('phone');
  if (!lead.lines.length) errors.push('lines');
  if (errors.length) return res.status(400).json({ error: 'Invalid fields', fields: errors });

  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) {
    console.error('LEAD_WEBHOOK_URL is not set; lead not delivered', { email: lead.email });
    return res.status(503).json({ error: 'Lead delivery is not configured' });
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    if (!r.ok) throw new Error('Webhook responded ' + r.status);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Lead webhook failed', e.message);
    return res.status(502).json({ error: 'Could not deliver lead' });
  }
};
