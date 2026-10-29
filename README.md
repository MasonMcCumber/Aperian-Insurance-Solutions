# Aperian Insurance Solutions

Static marketing site for aperiansolutions.com, hosted on Vercel.

- `index.html`, `contact.html`, `thank-you.html`, `privacy.html`, `terms.html`, `404.html`: pages
- `assets/css/ais.css`: all styles (Aperian palette, Sora + Inter)
- `api/lead.js`: contact form handler. Forwards each lead as JSON to the URL in the
  `LEAD_WEBHOOK_URL` environment variable (GoHighLevel, Zapier, Make, etc.).
  Without it, the form tells visitors to call or text instead.
- `vercel.json`: clean URLs, security headers, redirects from the old marketing pages

Deploy: push to `main` on GitHub (MasonMcCumber/Aperian-Insurance-Solutions). Vercel builds
and publishes to aperiansolutions.com automatically. Other branches get preview URLs.
