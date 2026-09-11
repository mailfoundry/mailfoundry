import { prisma } from "../../../src/lib/prisma";
import Sidebar from "../../../src/components/sidebar";

export const metadata = { title: "Analytics" };

const EXCLUDED_IPS = ["81.153.15.100"];
export const dynamic = "force-dynamic";

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return "Browser";
}

function parseDevice(ua: string): string {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua) && /Mobile/.test(ua)) return "Android";
  if (/Android/.test(ua)) return "Tablet";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

function fromLabel(referer: string): string {
  if (!referer) return "direct";
  try {
    const h = new URL(referer).hostname;
    return h.replace(/^www\./, "");
  } catch {
    return "direct";
  }
}

function siteLabel(hostname: string): { label: string; colour: string } {
  if (hostname.startsWith("ibsa"))
    return { label: "IBSA", colour: "text-indigo-600" };
  return { label: "Xylo", colour: "text-orange-500" };
}

function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function groupTypeBadge(type: string) {
  const map: Record<string, string> = {
    congregation: "bg-blue-50 text-blue-700",
    circuit:      "bg-purple-50 text-purple-700",
    regional:     "bg-green-50 text-green-700",
  };
  return map[type] ?? "bg-gray-100 text-gray-600";
}

export default async function ToolsPage() {
  const ipFilter = { ip: { notIn: EXCLUDED_IPS } };

  const [views, todayCount, weekCount, total, accounts] = await Promise.all([
    prisma.pageView.findMany({
      where:   ipFilter,
      orderBy: { viewedAt: "desc" },
      take: 300,
    }),
    prisma.pageView.count({
      where: { ...ipFilter, viewedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.pageView.count({
      where: { ...ipFilter, viewedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.pageView.count({ where: ipFilter }),
    prisma.groupAccount.findMany({
      include: {
        tokens: {
          where:   { usedAt: { not: null } },
          orderBy: { usedAt: "desc" },
          take:    1,
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take:    1,
          select:  { createdAt: true },
        },
        _count: { select: { orders: true } },
      },
    }),
  ]);

  // Sort: most recently logged in first, never-logged-in last
  const sortedAccounts = [...accounts].sort((a, b) => {
    const aLogin = a.tokens[0]?.usedAt?.getTime() ?? 0;
    const bLogin = b.tokens[0]?.usedAt?.getTime() ?? 0;
    return bLogin - aLogin;
  });

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar active="ibsa-tools" isMainUser />

      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500 mb-2">
            Tools
          </p>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Account activity and page view tracking. Your IP is excluded.
          </p>
        </div>

        {/* Account activity */}
        <div className="mb-4 flex items-end gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-gray-900">Account Activity</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Login history and order activity for all group accounts.
            </p>
          </div>
          <span className="ml-auto text-xs text-gray-400">{accounts.length} accounts</span>
        </div>

        <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <Th>Group</Th>
                <Th>Type</Th>
                <Th>Email</Th>
                <Th>Last login</Th>
                <Th>Orders</Th>
                <Th>Last order</Th>
              </tr>
            </thead>
            <tbody>
              {sortedAccounts.map((a) => {
                const lastLogin  = a.tokens[0]?.usedAt ?? null;
                const lastOrder  = a.orders[0]?.createdAt ?? null;
                const daysAgo    = daysSince(lastLogin);
                const loginLabel = lastLogin
                  ? lastLogin.toLocaleString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
                    })
                  : null;
                const orderLabel = lastOrder
                  ? lastOrder.toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })
                  : null;

                const agePill =
                  daysAgo === null
                    ? "bg-gray-100 text-gray-400"
                    : daysAgo <= 7
                    ? "bg-green-100 text-green-700"
                    : daysAgo <= 30
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-600";

                const ageText =
                  daysAgo === null
                    ? "Never"
                    : daysAgo === 0
                    ? "Today"
                    : daysAgo === 1
                    ? "Yesterday"
                    : `${daysAgo}d ago`;

                return (
                  <tr key={a.id} className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                    <Td>
                      <span className="font-medium text-gray-900">{a.groupName}</span>
                      <span className="block text-xs text-gray-400">{a.contactName}</span>
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${groupTypeBadge(a.groupType)}`}>
                        {a.groupType}
                      </span>
                    </Td>
                    <Td>
                      <a href={`mailto:${a.contactEmail}`} className="text-xs text-blue-600 hover:underline">
                        {a.contactEmail}
                      </a>
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${agePill}`}>
                        {ageText}
                      </span>
                      {loginLabel && (
                        <span className="block text-[10px] text-gray-400 mt-0.5 tabular-nums">{loginLabel}</span>
                      )}
                    </Td>
                    <Td>
                      <span className="font-semibold text-gray-900 tabular-nums">{a._count.orders}</span>
                    </Td>
                    <Td>
                      <span className="text-xs text-gray-500">{orderLabel ?? "—"}</span>
                    </Td>
                  </tr>
                );
              })}
              {sortedAccounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                    No group accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Page views */}
        <div className="mt-12 mb-4 flex items-end gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-gray-900">Page Views</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Server-side tracking — both sites, no cookies, your IP excluded.
            </p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-4 max-w-lg">
          <StatCard label="Total views" value={total} />
          <StatCard label="This week"   value={weekCount} />
          <StatCard label="Today"       value={todayCount} />
        </div>

        {views.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center text-gray-400 text-sm">
            No page views recorded yet.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <Th>Time</Th>
                  <Th>Site</Th>
                  <Th>Page</Th>
                  <Th>Device</Th>
                  <Th>From</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {views.map((v) => {
                  const site = siteLabel(v.hostname);
                  const time = v.viewedAt.toLocaleString("en-GB", {
                    day: "numeric", month: "short",
                    hour: "2-digit", minute: "2-digit",
                    timeZone: "Europe/London",
                  });
                  return (
                    <tr key={v.id} className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                      <Td><span className="tabular-nums text-gray-400 text-xs whitespace-nowrap">{time}</span></Td>
                      <Td><span className={`text-xs font-semibold ${site.colour}`}>{site.label}</span></Td>
                      <Td><span className="font-mono text-xs text-gray-700">{v.pathname}</span></Td>
                      <Td><span className="text-xs text-gray-500">{parseDevice(v.userAgent)} · {parseBrowser(v.userAgent)}</span></Td>
                      <Td><span className="text-xs text-gray-500">{fromLabel(v.referer)}</span></Td>
                      <Td><span className="font-mono text-xs text-gray-400">{v.ip}</span></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {views.length === 300 && (
          <p className="mt-3 text-xs text-gray-400 text-center">Showing most recent 300 views</p>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-5 py-4">
      <p className="text-2xl font-black tabular-nums text-gray-900">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}
