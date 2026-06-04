"use client";

import { useState } from "react";

type SendTestEmailFormProps = {
  campaignId: string;
};

function getFriendlySendError(error: string) {
  if (error.includes("Email address is not verified")) {
    return "SES sandbox: recipient not verified";
  }

  return error;
}

export default function SendTestEmailForm({
  campaignId,
}: SendTestEmailFormProps) {
  const [email, setEmail] = useState("info@staffordshirewoodfuels.co.uk");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function handleSendTest() {
    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send test email.");
      }

      setStatus("sent");
      setMessage("Test email sent successfully.");
    } catch (error) {
      setStatus("error");
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send test email.";

      setMessage(getFriendlySendError(errorMessage));
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">Send Test Email</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:border-orange-500"
          placeholder="test@example.com"
        />

        <button
          type="button"
          onClick={handleSendTest}
          disabled={status === "sending"}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "sending" ? "Sending..." : "Send Test"}
        </button>
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${
            status === "sent" ? "text-green-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
