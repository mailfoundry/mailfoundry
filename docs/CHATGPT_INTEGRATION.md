# MailFoundry: ChatGPT campaign workflow (response to development request)

Prepared by Claude (lead developer, MailFoundry) · 18 October 2026 · **updated same day: 6A–6D built**

Status labels used throughout:

- **[LIVE]**: already implemented and running
- **[BUILD]**: needs development (nothing in this category exists yet)
- **[JASON]**: requires Jason's approval or action

**Implementation status (18 Oct 2026):** 6A–6D are built, type-checked and covered by 69 automated safeguard tests (`bash tests/safeguards/run.sh`). They go live when Jason runs the migration and pushes. **Nothing changes for existing campaigns until Jason assigns a list to a brand** (Settings → Brands). The three-a-week SCS schedule is **not** active, and SWF starts on **Hold**.

---

## 1. Assessment: three SCS campaigns per week

**Three send days a week is fine, but no contact should get three emails a week yet.**

- **Evidence so far:** one warm-up send (15 Oct 2026): 495 delivered, 3 bounces (0.6%), 2 unsubscribes (0.4%), 0 complaints. That's a good start, but it's one result.
- **The risk:** most SCS contacts came from an old Shopify list and barely remember the brand. Emailing the same people three times a week is the quickest way to get spam complaints. Above 0.3% complaints, Gmail and Outlook put every SCS email in spam.
- **The approach:** keep three send days, but split the warm-up list into three groups (A, B, C). Each group gets one of the week's campaigns, so each contact still gets **one SCS email per 7 days** during warm-up.
    - The domain sends three times a week, which helps it warm up (providers like steady, regular volume).
    - No contact is emailed any more often than now.
    - Each send is smaller than one big weekly send would be.
- **Send days:** I recommend **Tue / Wed / Thu at 10:00 UK** rather than Saturday. SCS is mostly business contacts; Saturday B2B email gets read least and is often reported as spam on Monday. **[JASON]**: confirm Tue/Wed/Thu, or keep Saturday.

## 2. Revised SCS audience ramp and sending calendar **[JASON]**

Each week's group sizes are the total ÷ 3. Contacts are assigned to a group permanently, so each person lands on the same weekday.

| Week of | SCS Warm-up total | Tue | Wed | Thu | Max per contact |
| --- | --- | --- | --- | --- | --- |
| 19 Oct | 1,000 | — | — | 1,000 (22 Oct, single send as already planned) | 1 |
| 26 Oct | 2,000 | ~670 (A) | ~670 (B) | ~670 (C) | 1 |
| 2 Nov | 4,000 | ~1,330 | ~1,330 | ~1,330 | 1 |
| 9 Nov | 8,000 | ~2,670 | ~2,670 | ~2,670 | 1 |
| 16 Nov | ~13,900 (all eligible) | ~4,630 | ~4,630 | ~4,630 | 1 |

The full list is still reached in the week of 16 Nov, matching the original six-week plan.

**Spacing rules (enforced by MailFoundry):**

- Max 1 SCS email per contact per 7 days during warm-up.
- Max 1 marketing email per contact per calendar day **across both brands**. Some people are on both SWF and SCS lists.
- Min 48 hours between any two emails to the same contact (applies after warm-up).

**After warm-up** (from about 30 Nov, after two clean weeks at the full list):

| Engagement (last 30 days) | Max SCS emails / week |
| --- | --- |
| Clicked | 3 |
| Opened | 2 |
| Neither | 1 |
| 4+ sends, never opened or clicked | 0 (stop emailing) |

**Hold and Stop are unchanged and still decide growth:**

- **Hold:** that week's sends go only to contacts already on the list, and the calendar moves back a week.
- **Stop:** all SCS sending pauses until Jason clears it.

