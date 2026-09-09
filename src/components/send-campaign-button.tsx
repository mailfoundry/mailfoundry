"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SendCampaignButtonProps = {
  campaignId: string;
  campaignStatus: string;
};

export default function SendCampaignButton({
  campaignId,
  campaignStatus,
}: SendCampaignButtonProps) {
  const router = useRouter();
  const [isQueuing, setIsQueuing]   = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [queued, setQueued]         = useState(false);
  const [eligible, setEligible]     = useState<number | null>(null);
  const [error, setError]           = useState("");

  const hasAlreadyBeenSent =
    campaignStatus === "sent" || campaignStatus === "partially_sent";

  async function handleQueue() {
    setIsQueuing(true);
    setIsConfirming(false);
    setError("");
    setQueued(false);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        setError((data.error as string) || "Failed to queue campaign.");
        return;
      }

      setEligible(data.eligible ?? null);
      setQueued(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsQueuing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
      {!isConfirming ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-600">
              {hasAlreadyBeenSent ? "Continue / Resend" : "Send Campaign"}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {hasAlreadyBeenSent
                ? "Queue this campaign again — only contacts who haven't received it yet will be emailed."
                : "Queue this campaign. Sending runs automatically in the background — you can close this page."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            disabled={isQueuing}
            className={
              hasAlreadyBeenSent
                ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                : "rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {isQueuing
              ? "Queuing…"
              : hasAlreadyBeenSent
                ? "Continue Sending"
                : "Send Campaign"}
          </button>
        </div>
      ) : (
        <div
          className={
            hasAlreadyBeenSent
              ? "flex items-center justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
              : "flex items-center justify-between gap-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4"
          }
        >
          <div>
            <p className={hasAlreadyBeenSent ? "text-sm font-semibold text-red-200" : "text-sm font-semibold text-orange-200"}>
              {hasAlreadyBeenSent ? "Continue sending?" : "Are you sure?"}
            </p>
            <p className={hasAlreadyBeenSent ? "mt-1 text-sm text-red-100/80" : "mt-1 text-sm text-orange-100/80"}>
              The campaign will be queued and sent automatically — you can close this page once queued.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              disabled={isQueuing}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleQueue}
              disabled={isQueuing}
              className={
                hasAlreadyBeenSent
                  ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  : "rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              {isQueuing ? "Queuing…" : hasAlreadyBeenSent ? "Yes, continue" : "Yes, send campaign"}
            </button>
          </div>
        </div>
      )}

      {/* Queued confirmation */}
      {queued && !isQueuing && (
        <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm">
          <p className="font-semibold text-green-300">Campaign queued ✓</p>
          <p className="mt-1 text-gray-400">
            {eligible !== null ? `${eligible.toLocaleString()} eligible contacts` : "Your campaign"} will be sent automatically within the next 5 minutes.
            You can close this page — no further action needed.
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </div>
  );
}
