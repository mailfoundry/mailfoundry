import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "../../../src/lib/sendEmail";

const OWNER_EMAIL = "ridgejason@me.com";

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
  if (/Android/.test(ua) && /Mobile/.test(ua)) return "Android phone";
  if (/Android/.test(ua)) return "Android tablet";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown device";
}

export async function POST(request: NextRequest) {
  try {
    const { pathname, hostname, ip, userAgent, referer, timestamp } =
      (await request.json()) as {
        pathname: string;
        hostname: string;
        ip: string;
        userAgent: string;
        referer: string;
        timestamp: string;
      };

    const isIbsa = hostname?.includes("ibsa");
    const site = isIbsa ? "IBSA Portal" : "Xylo (UK) Ltd";
    const siteColour = isIbsa ? "#6366f1" : "#c2410c";

    const dt = new Date(timestamp);
    const formattedTime = dt.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    });

    const browser = parseBrowser(userAgent);
    const device = parseDevice(userAgent);

    let fromLabel = "direct";
    if (referer) {
      try {
        fromLabel = new URL(referer).hostname;
      } catch {
        fromLabel = referer;
      }
    }

    const subject = `[${site}] ${pathname}`;

    const row = (label: string, value: string) => `
      <tr>
        <td style="color:#64748b;font-size:12px;padding:7px 0;border-bottom:1px solid #1e293b;width:80px;vertical-align:top;">${label}</td>
        <td style="color:#cbd5e1;font-size:12px;padding:7px 0;border-bottom:1px solid #1e293b;">${value}</td>
      </tr>`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:460px;margin:0 auto;">
        <div style="background:#0f172a;border-radius:14px;padding:28px 28px 24px;">
          <p style="color:${siteColour};font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.14em;margin:0 0 5px;">${site}</p>
          <p style="color:#f1f5f9;font-size:18px;font-weight:bold;margin:0 0 20px;word-break:break-all;">${pathname}</p>
          <table style="width:100%;border-collapse:collapse;">
            ${row("Time", formattedTime)}
            ${row("Device", `${device} · ${browser}`)}
            ${row("IP", ip)}
            <tr>
              <td style="color:#64748b;font-size:12px;padding:7px 0;width:80px;">From</td>
              <td style="color:#cbd5e1;font-size:12px;padding:7px 0;">${fromLabel}</td>
            </tr>
          </table>
        </div>
      </div>`;

    const text = [
      `[${site}] ${pathname}`,
      `Time:   ${formattedTime}`,
      `Device: ${device} · ${browser}`,
      `IP:     ${ip}`,
      `From:   ${fromLabel}`,
    ].join("\n");

    await sendEmail({ to: OWNER_EMAIL, subject, text, html });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