Thresholds (from last week's sends):

| Measure | Go | Hold | Stop |
| --- | --- | --- | --- |
| Complaints | under 0.1% | 0.1–0.3% | over 0.3% |
| Bounces | under 2% | 2–5% | over 5% |
| Unsubscribes | under 1% | 1–2% | over 2% |
| Postmaster spam rate | under 0.1% or no data | 0.1–0.3% | 0.3% or more |

**Earliest safe start for three a week: Tuesday 27 October 2026**, only if both of these are true:

1. The 22 Oct send passes Go when reviewed on Sat 24 Oct.
2. Sections 6A (brand rules, limits, Hold/Stop) and 6B (approvals) are built, deployed and tested.

If either isn't ready, the start moves to Tue 3 Nov and the calendar shifts one week. Three a week must not run on manual list management.

## 3. SWF sending frequency while reputation is repaired **[JASON]**

**The issue:** SWF's Gmail spam rate was 0.3% or more on the last Postmaster update (8 Oct 2026). That's the reason SWF lands in spam.

**Recommendation:**

- **No five-a-week, at any stage, to the whole list.**
- **Recovery phase** (until Postmaster shows SWF under 0.1% for 2 weeks in a row):
    - **1 email a week**, only to engaged contacts: opened or clicked in the last 90 days, plus recent customers.
    - Grow that audience weekly only on Go (same thresholds as SCS).
    - **No automated scheduling for SWF** until recovery is confirmed. Campaigns are still drafted and approved through the workflow, but Jason schedules them himself.
- **After recovery:** up to 2 a week for contacts engaged in the last 30 days, 1 a week for everyone else. Review again after 4 weeks.
- **Strongly recommended:** move SWF marketing to its own subdomain (`news.staffordshirewoodfuels.co.uk`), set up in Resend with its own SPF/DKIM/DMARC. Order and dispatch emails then stay separate from marketing reputation. **[JASON]**: DNS records needed in 123-Reg.

## 4. Integration architecture

```
ChatGPT (custom GPT Action)
   │  HTTPS + bearer token (hashed, revocable)
   ▼
MailFoundry /api/agent/v1/*        ← new, scoped endpoints
   │  same validation + send code paths as the UI
   ▼
Brand rules · approval check · Hold/Stop · weekly limits · suppression
   ▼
Scheduled-send job (Railway cron, every few minutes) → Resend
   ▲
Jason, logged in to MailFoundry: concept + final approval, clear Stop
```

Key principles:

- **ChatGPT never writes to the database directly.** Every action goes through the API, which uses the same code as the MailFoundry screens.
- **ChatGPT cannot approve.** Approval exists only in the MailFoundry interface, behind Jason's signed login. Otherwise the approval step would mean nothing.
- **Safeguards are checked twice:** when ChatGPT schedules, and again at the moment of sending.

## 5. Setup Jason must complete **[JASON]**

1. ~~Deploy the signed-session security fix~~ **Done** (commit 3701d9c, live 18 Oct).
2. **Run the migration** `prisma/migrations/20261018000000_brands_approvals_agent/migration.sql` in Neon (**MailFoundry** project), then push.
3. **Remove ChatGPT's write access to Neon.** Use a read-only database user, or remove access. With write access it can change suppression records and bypass every safeguard. GitHub read access is fine; no push rights.
4. **Create the "Agent Test" list** containing only your own addresses. In Settings → Brands → Lists, set it to SCS and tick **test list**.
5. **Create the agent token** in Settings → ChatGPT agent access (shown once). In the custom GPT: Configure → Actions → Import from URL `https://ibsa.xylouk.co.uk/api/agent/v1/openapi.json`, then Authentication: API key, Bearer, and paste the token.
6. **Run the end-to-end test:** `node scripts/agent-e2e.mjs` (see section 7).
7. **Later, when approving the new SCS schedule:** assign SCS Warm-up to SCS, set the ramp cap and send days, and decide whether to allow agent scheduling.
8. **Weekly:** enter the Postmaster spam rate for each brand in Settings → Brands.

## 6. Database and application changes

### Already in place **[LIVE]**

- Campaigns with subject, preview text (`preheader`), HTML, plain text (`body`), From address, target list, and scheduled time.
- Scheduled-send job running on Railway.
- Suppression: unsubscribed, bounced, complained and archived contacts are never sent to.
- Resend webhook records bounces and complaints automatically.
- One-click unsubscribe (List-Unsubscribe) on every send, including tests.
- Merge tags with fallbacks (`{{firstName|there}}`).
- Segments with warm-up presets and "Save as list".
- Test sends; per-campaign send and open/click records.
- SCS and SWF sending from separate verified domains.
- Signed login sessions (prepared; deploys with item 5.1).

### 6A. Brand rules, limits, Hold/Stop **[BUILT, awaiting deploy]**

- **New `Brand` table** (swf, scs):
    - fixed From name and address
    - allowed lists
    - send days and times
    - weekly limit per contact
    - status Go / Hold / Stop, plus who set it and when
- **Each campaign belongs to a brand.** Its From address and list must match that brand; anything else is rejected.
- **Group assignment** (A/B/C): each contact's group is worked out from their ID, so it never changes and needs no storage. Each campaign can target one group.
- **Limits enforced at send time:** contacts over their weekly or daily limit are skipped and recorded as `capped`.
- **Status worked out automatically** from the last 7 days' complaints, bounces and unsubscribes, plus the Postmaster figure Jason enters.
    - **Hold:** blocks adding to the warm-up list and blocks scheduling to a larger audience than last week's.
    - **Stop:** blocks scheduling, and the send job skips the brand.
    - Only Jason can clear a Stop.

### 6B. Approvals and audit trail **[BUILT, awaiting deploy]**

- **New `CampaignApproval` table:** campaign, type (concept / final), approved by, approved at, and a fingerprint (hash) of the approved version.
    - Concept fingerprint covers: subject, angle, product, planned date.
    - Final fingerprint covers: subject, preview, HTML, plain text, sender, list, audience size, send time.
- **Approve buttons in MailFoundry,** shown only to Jason's logged-in session.
- **Scheduling requires a final approval whose fingerprint matches the current campaign.**
- **Any edit after final approval** cancels it. The campaign returns to "awaiting approval" and must be approved again.
- **The send job re-checks the fingerprint** just before sending. A mismatch means it doesn't send and the campaign is flagged.
- **New `AuditLog` table:** every create, edit, approval, schedule, cancel, Hold/Stop change and agent API call, with who/what/when.

### 6C. Agent API **[BUILT, awaiting deploy]**

All under `/api/agent/v1/`, bearer token required. Every action is logged.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/brands` | Brand settings, status (Go/Hold/Stop), allowed lists, send windows |
| GET | `/lists` | Lists with eligible counts, by brand |
| GET | `/campaigns?brand=&status=` | List campaigns |
| GET | `/campaigns/{id}` | Full details, including approval state |
| POST | `/campaigns` | Create a **draft** (brand, name, subject, preview, html, text, list, planned date) |
| PATCH | `/campaigns/{id}` | Edit a draft (cancels any approval) |
| POST | `/campaigns/{id}/concept` | Submit a concept for Jason's approval |
| GET | `/campaigns/{id}/preview` | Rendered HTML with sample merge data |
| POST | `/campaigns/{id}/test` | Test send to the approved test list only |
| POST | `/campaigns/{id}/schedule` | Schedule (UK time). Refused unless final approval matches and brand rules pass |
| POST | `/campaigns/{id}/cancel` | Cancel an unsent campaign (status → cancelled) |
| POST | `/campaigns/{id}/reschedule` | Change the time of an unsent campaign. Needs re-approval if outside the approved window |
| GET | `/campaigns/{id}/stats` | Sent, delivered, failed, bounced, complained, unsubscribed, clicks, opens, capped |
| GET | `/summary?week=YYYY-Www` | Weekly summary per brand (see 6D) |

The API can't send immediately, approve, change brand settings, edit contacts or suppression, or add contacts to warm-up lists beyond the ramp allowance.

New campaign status: `cancelled`. New send status: `capped`.

### 6D. Weekly summary **[BUILT, awaiting deploy]**

`GET /summary` returns, per brand:

- last week's campaigns, with sent / delivered / bounced / complained / unsubscribed / clicks / opens
- list and warm-up sizes
- the current ramp week and next allowed audience size
- upcoming scheduled campaigns
- Go/Hold/Stop status and the reason
- any warnings

Opens are labelled unreliable (Apple Mail opens emails automatically); planning should lead on clicks.

**Cost:** no new services or ongoing cost. Runs on the existing Railway app and Neon database.

## 7. Test plan and implementation status

**Automated (done):** `bash tests/safeguards/run.sh` runs 69 tests against an in-memory database (no Neon, no Resend):

- **26 unit tests:** UK time across the 25 Oct clock change, A/B/C group balance, fingerprints, ISO weeks.
- **43 safeguard tests:**
    - **Sender and lists:** From address forced to the brand's; an SCS campaign can't use an SWF or unassigned list.
    - **Approvals:** scheduling is blocked without final approval; editing after approval revokes it; a content change made directly in the database is caught at send time; audience growth after approval blocks the send.
    - **Content rules:** a bare `{{firstName}}` is rejected.
    - **Send days, window and ramp:** wrong day and outside-window times are refused; the ramp cap holds; group sends reach only their group.
    - **Stop and Hold:** both block; health escalates automatically (0.2% complaints → Hold, 0.5% → Stop, Postmaster 0.3% → Stop) and never relaxes on its own.
    - **Frequency limits:** the weekly limit, the cross-brand daily limit, and complaints counting towards limits all work.
    - **Suppression and sending:** unsubscribed, bounced and complained contacts are never emailed; re-sending doesn't double-send; a legacy campaign on a newly branded list is blocked.
    - **Audit trail:** written for every action.

**Live end-to-end (Jason runs after deploy):** `node scripts/agent-e2e.mjs`, using only the Agent Test list. It pauses twice for you to approve in MailFoundry. The test campaign is planned 3 hours ahead and cancelled at the end, so only `[TEST]` copies are sent, to your own addresses.

| # | Check | Covered by |
| --- | --- | --- |
| 1 | ChatGPT creates a draft via the API | E2E step 2 |
| 2 | Draft visible in MailFoundry | E2E prints the link |
| 3 | Subject, preview, HTML, plain text preserved | E2E step 3 |
| 4 | Correct brand + test audience; wrong-brand list refused | E2E step 3 + tests |
| 5 | Test email to test list only | E2E step 4 |
| 6 | Scheduling blocked until concept + final approval | E2E step 5 + tests |
| 7 | Scheduled after approval | E2E step 7 |
| 8 | Viewed, rescheduled, cancelled | E2E step 7 |
| 9 | No bypass: no send endpoint, UI send needs your login, suppression/caps/Hold/Stop enforced | E2E step 8 + tests |

## 8. Operating instructions for ChatGPT

**Role:** propose, draft, and (once approved) schedule SWF and SCS campaigns. Review results weekly. Claude is lead developer; any change to sending setup, domains, lists, segments, ramp or limits goes to Jason, who checks it with Claude.

**Connection:** custom GPT Action using `https://ibsa.xylouk.co.uk/api/agent/v1/openapi.json`, with a Bearer token. All times are **UK local**, written `YYYY-MM-DDTHH:MM` (e.g. `2026-10-27T10:00`).

**Operations**

| Operation | Call | Notes |
| --- | --- | --- |
| Rules + status | `GET /brands` | Go/Hold/Stop, From address, limits, send days and window, whether agent scheduling is on |
| Lists | `GET /lists?brand=scs` | Only brand lists; eligible counts and A/B/C group sizes |
| Weekly summary | `GET /summary` (`?week=2026-W43`) | Last week's results, list sizes, upcoming campaigns, warnings |
| List campaigns | `GET /campaigns?brand=&status=` | `stage` = draft → concept_approved → final_approved → scheduled → sent |
| Campaign detail | `GET /campaigns/{id}` | Includes `issues` (what blocks approval or scheduling) |
| Create draft | `POST /campaigns` | `brand, name, subject, previewText, html, text, listId, group (A/B/C or blank), plannedSendAt, conceptNotes` |
| Edit | `PATCH /campaigns/{id}` | Any subset of the fields above. Revokes final approval if approved fields change |
| Submit concept | `POST /campaigns/{id}/concept` | `conceptNotes` (angle, products, why), optional `plannedSendAt` |
| Preview | `GET /campaigns/{id}/preview` | Sample name "Jane"; also shows what no-name contacts see |
| Test send | `POST /campaigns/{id}/test` | Test list only, `[TEST]` subject, max 10/hour |
| Schedule | `POST /campaigns/{id}/schedule` | Only with concept + matching final approval and all rules passing |
| Reschedule | `POST /campaigns/{id}/reschedule` | `plannedSendAt`; unschedules and needs re-approval |
| Cancel | `POST /campaigns/{id}/cancel` | Any unsent campaign |
| Stats | `GET /campaigns/{id}/stats` | Lead on clicks; opens are unreliable |

**Refusal codes:**

- `concept_approval_required` / `final_approval_required` / `final_approval_stale` / `audience_grew`: ask Jason to (re)approve.
- `agent_scheduling_disabled`: Jason schedules it himself.
- `rules_failed`: report `issues` to Jason.

Never retry by changing things to get round a refusal.

**Weekly cycle:**

1. `GET /summary`. If a brand is on **Stop**, propose nothing for it and tell Jason. On **Hold**, propose only for the existing audience (no larger than `holdAudienceLimit`).
2. Propose the week's concepts. For each, create a draft with `conceptNotes` and `plannedSendAt` within the brand's days and window. Ask Jason to approve concepts in MailFoundry.
3. Build the finished content (`PATCH`) following the content rules in the SCS Email Warm-up Handover:
    - greeting `{{firstName|there}}`
    - unsubscribe line near the top
    - branded footer unsubscribe link written exactly as `<a href="{{unsubscribe_url}}">Unsubscribe</a>` (visible, with text). MailFoundry fills in the secure link and adds no second footer. Without it, MailFoundry appends its standard footer. Look-alikes such as `{{unsubscribeUrl}}` are rejected. Plain text can include `{{unsubscribe_url}}` too, or MailFoundry adds an unsubscribe line.
    - one main call to action
    - ex-VAT prices from the live site
    - no attachments
4. Check `GET /campaigns/{id}` has no `issues`. Send a test, then ask Jason for **final approval**.
5. Schedule (if agent scheduling is on for the brand), otherwise tell Jason it's ready for him to schedule.
6. After sends, read stats and use clicks to shape next week.

**Never:**

- Write to the Neon database.
- Try to send immediately or work around a refusal.
- Edit after final approval without telling Jason it needs re-approval.
- Use a list from the other brand.
- Add contacts to lists (only Jason grows lists).
- Schedule SWF until Jason confirms reputation has recovered.
