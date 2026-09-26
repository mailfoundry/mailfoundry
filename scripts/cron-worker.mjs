/**
 * cron-worker.mjs
 *
 * Persistent Railway worker service that fires all SendForge cron jobs on schedule.
 * Replaces the vercel.json "crons" array which only works on Vercel.
 *
 * Required env vars (same as the Next.js service):
 *   APP_URL     — public URL of the Next.js service, e.g. https://ibsa.xylouk.co.uk
 *   CRON_SECRET — shared secret used to authenticate cron requests
 *
 * Railway setup:
 *   Create a second service in the same Railway project pointing to the same repo.
 *   Set start command to: node scripts/cron-worker.mjs
 *   Add APP_URL and CRON_SECRET env vars to that service.
 */

import cron from "node-cron";

const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET  = process.env.CRON_SECRET;

if (!SECRET) {
  console.error("❌  CRON_SECRET env var is required");
  process.exit(1);
}

async function callCron(path) {
  const url = `${APP_URL}${path}`;
  const ts  = new Date().toISOString();
  try {
    const res  = await fetch(url, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const body = await res.text();
    console.log(`[${ts}] ${path} → ${res.status}: ${body.slice(0, 200)}`);
  } catch (err) {
    console.error(`[${ts}] ${path} FAILED:`, err.message);
  }
}

// ── Schedule mirror of vercel.json crons ────────────────────────────────────

// Send scheduled campaigns — every 5 minutes
cron.schedule("*/5 * * * *", () => callCron("/api/cron/send-scheduled"));

// Purge expired tokens — daily 3am
cron.schedule("0 3 * * *",   () => callCron("/api/cron/purge-tokens"));

// ────────────────────────────────────────────────────────────────────────────

console.log(`✅  SendForge cron worker started — pointing at ${APP_URL}`);
console.log("    Schedules: send-scheduled(*/5 min), purge-tokens(3am daily)");
