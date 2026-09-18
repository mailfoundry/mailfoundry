# Railway Migration Runbook

Vercel fallback plan. All four services can be deployed to Railway independently.
`railway.json` is already committed in each repo. This document covers everything
else needed to flip the switch.

---

## Status

| Service | railway.json | Headers in next.config | Cron jobs | Blob storage | Ready |
|---|---|---|---|---|---|
| staffordshire-hub | ✅ | ✅ (always was) | ⚙️ cron-job.org | — | Near-ready |
| sendforge | ✅ | ✅ (just moved) | ⚙️ cron-job.org | ❌ Vercel Blob | Needs Blob fix |
| fresh-quarters (pet brand) | ✅ | — | — | — | ✅ Ready |
| henryridgeplumbing | ✅ | — | — | — | ✅ Ready |

---

## Step 1 — Create Railway projects

1. Sign up / log in at railway.app
2. Create a **new project** for each service
3. Add service → "Deploy from GitHub repo" → select the repo
4. Railway detects Next.js via Nixpacks automatically

---

## Step 2 — Set environment variables

Railway reads from the dashboard (Settings → Variables). Copy every var below.
Check your Vercel project dashboard for the values — most aren't in .env.

### staffordshire-hub

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `STRIPE_SECRET_KEY` | From Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Re-generate for Railway endpoint |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | From Stripe dashboard |
| `RESEND_API_KEY` | From Resend dashboard |
| `RESEND_AUDIENCE_ID` | From Resend dashboard |
| `RESEND_FROM` | e.g. `noreply@staffordshirewoodfuels.co.uk` |
| `ADMIN_PASSWORD` | Admin login password |
| `ADMIN_TOTP_SECRET` | TOTP base32 secret |
| `CRON_SECRET` | Generate a new random string; update cron-job.org jobs |
| `ANTHROPIC_API_KEY` | For weekly blog cron |
| `AMAZON_AWS_ACCESS_KEY_ID` | SP-API |
| `AMAZON_AWS_SECRET_ACCESS_KEY` | SP-API |
| `AMAZON_CLIENT_ID` | SP-API |
| `AMAZON_CLIENT_SECRET` | SP-API |
| `AMAZON_REFRESH_TOKEN` | SP-API |
| `AMAZON_ROLE_ARN` | SP-API |
| `AMAZON_USE_SANDBOX` | `false` in production |
| `MOOVPARCEL_API_SECRET` | SWF MoovParcel secret |
| `MOOVPARCEL_SCS_API_SECRET` | SCS MoovParcel secret |
| `MOOVPARCEL_WEBHOOK_SECRET` | MoovParcel webhook |
| `MOOVPARCEL_WOO_CONSUMER_KEY` | MoovParcel WooCommerce key |
| `MOOVPARCEL_WOO_CONSUMER_SECRET` | MoovParcel WooCommerce secret |
| `TWILIO_ACCOUNT_SID` | SMS alerts |
| `TWILIO_AUTH_TOKEN` | SMS alerts |
| `TWILIO_FROM_NUMBER` | SMS alerts |
| `PUSHOVER_USER_KEY` | Pushover notifications |
| `PUSHOVER_TOKEN_API_SWF` | SWF app token |
| `PUSHOVER_TOKEN_API_SCS` | SCS app token |
| `UPSTASH_REDIS_REST_URL` | TOTP replay prevention (Vercel KV = Upstash, same credentials work) |
| `UPSTASH_REDIS_REST_TOKEN` | As above |
| `JUDGEME_PUBLIC_TOKEN` | Judge.me reviews |
| `JUDGEME_SHOP_DOMAIN` | Judge.me shop domain |
| `ALERT_EMAIL` | Alert recipient |
| `NEXT_PUBLIC_SITE_URL` | e.g. `https://staffordshirewoodfuels.co.uk` |
| `ANALYTICS_EXCLUDE_IPS` | e.g. `81.153.15.100` |
| ~~`LOG_DRAIN_SECRET`~~ | Do NOT set — log drain not needed on Railway |

### sendforge

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `RESEND_API_KEY` | From Resend dashboard |
| `CRON_SECRET` | Generate a new random string |
| `APP_LOGIN_PASSWORD` | Admin login password |
| `APP_AUTH_COOKIE` | Cookie name (e.g. `sendforge_auth`) |
| `APP_BASE_URL` | e.g. `https://send.xylouk.co.uk` |
| `NEXT_PUBLIC_BASE_URL` | Same as above |
| `ALLOWED_EMAILS` | Comma-separated admin emails |
| `UNSUBSCRIBE_HMAC_SECRET` | HMAC secret for unsubscribe URLs |
| `IBSA_TOTP_SECRET` | IBSA admin TOTP |
| `STRIPE_SECRET_KEY` | If used |
| `STRIPE_WEBHOOK_SECRET` | Re-generate for Railway endpoint |
| `SES_FROM_EMAIL` | SES sender address |
| `SES_MODE` | `live` or `sandbox` |
| `EMAIL_FROM` | Default from address |
| `BUSINESS_NAME` | e.g. `Xylo (UK) Ltd` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps (if used) |
| `BLOB_READ_WRITE_TOKEN` | **Temporary** — keep until Blob→R2 migration complete |

### fresh-quarters (pet brand)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon connection string |
| + any other vars | Check Vercel dashboard for this project |

### henryridgeplumbing

No env vars beyond `DATABASE_URL` if the site uses Prisma. Check Vercel dashboard.

---

## Step 3 — Cron jobs (cron-job.org)

