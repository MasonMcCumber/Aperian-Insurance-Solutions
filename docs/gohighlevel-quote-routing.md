# Routing consumer quote leads into GoHighLevel

The quote page at **inquiry.aperiansolutions.com** sends every completed request to
`/api/quote`. That function checks the data, records proof of consent, and POSTs one
flat JSON object to a GoHighLevel **Inbound Webhook** workflow trigger. GoHighLevel
then creates the contact, opens an opportunity, and hands it to an agent.

```
Visitor fills the form
  -> /api/quote (Vercel)          validates, formats phone, stamps consent
  -> GoHighLevel Inbound Webhook  GHL_QUOTE_WEBHOOK_URL
  -> Workflow                     contact + opportunity + agent assignment + texts
```

If `GHL_QUOTE_WEBHOOK_URL` is not set, or GoHighLevel rejects the request, the form
shows the visitor "please call or text (979) 353-2533" instead of a false success.

## 1. Custom fields to create in GoHighLevel

Settings > Custom Fields > Contact. Create these once (type in brackets):

| Field name | Type | Values sent |
|---|---|---|
| Insurance Type | Single option | auto, home, renters, life, health |
| Currently Insured | Single option | yes, no |
| Vehicles | Single option | 1, 2, 3, 4+ (auto only) |
| Property Type | Single option | single_family, condo, mobile (home only) |
| Coverage Amount | Single option | 100000, 250000, 500000, 1000000+, unsure (life only) |
| Household Size | Single option | 1, 2, 3, 4, 5+ (health only) |
| Age Range | Single option | 18-25, 26-35, 36-45, 46-55, 56-64, 65+ (life and health) |
| TCPA Consent Text | Multi-line text | exact wording the visitor agreed to |
| Consent Timestamp | Text | ISO time the server received it |
| Consent IP | Text | visitor IP |
| Consent User Agent | Multi-line text | visitor browser |
| Consent Page URL | Text | page the visitor submitted from |
| GCLID | Text | Google Ads click ID |
| UTM Source / Medium / Campaign / Term / Content | Text (5 fields) | campaign tags |
| Landing Page | Text | first page of the visit |

Fields that don't apply to a lead's insurance type arrive empty.

## 2. Pipeline

Opportunities > Pipelines > add **Consumer Quotes** with stages:

1. New Quote Request
2. Contacted
3. Quoted
4. Sold
5. Lost / Not Interested

## 3. Workflow

Automation > Workflows > Create > Start from scratch, name it **Consumer Quote Intake**.

1. **Trigger: Inbound Webhook.** Copy the webhook URL it shows.
2. Submit one test from the live page (see section 5) so GoHighLevel captures a
   sample payload, then click **Fetch sample request**.
3. **Action: Create/Update Contact.** Map:
   - First Name `first_name`, Last Name `last_name`, Email `email`, Phone `phone`
   - Postal Code `postal_code`, City `city`, State `state`, Source `source`
   - Each custom field from section 1 to the matching key
     (`insurance_type`, `currently_insured`, `vehicles`, `property_type`,
     `coverage_amount`, `household_size`, `age_range`, `tcpa_consent_text`,
     `consent_timestamp`, `ip_address`, `user_agent`, `page_url`, `gclid`,
     `utm_*`, `landing_page`)
4. **Action: Add Contact Tag** `consumer-quote`, plus an **If/Else** on
   `insurance_type` that adds `quote-auto`, `quote-home`, and so on.
5. **Action: Create/Update Opportunity** in Consumer Quotes > New Quote Request.
   Name it `{{contact.first_name}} {{contact.last_name}} - {{insurance_type}}`.
6. **Action: Assign to User.** Round robin across the agents for that line, or an
   If/Else on `state` / `insurance_type` to pick the right agent.
7. **Action: Send SMS** to the lead within a minute: who they're matched with and
   that the agent will call shortly. Only text leads where consent was given (every
   lead from this page has it).
8. **Action: Internal Notification** (SMS or email) to the assigned agent with the
   lead's name, phone, ZIP and insurance type.
9. Optional: **Wait 10 minutes > If opportunity still in New Quote Request >
   notify a manager**, so no lead sits untouched.

Publish the workflow.

## 4. Connect the website

1. Vercel > aperian-insurance-solutions > Settings > Environment Variables.
2. Add `GHL_QUOTE_WEBHOOK_URL` = the URL from step 3.1, for **Production** and
   **Preview**.
3. Redeploy (Deployments > latest > Redeploy), or push any commit to `main`.

The agent contact form on aperiansolutions.com/contact works the same way with its
own variable, `LEAD_WEBHOOK_URL`. It can point to a second GoHighLevel workflow.

## 5. Test

1. Open `https://inquiry.aperiansolutions.com/?city=College%20Station&utm_source=test`.
2. Complete the form with your own details.
3. In GoHighLevel, confirm the contact, the custom fields, the tags, the
   opportunity, the agent assignment, and the text message.
4. Delete the test contact afterwards.

## 6. Google Ads

- **Final URL:** `https://inquiry.aperiansolutions.com/`
- **Final URL suffix (per ad group):** `type=auto` (or home, renters, life,
  health) preselects the coverage. `city=College%20Station` puts the city in the
  headline, so set it per location-targeted ad group, for example
  `type=auto&city=College%20Station`. Google's location ValueTrack parameter
  returns an ID, not a city name, so don't use it here. With no `city`, the page
  fills it in from the visitor's ZIP code after the first step.
- Turn on **auto-tagging** so every click carries a `gclid`. The page stores it and
  it lands in GoHighLevel, so you can import offline conversions (Sold stage) back
  into Google Ads later.
- Add a Google Ads conversion tag (or GA4 with the `generate_lead` event the page
  already fires) before spending real budget, so Ads can optimize for leads.

## 7. Compliance checklist before running paid traffic

These matter more for consumer insurance leads than anything else on the page:

- **Consent wording.** The checkbox text on the page is a solid starting point,
  but have a lawyer review it, and name the specific agents or agencies who will
  call if you can. Keep the stored `tcpa_consent_text` exactly as shown.
- **Consent certificates.** Add ActiveProspect TrustedForm or Jornaya LeadiD to the
  page. Agents and carriers often require one, and it is your best defense if a
  consumer later disputes consent.
- **Privacy policy.** The current policy describes the old marketing business. It
  must cover consumer data, sharing with agents, and the Do Not Sell / opt-out
  rights in the Texas Data Privacy and Security Act.
- **Licensing.** Confirm with counsel or the Texas Department of Insurance whether
  Aperian's role (connecting consumers with agents, not quoting or selling) needs
  any license, and that every agent receiving leads is licensed in the lead's state.
- **Internal Do Not Call list.** Honor STOP replies and opt-out requests across
  every agent who receives the lead.
