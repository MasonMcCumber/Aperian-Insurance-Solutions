// Consumer quote requests from inquiry.aperiansolutions.com.
// Validates the form, records proof of consent, and forwards one flat JSON
// object to a GoHighLevel "Inbound Webhook" workflow trigger.
//
// Environment variable (Vercel > Project > Settings > Environment Variables):
//   GHL_QUOTE_WEBHOOK_URL  the Inbound Webhook URL from the GoHighLevel workflow
// See docs/gohighlevel-quote-routing.md for the field list and workflow setup.

const TYPES = ['auto', 'home', 'renters', 'life', 'health'];
const pick = (v, allowed) => (allowed.includes(v) ? v : '');
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function e164(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d.length === 10 ? '+1' + d : '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const b = req.body && typeof req.body === 'object' ? req.body : {};

  // Honeypot: real people never fill the hidden company_website field.
  if (clip(b.company_website, 200)) return res.status(200).json({ ok: true });

  const type = pick(b.insurance_type, TYPES);
  const lead = {
    // Standard GoHighLevel contact fields
    first_name: clip(b.first_name, 60),
    last_name: clip(b.last_name, 60),
    email: clip(b.email, 200).toLowerCase(),
    phone: e164(b.phone),
    postal_code: String(b.zip || '').replace(/\D/g, '').slice(0, 5),
    city: clip(b.city, 60),
    state: clip(b.state, 2).toUpperCase(),
    source: 'inquiry.aperiansolutions.com',
    tags: ['consumer-quote', type ? 'quote-' + type : ''].filter(Boolean).join(','),

    // Quote details (map to GoHighLevel custom fields)
    insurance_type: type,
    currently_insured: pick(b.currently_insured, ['yes', 'no']),
    vehicles: pick(b.vehicles, ['1', '2', '3', '4+']),
    property_type: pick(b.property_type, ['single_family', 'condo', 'mobile']),
    coverage_amount: pick(b.coverage_amount, ['100000', '250000', '500000', '1000000+', 'unsure']),
    household_size: pick(b.household_size, ['1', '2', '3', '4', '5+']),
    age_range: pick(b.age_range, ['18-25', '26-35', '36-45', '46-55', '56-64', '65+']),

    // Proof of consent (keep these: they are your TCPA record)
    tcpa_consent: b.tcpa_consent === true,
    tcpa_consent_text: clip(b.tcpa_consent_text, 2000),
    consent_timestamp: new Date().toISOString(),
    ip_address: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 64),
    user_agent: clip(req.headers['user-agent'], 400),
    page_url: clip(b.page_url, 500),

    // Ad attribution
    gclid: clip(b.gclid, 200),
    gbraid: clip(b.gbraid, 200),
    wbraid: clip(b.wbraid, 200),
    fbclid: clip(b.fbclid, 200),
    msclkid: clip(b.msclkid, 200),
    utm_source: clip(b.utm_source, 200),
    utm_medium: clip(b.utm_medium, 200),
    utm_campaign: clip(b.utm_campaign, 200),
    utm_term: clip(b.utm_term, 200),
    utm_content: clip(b.utm_content, 200),
    landing_page: clip(b.landing, 500),
    referrer: clip(b.referrer, 500),
  };

  const bad = [];
  if (!lead.first_name) bad.push('first_name');
  if (!lead.last_name) bad.push('last_name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) bad.push('email');
  if (!lead.phone) bad.push('phone');
  if (lead.postal_code.length !== 5) bad.push('zip');
  if (!type) bad.push('insurance_type');
  if (!lead.tcpa_consent || !lead.tcpa_consent_text) bad.push('tcpa_consent');
  if (bad.length) return res.status(400).json({ error: 'Invalid fields', fields: bad });

  const url = process.env.GHL_QUOTE_WEBHOOK_URL;
  if (!url) {
    console.error('GHL_QUOTE_WEBHOOK_URL is not set; quote lead not delivered', { type, zip: lead.postal_code });
    return res.status(503).json({ error: 'Lead delivery is not configured' });
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    if (!r.ok) throw new Error('GoHighLevel responded ' + r.status);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('GoHighLevel webhook failed', e.message);
    return res.status(502).json({ error: 'Could not deliver lead' });
  }
};
