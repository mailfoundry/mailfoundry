import { prisma } from "../../../src/lib/prisma";
import Sidebar from "../../../src/components/sidebar";

export const metadata = { title: "Tools — IBSA Portal" };
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

export default async function ToolsPage() {
  const [views, todayCount, weekCount] = await Promise.all([
    prisma.pageView.findMany({
      orderBy: { viewedAt: "desc" },
      take: 300,
    }),
    prisma.pageView.count({
      where: { viewedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.pageView.count({
      where: {
        viewedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const total = await prisma.pageView.count();

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar active="ibsa-tools" isMainUser />

      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500 mb-2">
            Tools
          </p>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Site Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Server-side page view tracking — both sites, no cookies.
          </p>
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-3 gap-4 max-w-lg">
          <StatCard label="Total views" value={total} />
          <StatCard label="This week" value={weekCount} />
          <StatCard label="Today" value={todayCount} />
        </div>

        {/* Table */}
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
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/London",
                  });
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Td>
                        <span className="tabular-nums text-gray-400 text-xs whitespace-nowrap">
                          {time}
                        </span>
                      </Td>
                      <Td>
                        <span className={`text-xs font-semibold ${site.colour}`}>
                          {site.label}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs text-gray-700">
                          {v.pathname}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-xs text-gray-500">
                          {parseDevice(v.userAgent)} · {parseBrowser(v.userAgent)}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-xs text-gray-500">
                          {fromLabel(v.referer)}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs text-gray-400">
                          {v.ip}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {views.length === 300 && (
          <p className="mt-3 text-xs text-gray-400 text-center">
            Showing most recent 300 views
          </p>
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
