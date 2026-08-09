# Staffordshire Wood Fuels — Maintenance Routine

## About this document
This is a recurring maintenance guide for staffordshirewoodfuels.co.uk. The site runs on:
- **Next.js 16** hosted on **Vercel**
- **Neon** serverless PostgreSQL database (via Prisma ORM)
- **Stripe** for payments
- **Resend** for transactional email
- **Upstash Redis** for rate limiting and alert deduplication
- **MoovParcel** for shipping label generation
- **Google Analytics Data API** for admin analytics

Vercel project: `staffordshire-hub`
Local codebase: `/Users/jasonridge/staffordshire-hub`

---

## Every day — automated, no action needed unless an alert arrives

A log drain monitors the site 24/7 and sends alert emails from `noreply@staffordshirewoodfuels.co.uk` when something goes wrong.

| Alert | What it means | What to do |
|---|---|---|
| 🔴 Production error | Something broke for a visitor | Check Vercel logs for the stack trace |
| ⚠️ Rate limit hit | Someone hammering the site | Check the IP in the email, consider blocking in Vercel Firewall |
| 🔐 Failed admin logins | Someone trying to get in | Change admin password if it looks suspicious |

---

## Every week (~10 mins)

**Stripe dashboard** — dashboard.stripe.com
Check for failed payments or disputes. A dispute (chargeback) needs a response within 7 days or Stripe rules against you automatically.
> Why: unresolved disputes cost money and hurt your Stripe account standing.

**Order processing** — Log into admin, scan for orders stuck in a processing state. Cross-check with MoovParcel that labels were generated.
> Why: a customer whose order never moved is the first to leave a bad review.

**Vercel logs** — vercel.com → your project → Logs. Scan for red entries.
> Why: the log drain catches patterns, but a quick human scan spots one-off weirdness.

---

## Every month (~30 mins)

**npm audit** — checks all installed packages for known security vulnerabilities.
```
cd /Users/jasonridge/staffordshire-hub
npm audit
npm audit fix
```
We expect to see the `google-gax` moderate issue until Google patches it upstream. If anything new or high severity appears, investigate before running `audit fix`.
> Why: packages get security holes discovered in them all the time — this is how you find out.

**Resend stats** — resend.com → your domain. Check bounce rate and complaint rate.
- Bounce rate above 2% → clean your mailing list
- Complaint rate above 0.1% → investigate and remove complainers
> Why: high rates get your sending domain blacklisted, meaning emails go to spam for everyone.

**Neon database size** — console.neon.tech → your project → Storage. Check you're not approaching your plan limit.
> Why: if you hit the storage cap, database writes fail and the site breaks.

**Upstash Redis usage** — console.upstash.com. Check daily command count.
> Why: Redis powers rate limiting and alert deduplication — if you hit the limit, those stop working.

---

## Every quarter (~1 hour)

**Rotate secrets** — Generate a new LOG_DRAIN_SECRET and update it in both Vercel env vars and the Vercel drain config. Rotate Resend and Upstash API keys if those services support rotation.
```
openssl rand -hex 32
```
> Why: if a secret ever leaked somewhere you didn't notice, rotating it cuts off any attacker.

**Review Vercel Firewall** — Check rate limit rules still make sense. Look at the Traffic tab for IPs or patterns to block.
Current rules:
- Rate limit: POST to `/admin/login` — 10 requests/minute → 429
- Bot Protection: enabled in Log mode
- AI bots: Deny
> Why: attack patterns change; rules set months ago may need tuning.

**Test checkout end-to-end** — Place a test order using Stripe test card `4242 4242 4242 4242`. Verify confirmation email arrives, order appears in admin, MoovParcel label generates.
> Why: integrations break silently — this is how you catch it before a customer does.

**npm packages update** — broader than audit fix, updates packages within their allowed version ranges.
```
cd /Users/jasonridge/staffordshire-hub
npm update
```
Test the site locally after running this.
> Why: keeps everything fresh and reduces technical debt over time.

**Database backup check** — In Neon console, verify automatic backups are enabled and recent. Neon lets you restore to a branch non-destructively to test.
> Why: backups you've never tested aren't really backups.

---

## Annually

**Domain renewal** — Check `staffordshirewoodfuels.co.uk` renewal date in 123-Reg. SSL is handled automatically by Vercel.
> Why: a lapsed domain takes your site offline instantly.

**Review admin accounts** — Is everyone with admin access still supposed to have it?
> Why: basic access hygiene — people leave, circumstances change.

**GDPR data review** — Are you holding customer data longer than necessary? Do you have a process for handling deletion requests?
> Why: ICO fines for UK businesses are real, even for small sites.

---

## Known issues / pending

- `google-gax` moderate vulnerability — waiting on Google to patch upstream. Recheck monthly with `npm audit`.
- Admin 2FA (TOTP) — not yet implemented. Add to monthly rotation once built.
- MoovParcel automatic PUT writeback — ticket #20174 with Ross at enquiries@moovparcel.co.uk
- WooCommerce order ID collision — two orders in same second share apparent WooID, fix pending
