// In-memory fake of the Prisma calls used by brand-rules / dispatch / agent-views (tests only).
const db = { campaign: [], list: [], brand: [], contact: [], contactList: [], campaignSend: [], campaignClick: [], campaignApproval: [], auditLog: [], agentToken: [], scheduleException: [] };
let seq = 0;
const id = () => "id" + ++seq;
const PK = { brand: "key" };
const pk = (m) => PK[m] || "id";

const REL = {
  campaign: { list: ["one", "list", "listId"], brand: ["one", "brand", "brandKey", "key"], sends: ["many", "campaignSend", "campaignId"], approvals: ["many", "campaignApproval", "campaignId"] },
  campaignSend: { campaign: ["one", "campaign", "campaignId"], contact: ["one", "contact", "contactId"], clicks: ["many", "campaignClick", "sendId"] },
  contactList: { contact: ["one", "contact", "contactId"], list: ["one", "list", "listId"] },
  contact: { lists: ["many", "contactList", "contactId"], campaignSends: ["many", "campaignSend", "contactId"] },
  list: { brand: ["one", "brand", "brandKey", "key"], contacts: ["many", "contactList", "listId"], campaigns: ["many", "campaign", "listId"] },
  brand: { lists: ["many", "list", "brandKey"], campaigns: ["many", "campaign", "brandKey"] },
};
function related(model, rec, key) {
  const [kind, target, fk, targetKey = "id"] = REL[model][key];
  if (kind === "one") return db[target].find((r) => r[targetKey] === rec[fk]) ?? null;
  return db[target].filter((r) => r[fk] === rec[pk(model)]);
}
const cmp = (a, b) => (a instanceof Date ? a.getTime() : a) - (b instanceof Date ? b.getTime() : b);
function scalar(v, cond) {
  if (cond === null || typeof cond !== "object" || cond instanceof Date) return cond instanceof Date ? v?.getTime() === cond.getTime() : v === cond;
  for (const [op, x] of Object.entries(cond)) {
    if (op === "in" && !x.includes(v)) return false;
    if (op === "notIn" && x.includes(v)) return false;
    if (op === "not" && (x === null ? v === null || v === undefined : scalar(v, x))) return false;
    if (op === "gte" && !(v != null && cmp(v, x) >= 0)) return false;
    if (op === "gt" && !(v != null && cmp(v, x) > 0)) return false;
    if (op === "lte" && !(v != null && cmp(v, x) <= 0)) return false;
    if (op === "lt" && !(v != null && cmp(v, x) < 0)) return false;
    if (op === "startsWith" && !String(v ?? "").startsWith(x)) return false;
    if (op === "contains" && !String(v ?? "").toLowerCase().includes(String(x).toLowerCase())) return false;
  }
  return true;
}
function match(model, rec, where) {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (k === "AND") { if (!cond.every((w) => match(model, rec, w))) return false; continue; }
    if (k === "OR") { if (!cond.some((w) => match(model, rec, w))) return false; continue; }
    if (k === "NOT") { if (match(model, rec, cond)) return false; continue; }
    if (REL[model]?.[k]) {
      const [kind, target] = REL[model][k];
      const r = related(model, rec, k);
      if (kind === "one") { if (!r || !match(target, r, cond)) return false; }
      else {
        if (cond.some && !r.some((x) => match(target, x, cond.some))) return false;
        if (cond.none && r.some((x) => match(target, x, cond.none))) return false;
        if (cond.every && !r.every((x) => match(target, x, cond.every))) return false;
      }
      continue;
    }
    if (!scalar(rec[k] ?? null, cond)) return false;
  }
  return true;
}
function shape(model, rec, spec) {
  if (!rec) return rec;
  const out = { ...rec };
  const rels = { ...(spec?.include || {}), ...(spec?.select || {}) };
  for (const [k, v] of Object.entries(rels)) {
    if (k === "_count" || !REL[model]?.[k] || !v) continue;
    const [kind, target] = REL[model][k];
    const r = related(model, rec, k);
    const sub = typeof v === "object" ? v : {};
    out[k] = kind === "one" ? shape(target, r, sub) : r.filter((x) => match(target, x, sub.where)).map((x) => shape(target, x, sub));
  }
  return out;
}
function order(rows, orderBy) {
  if (!orderBy) return rows;
  const [[k, dir]] = Object.entries(Array.isArray(orderBy) ? orderBy[0] : orderBy);
  return [...rows].sort((a, b) => (dir === "desc" ? -1 : 1) * cmp(a[k] ?? 0, b[k] ?? 0));
}
const DEFAULTS = {
  campaign: () => ({ testSentAt: null, testFingerprint: null, status: "draft", preheader: null, html: null, cohort: null, conceptNotes: null, plannedSendAt: null, createdBy: null, blockedReason: null, cancelledAt: null, scheduledAt: null, brandKey: null, createdAt: new Date(), updatedAt: new Date() }),
  campaignSend: () => ({ sentAt: new Date(), openedAt: null, error: null }),
  campaignApproval: () => ({ approvedAt: new Date(), revokedAt: null, revokedReason: null, audienceSize: null, sendAt: null }),
  auditLog: () => ({ at: new Date() }),
};
function api(model) {
  const T = () => db[model];
  return {
    findUnique: async ({ where, ...spec }) => shape(model, T().find((r) => match(model, r, where)) ?? null, spec),
    findFirst: async ({ where, orderBy, ...spec }) => shape(model, order(T().filter((r) => match(model, r, where)), orderBy)[0] ?? null, spec),
    findMany: async ({ where, orderBy, take, ...spec } = {}) => order(T().filter((r) => match(model, r, where)), orderBy).slice(0, take ?? 1e9).map((r) => shape(model, r, spec)),
    count: async ({ where } = {}) => T().filter((r) => match(model, r, where)).length,
    create: async ({ data }) => { const r = { [pk(model)]: id(), ...(DEFAULTS[model]?.() ?? {}), ...data }; T().push(r); return { ...r }; },
    createMany: async ({ data }) => { for (const d of data) T().push({ id: id(), ...(DEFAULTS[model]?.() ?? {}), ...d }); return { count: data.length }; },
    update: async ({ where, data }) => { const r = T().find((x) => match(model, x, where)); if (!r) throw new Error("not found"); Object.assign(r, data, { updatedAt: new Date() }); return { ...r }; },
    delete: async ({ where }) => { const i = T().findIndex((x) => match(model, x, where)); const [r] = T().splice(i, 1); return r; },
    updateMany: async ({ where, data }) => { const rs = T().filter((x) => match(model, x, where)); rs.forEach((r) => Object.assign(r, data)); return { count: rs.length }; },
    groupBy: async ({ by, where }) => {
      const g = new Map();
      for (const r of T().filter((x) => match(model, x, where))) { const k = r[by[0]]; g.set(k, (g.get(k) ?? 0) + 1); }
      return [...g].map(([k, n]) => ({ [by[0]]: k, _count: { _all: n } }));
    },
  };
}
exports.prisma = Object.fromEntries(Object.keys(db).map((m) => [m, api(m)]));
exports.__db = db;
exports.__reset = () => { for (const k of Object.keys(db)) db[k].length = 0; };
