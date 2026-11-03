import { NextResponse } from "next/server";

// Public (no secrets) — paste this URL into the custom GPT's Action "Import from URL".
export function GET() {
  const server = process.env.APP_BASE_URL ?? "https://ibsa.xylouk.co.uk";
  const id = { name: "id", in: "path", required: true, schema: { type: "string" } };
  const obj = { type: "object", properties: {}, additionalProperties: true };
  const ok = (description: string) => ({ "200": { description, content: { "application/json": { schema: obj } } } });
  const draft = {
    type: "object",
    properties: {
      name: { type: "string", description: "Internal name, e.g. 'SCS wk44 Tue — Christeyns floor care'" },
      subject: { type: "string", description: "Plain, specific, under ~50 chars. No ALL CAPS, emoji or £ in subject." },
      previewText: { type: "string", description: "Preview/preheader text, different from the first sentence" },
      content: {
        type: "object",
        description:
          "Campaign content. MailFoundry builds the email from the brand's fixed layout (logo/header, colours, product cards, sign-off, footer with unsubscribe) and the plain-text version. Plain text only, no HTML. Send the FULL content object on every update.",
        required: ["headline", "intro", "cta"],
        properties: {
          eyebrow: { type: "string", description: "Small label above the headline, e.g. 'Get ready for winter' (optional, max 40)" },
          headline: { type: "string", description: "Main headline (max 90)" },
          intro: { type: "string", description: "Opening copy after 'Hi {{firstName|there}},' (added automatically). Separate paragraphs with a blank line. Max 900." },
          heroImage: {
            type: "object",
            description: "Optional full-width image. Must be a real hosted image from the brand's shop.",
            properties: { url: { type: "string" }, alt: { type: "string" }, link: { type: "string" } },
          },
          highlight: {
            type: "object",
            description: "Optional offer/banner box, e.g. 'FREE Saturday Delivery'. Button is optional.",
            properties: { eyebrow: { type: "string" }, title: { type: "string" }, text: { type: "string" }, buttonText: { type: "string" }, url: { type: "string" } },
          },
          productsHeading: { type: "string", description: "Heading above the product cards, e.g. 'Your winter fuel essentials'" },
          products: {
            type: "array",
            description: "Up to 4 products. Each becomes a card with image, name, description and a SHOP button; image, name and button all link to url. Take url and imageUrl from GET /products — don't invent them.",
            items: {
              type: "object",
              required: ["name", "description", "url", "imageUrl"],
              properties: {
                name: { type: "string" },
                description: { type: "string", description: "One or two short sentences (max 200)" },
                url: { type: "string", description: "Product or category page on the brand's site" },
                imageUrl: { type: "string", description: "imageUrl from GET /products" },
                buttonText: { type: "string", description: "e.g. 'SHOP LOGS' (default 'SHOP <NAME>')" },
              },
            },
          },
          closingHeading: { type: "string" },
          closingText: { type: "string" },
          cta: { type: "object", required: ["text", "url"], properties: { text: { type: "string", description: "e.g. 'SHOP WINTER FUELS →'" }, url: { type: "string", description: "Page on the brand's site" } } },
          signOff: { type: "string", description: "Default 'Stay warm,' (SWF) / 'Best wishes,' (SCS)" },
        },
      },
      listId: { type: "string", description: "A list id from GET /lists for the same brand" },
      group: { type: "string", enum: ["A", "B", "C", ""], description: "One third of the list (SCS warm-up: one group per send day). Blank = whole list." },
      plannedSendAt: { type: "string", description: "UK local time 'YYYY-MM-DDTHH:MM'. Use the brand's preferred time (getBrands preferredTimesUk): SCS Mon/Wed/Fri 09:30 (window 09:00–11:00), SWF Tue/Thu/Sat 08:15 (window 08:00–10:00). SWF max 2 campaigns/week (Tue/Thu), SWF Engaged list only." },
      conceptNotes: { type: "string", description: "Angle, product(s), reasoning — what Jason approves at concept stage" },
    },
  };
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "MailFoundry agent API",
      version: "1.1.0",
      description:
        "Create and manage SWF/SCS marketing campaigns. The agent can draft, preview, test-send (test list only), schedule ONLY after Jason's final approval in MailFoundry, cancel and report. It cannot approve, send immediately or change brand rules. Any edit after final approval revokes it.",
    },
    servers: [{ url: `${server}/api/agent/v1` }],
    components: { schemas: {}, securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
    security: [{ bearer: [] }],
    paths: {
      "/brands": { get: { operationId: "getBrands", summary: "Brand rules, status (go/hold/stop), health and lists", responses: ok("Brands") } },
      "/products": {
        get: {
          operationId: "searchProducts",
          summary: "Search the brand's shop for real products (name, page url, hosted imageUrl, price, availability). Use these url/imageUrl values in content.products.",
          parameters: [
            { name: "brand", in: "query", required: true, schema: { type: "string", enum: ["scs", "swf"] } },
            { name: "q", in: "query", schema: { type: "string" }, description: "e.g. 'kindling', 'wet floor sign'" },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
          responses: ok("Products"),
        },
      },
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
          summary: "Create a DRAFT campaign (never sends or schedules) from structured content. MailFoundry builds the branded HTML and plain text; html/text fields are refused. Check the result with previewCampaign.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { ...draft, required: ["brand", "name", "subject", "content", "listId"], properties: { brand: { type: "string", enum: ["scs", "swf"] }, ...draft.properties } } } },
          },
          responses: { "201": { description: "Created", content: { "application/json": { schema: obj } } } },
        },
      },
      "/campaigns/{id}": {
        get: { operationId: "getCampaign", summary: "Campaign details, approvals, issues and the content the email was built from (content is null for older hand-written HTML). Full HTML only with includeHtml=true.", parameters: [id, { name: "includeHtml", in: "query", schema: { type: "string", enum: ["true", "false"] }, description: "Return the full html/text (large). Default false." }], responses: ok("Campaign") },
        patch: {
          operationId: "updateDraft",
          summary: "Update an unsent campaign (partial; send only the fields you change, but if you change content send the whole content object). html/text are refused — MailFoundry rebuilds them from content. The response includes the saved content. Revokes final approval if approved content/audience/time changes.",
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
