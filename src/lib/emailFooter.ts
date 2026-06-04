export function addEmailFooter(html: string, recipientEmail?: string) {
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const businessName = process.env.BUSINESS_NAME || "MailFoundry";

  const unsubscribePath = recipientEmail
    ? `/unsubscribe?email=${encodeURIComponent(recipientEmail)}`
    : "/unsubscribe";

  const unsubscribeUrl = `${appBaseUrl}${unsubscribePath}`;

  const footer = `
    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #6b7280;">
      <p style="margin: 0 0 8px;">
        You are receiving this email because you are on the ${businessName} mailing list.
      </p>
      <p style="margin: 0 0 8px;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">
          Unsubscribe
        </a>
      </p>
      <p style="margin: 0;">
        ${businessName}
      </p>
    </div>
  `;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${footer}</body>`);
  }

  return `${html}${footer}`;
}