Vercel calls cron routes automatically with `Authorization: Bearer CRON_SECRET`.
On Railway, use **cron-job.org** (free, supports custom HTTP headers).

1. Sign up at cron-job.org
2. For each job below, create a new cron job:
   - **URL**: your Railway app URL + the path
   - **Method**: GET
   - **Header**: `Authorization: Bearer YOUR_CRON_SECRET`
   - **Schedule**: as below

### staffordshire-hub crons

| Path | Schedule (UTC) | Notes |
|---|---|---|
| `/api/cron/abandoned-cart` | Every hour (`0 * * * *`) | |
| `/api/cron/weekly-blog` | Fridays 8am (`0 8 * * 5`) | Requires ANTHROPIC_API_KEY |
| `/api/cron/weekly-blog-scs` | Fridays 9am (`0 9 * * 5`) | Requires ANTHROPIC_API_KEY |
| `/api/cron/purge-tokens` | Daily 3am (`0 3 * * *`) | |
| `/api/cron/amazon-sync` | 05:55 daily (`55 5 * * *`) | |
| `/api/cron/amazon-sync` | 10:55 daily (`55 10 * * *`) | |
| `/api/cron/amazon-sync` | 12:55 daily (`55 12 * * *`) | |
| `/api/cron/amazon-sync` | 15:55 daily (`55 15 * * *`) | |
| `/api/cron/amazon-sync` | 19:55 daily (`55 19 * * *`) | |
| `/api/cron/daily-digest` | Daily 6am (`0 6 * * *`) | |
| `/api/cron/intraday-digest` | 11am daily (`0 11 * * *`) | |
| `/api/cron/intraday-digest` | 1pm daily (`0 13 * * *`) | |
| `/api/cron/intraday-digest` | 4pm daily (`0 16 * * *`) | |
| `/api/cron/intraday-digest` | 8pm daily (`0 20 * * *`) | |

### sendforge crons

| Path | Schedule (UTC) | Notes |
|---|---|---|
| `/api/cron/send-scheduled` | Every 5 min (`*/5 * * * *`) | |
| `/api/cron/purge-tokens` | Daily 3am (`0 3 * * *`) | |

---

## Step 4 — Vercel Blob → Cloudflare R2 (sendforge only)

This is the **one genuine blocker** for sendforge. Vercel Blob is a Vercel-proprietary
service. Existing image URLs remain accessible after migration, but new uploads will fail
unless you migrate to R2 first.

### Why R2

- S3-compatible API → minimal code change
- Free tier: 10 GB storage, 1M Class A operations/month
- No egress fees

### Migration steps

1. Create a Cloudflare account → R2 → create bucket (e.g. `sendforge-ibsa`)
2. Create an R2 API token with read+write access
3. Set env vars on Railway:
   ```
   R2_ACCOUNT_ID=<from Cloudflare dashboard>
   R2_ACCESS_KEY_ID=<R2 token access key>
   R2_SECRET_ACCESS_KEY=<R2 token secret>
   R2_BUCKET=sendforge-ibsa
   R2_PUBLIC_URL=https://pub-<hash>.r2.dev   # or custom domain
   ```
4. Install AWS SDK: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
5. Create `src/lib/r2.ts`:
   ```ts
   import { S3Client } from "@aws-sdk/client-s3";
   export const r2 = new S3Client({
     region: "auto",
     endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
     credentials: {
       accessKeyId: process.env.R2_ACCESS_KEY_ID!,
       secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
     },
   });
   ```
6. Update `app/api/ibsa/blob-upload/route.ts` and `app/api/ibsa/upload-image/route.ts`
   to use `r2.send(new PutObjectCommand(...))` instead of `@vercel/blob`
7. Update `next.config.ts` image domain from `*.public.blob.vercel-storage.com`
   to your R2 public URL hostname
8. Existing product images in Vercel Blob remain accessible at their original URLs
   — no need to migrate them unless you want to

---

## Step 5 — Stripe webhook

1. In Stripe dashboard → Webhooks → Add endpoint
2. URL: `https://<railway-domain>/api/webhooks/stripe`
3. Copy the new signing secret → update `STRIPE_WEBHOOK_SECRET` in Railway

---

## Step 6 — DNS cutover

When ready to switch a service:

1. In Railway: Settings → Domains → Add custom domain
2. Railway gives you a CNAME target (e.g. `abc.up.railway.app`)
3. In your DNS provider, change the CNAME/A record to point at Railway
4. Wait for TTL to propagate (keep TTL at 60s before the cut)
5. Verify HTTPS is working (Railway handles SSL automatically)
6. Only then remove the service from Vercel

### Domain mapping

| Service | Domain |
|---|---|
| staffordshire-hub | staffordshirewoodfuels.co.uk |
| sendforge | (check Vercel — IBSA portal domain) |
| fresh-quarters (SCS) | (check Vercel) |
| henryridgeplumbing | henryridgeplumbing.co.uk |

---

## Notes on Vercel-specific code

These are safe to leave in the codebase — they become no-ops on Railway:

- `export const maxDuration = 300;` on route files → ignored
- `export const dynamic = "force-dynamic";` → standard Next.js, works anywhere
- `LOG_DRAIN_SECRET` → just don't set it; the log drain route can stay dormant

---

## Recommended migration order

1. **henryridgeplumbing** — zero dependencies, easiest proof of concept
2. **fresh-quarters (pet brand)** — simple, good second test
3. **staffordshire-hub** — SWF + SCS together; set up cron-job.org before cutting DNS
4. **sendforge** — do Blob→R2 migration first, then cut over
