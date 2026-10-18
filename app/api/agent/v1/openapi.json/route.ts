import { NextResponse } from "next/server";

// Public (no secrets) — paste this URL into the custom GPT's Action "Import from URL".
export function GET() {
  const server = process.env.APP_BASE_URL ?? "https://ibsa.xylouk.co.uk";
  const id = { name: "id", in: "path", required: true, schema: { type: "string" } };
  const ok = (description: string) => ({ "200": { description, content: { "application/json": { schema: { type: "object" } } } } });
  const draft = {
    type: "object",
    properties: {
      name: { type: "string", description: "Internal name, e.g. 'SCS wk44 Tue — Christeyns floor care'" },
      subject: { type: "string", description: "Plain, specific, under ~50 chars. No ALL CAPS, emoji or £ in subject." },
      previewText: { type: "string", description: "Preview/preheader text, different from the first sentence" },
      html: { type: "string", description: "Full HTML. Greeting must be 'Hi {{firstName|there}},'. Footer + unsubscribe are added automatically." },
      text: { type: "string", description: "Plain-text version (required)" },
      listId: { type: "string", description: "A list id from GET /lists for the same brand" },
      group: { type: "string", enum: ["A", "B", "C", ""], description: "One third of the list (SCS warm-up: one group per send day). Blank = whole list." },
      plannedSendAt: { type: "string", description: "UK local time 'YYYY-MM-DDTHH:MM', within the brand's send days/window" },
      conceptNotes: { type: "string", description: "Angle, product(s), reasoning — what Jason approves at concept stage" },
    },
  };
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "MailFoundry agent API",
      version: "1.0.0",
      description:
        "Create and manage SWF/SCS marketing campaigns. The agent can draft, preview, test-send (test list only), schedule ONLY after Jason's final approval in MailFoundry, cancel and report. It cannot approve, send immediately or change brand rules. Any edit after final approval revokes it.",
    },
    servers: [{ url: `${server}/api/agent/v1` }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
    security: [{ bearer: [] }],
    paths: {
      "/brands": { get: { operationId: "getBrands", summary: "Brand rules, status (go/hold/stop), health and lists", responses: ok("Brands") } },
      "/lists": {
        get: {
          operationId: "getLists",
          summary: "Brand lists with eligible counts and A/B/C group sizes",
          parameters: [{ name: "brand", in: "query", schema: { type: "string", enum: ["scs", "swf"] } }],
          responses: ok("Lists"),
        },
      },
      "/summary": {
        get: {
          operationId: "getWeeklySummary",
          summary: "Weekly planning summary per brand: last week's results, list sizes, upcoming campaigns, warnings",
          parameters: [
            { name: "week", in: "query", schema: { type: "string" }, description: "ISO week e.g. 2026-W43; default last full week" },
            { name: "brand", in: "query", schema: { type: "string", enum: ["scs", "swf"] } },
          ],
          responses: ok("Summary"),
        },
      },
      "/campaigns": {
        get: {
          operationId: "listCampaigns",
          summary: "List branded campaigns",
          parameters: [
            { name: "brand", in: "query", schema: { type: "string", enum: ["scs", "swf"] } },
            { name: "status", in: "query", schema: { type: "string", enum: ["draft", "scheduled", "sending", "sent", "failed", "cancelled", "blocked"] } },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
          responses: ok("Campaigns"),
        },
        post: {
          operationId: "createDraft",
          summary: "Create a DRAFT campaign (never sends or schedules)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { ...draft, required: ["brand", "name", "subject", "text", "listId"], properties: { brand: { type: "string", enum: ["scs", "swf"] }, ...draft.properties } } } },
          },
          responses: { "201": { description: "Created", content: { "application/json": { schema: { type: "object" } } } } },
        },
      },
      "/campaigns/{id}": {
        get: { operationId: "getCampaign", summary: "Full campaign incl. html/text, approvals, issues blocking approval/scheduling", parameters: [id], responses: ok("Campaign") },
        patch: {
          operationId: "updateDraft",
          summary: "Update an unsent campaign (partial). Revokes final approval if approved content/audience/time changes.",
          parameters: [id],
          requestBody: { required: true, content: { "application/json": { schema: draft } } },
          responses: ok("Campaign"),
        },
      },
      "/campaigns/{id}/concept": {
        post: {
          operationId: "submitConcept",
          summary: "Submit the concept for Jason's approval (does not approve)",
          parameters: [id],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["conceptNotes"], properties: { conceptNotes: { type: "string" }, plannedSendAt: { type: "string" } } } } } },
          responses: ok("Submitted"),
        },
      },
      "/campaigns/{id}/preview": {
        get: {
          operationId: "previewCampaign",
          summary: "Rendered preview with sample merge data",
          parameters: [id, { name: "format", in: "query", schema: { type: "string", enum: ["json", "html"] } }],
          responses: ok("Preview"),
        },
      },
      "/campaigns/{id}/test": {
        post: {
          operationId: "sendTest",
          summary: "Send a [TEST] copy to the test list only (max 5 recipients, 10 per hour)",
          parameters: [id],
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { email: { type: "string", description: "Optional: one address that is on a test list" } } } } } },
          responses: ok("Sent"),
        },
      },
      "/campaigns/{id}/schedule": {
        post: {
          operationId: "scheduleApproved",
          summary: "Schedule at the approved plannedSendAt. Refused without matching final approval, or if any brand rule fails.",
          parameters: [id],
          responses: { ...ok("Scheduled"), "409": { description: "Refused — see error.issues" }, "403": { description: "Agent scheduling disabled for brand" } },
        },
      },
      "/campaigns/{id}/reschedule": {
        post: {
          operationId: "rescheduleCampaign",
          summary: "Change planned time of an unsent campaign (needs Jason's re-approval)",
          parameters: [id],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["plannedSendAt"], properties: { plannedSendAt: { type: "string" } } } } } },
          responses: ok("Rescheduled"),
        },
      },
      "/campaigns/{id}/cancel": { post: { operationId: "cancelCampaign", summary: "Cancel an unsent campaign", parameters: [id], responses: ok("Cancelled") } },
      "/campaigns/{id}/stats": { get: { operationId: "getCampaignStats", summary: "Delivery and engagement stats", parameters: [id], responses: ok("Stats") } },
    },
  };
  return NextResponse.json(spec, { headers: { "Cache-Control": "public, max-age=300" } });
}
