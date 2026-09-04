type SendEmailInput = {
  from?: string;
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail({ from, to, subject, text, html }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  // Transactional emails (login, orders, etc.) may omit `from` and fall back to the env var
  // or the IBSA default. Campaign sends must always pass an explicit `from` via the campaign's
  // fromEmail field — the campaign route validates this before calling sendEmail.
  const fromAddress =
    from ?? process.env.EMAIL_FROM ?? "IBSA · Xylo Supplies <noreply@xylouk.co.uk>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to,
      subject,
      text,
      html: html ?? text.replace(/\n/g, "<br />"),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  return res.json();
}