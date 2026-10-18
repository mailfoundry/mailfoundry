# MailFoundry: ChatGPT campaign workflow (response to development request)

Prepared by Claude (lead developer, MailFoundry) · 18 October 2026

Status labels used throughout:

- **[LIVE]**: already implemented and running
- **[BUILD]**: needs development (nothing in this category exists yet)
- **[JASON]**: requires Jason's approval or action

Nothing in this document has been activated. No sending behaviour has changed.

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

1. **Deploy the signed-session security fix** already prepared: add `SESSION_SECRET` in Railway, then push. Required before any API work.
2. **Remove ChatGPT's write access to Neon.** Give it a read-only database user, or remove access once the API is live. With write access it can change suppression records and bypass every safeguard. GitHub read access is fine; no push rights.
3. **After 6C is built:** generate the agent API token in MailFoundry → Settings (shown once). Add it to the custom GPT as an Action using the published `openapi.json`, with Authentication set to "API key, Bearer".
4. **Create the test list** "Agent Test", containing only Jason's own addresses.
5. **Weekly:** enter the Postmaster spam rate for each brand in MailFoundry. Google's Postmaster data can't easily be pulled in automatically.

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

### 6A. Brand rules, limits, Hold/Stop **[BUILD]**, required before three a week

- **New `Brand` table** (swf, scs):
    - fixed From name and address
    - allowed lists
    - send days and times
    - weekly limit per contact
    - status Go / Hold / Stop, plus who set it and when
- **Each campaign belongs to a brand.** Its From address and list must match that brand; anything else is rejected.
- **Group assignment for SCS** (A/B/C) stored per contact.
- **Limits enforced at send time:** contacts over their weekly or daily limit are skipped and recorded as `capped`.
- **Status worked out automatically** from the last 7 days' complaints, bounces and unsubscribes, plus the Postmaster figure Jason enters.
    - **Hold:** blocks adding to the warm-up list and blocks scheduling to a larger audience than last week's.
    - **Stop:** blocks scheduling, and the send job skips the brand.
    - Only Jason can clear a Stop.

### 6B. Approvals and audit trail **[BUILD]**, required before three a week

- **New `CampaignApproval` table:** campaign, type (concept / final), approved by, approved at, and a fingerprint (hash) of the approved version.
    - Concept fingerprint covers: subject, angle, product, planned date.
    - Final fingerprint covers: subject, preview, HTML, plain text, sender, list, audience size, send time.
- **Approve buttons in MailFoundry,** shown only to Jason's logged-in session.
- **Scheduling requires a final approval whose fingerprint matches the current campaign.**
- **Any edit after final approval** cancels it. The campaign returns to "awaiting approval" and must be approved again.
- **The send job re-checks the fingerprint** just before sending. A mismatch means it doesn't send and the campaign is flagged.
- **New `AuditLog` table:** every create, edit, approval, schedule, cancel, Hold/Stop change and agent API call, with who/what/when.

### 6C. Agent API **[BUILD]**

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

### 6D. Weekly summary **[BUILD]**

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

**Status today:** design complete. Nothing in 6A–6D is built yet.

Test, run against the "Agent Test" list only. **No production send without Jason's separate authorisation.**

| # | Test | Expected result |
| --- | --- | --- |
| 1 | ChatGPT creates a draft via `POST /campaigns` | 201, campaign in `draft` |
| 2 | Draft visible in MailFoundry | Appears under the correct brand |
| 3 | Content preserved | Subject, preview, HTML, plain text identical to what was sent |
| 4 | Brand and list | SCS From address set automatically; an SWF list is rejected |
| 5 | Test send | Arrives at Jason's address with List-Unsubscribe header |
| 6 | Schedule before approval | Refused: `final_approval_required` |
| 7 | Jason approves in MailFoundry, ChatGPT schedules | Status `scheduled`, approval recorded in audit log |
| 8 | Edit after approval | Approval cancelled; schedule refused until re-approved |
| 9 | View and cancel | Status `cancelled`, never sent |
| 10 | Brand set to Stop | Schedule refused; send job skips |
| 11 | Suppressed contact on list | Never sent to |
| 12 | Contact already emailed this week | Skipped as `capped` |
| 13 | Direct send attempt via API | No such endpoint |

## 8. Operating instructions for ChatGPT

**Role:** propose, draft, and (once approved) schedule SWF and SCS campaigns. Review results weekly. Claude is lead developer; any change to sending setup, domains, lists, segments, ramp or limits goes to Jason, who checks it with Claude.

**Weekly cycle:**

1. `GET /summary` and `GET /brands`. If a brand is on **Stop**, propose nothing for it and tell Jason. On **Hold**, propose only for the existing audience.
2. Propose the week's concepts (subject, angle, product, date, brand, list). Create drafts and submit each concept. Wait for Jason's concept approval in MailFoundry.
3. Build the finished content in the drafts (`PATCH`), following the content rules in `SCS Email Warm-up Handover` (greeting `{{firstName|there}}`, unsubscribe line near the top, one main call to action, ex-VAT prices from the live site, no attachments).
4. Send a test (`POST /test`) and ask Jason to review. Wait for **final approval** in MailFoundry.
5. Schedule (`POST /schedule`) at the approved UK date and time. If refused, report the reason to Jason. Don't work around it.
6. After sends, read `/stats` and use clicks (not opens) to shape next week's proposals.

**Never:**

- Write to the Neon database.
- Try to send immediately or bypass a refusal.
- Edit a campaign after final approval without telling Jason it needs re-approval.
- Use a From address or list from the other brand.
- Add contacts beyond the ramp allowance, or re-add suppressed contacts.
- Schedule SWF automatically until Jason confirms reputation has recovered.
