"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SendCampaignButtonProps = {
  campaignId: string;
  campaignStatus: string;
};

type SendResult = {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  skippedUnsubscribed: number;
  skippedArchived: number;
  skippedBounced: number;
  skippedComplained: number;
  skippedUnknown: number;
};

export default function SendCampaignButton({
  campaignId,
  campaignStatus,
}: SendCampaignButtonProps) {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState("");

  const hasAlreadyBeenSent =
    campaignStatus === "sent" || campaignStatus === "partially_sent";

  async function handleSendCampaign() {
    setIsSending(true);
    setIsConfirming(false);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmResend: hasAlreadyBeenSent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send campaign.");
        return;
      }

      setResult({
        sent: data.sent ?? 0,
        failed: data.failed ?? 0,
        skipped: data.skipped ?? 0,
        total: data.total ?? 0,
        skippedUnsubscribed: data.skippedUnsubscribed ?? 0,
        skippedArchived: data.skippedArchived ?? 0,
        skippedBounced: data.skippedBounced ?? 0,
        skippedComplained: data.skippedComplained ?? 0,
        skippedUnknown: data.skippedUnknown ?? 0,
      });

      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Something went wrong while sending the campaign.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      {!isConfirming ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-300">
              {hasAlreadyBeenSent ? "Send Again" : "Send Campaign"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {hasAlreadyBeenSent
                ? "This campaign has already been sent. Sending again will email eligible contacts in the selected list again."
                : "Sends this campaign to eligible contacts in the selected list."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            disabled={isSending}
            className={
              hasAlreadyBeenSent
                ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                : "rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {isSending
              ? "Sending..."
              : hasAlreadyBeenSent
                ? "Send Again"
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
            <p
              className={
                hasAlreadyBeenSent
                  ? "text-sm font-semibold text-red-200"
                  : "text-sm font-semibold text-orange-200"
              }
            >
              {hasAlreadyBeenSent
                ? "This campaign was already sent"
                : "Are you sure?"}
            </p>
            <p
              className={
                hasAlreadyBeenSent
                  ? "mt-1 text-sm text-red-100/80"
                  : "mt-1 text-sm text-orange-100/80"
              }
            >
              {hasAlreadyBeenSent
                ? "Sending again will email eligible contacts in the selected list again. Only continue if this is intentional."
                : "This will send the campaign to eligible contacts in the selected list."}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              disabled={isSending}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSendCampaign}
              disabled={isSending}
              className={
                hasAlreadyBeenSent
                  ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  : "rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              {isSending
                ? "Sending..."
                : hasAlreadyBeenSent
                  ? "Yes, send again"
                  : "Yes, send campaign"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm">
          <p className="font-semibold text-green-300">Campaign send complete</p>

          <div className="mt-3 grid gap-2 text-slate-300 md:grid-cols-2 xl:grid-cols-4">
            <p>
              Sent:{" "}
              <span className="font-semibold text-green-400">
                {result.sent}
              </span>
            </p>
            <p>
              Failed:{" "}
              <span className="font-semibold text-red-400">
                {result.failed}
              </span>
            </p>
            <p>
              Total processed:{" "}
              <span className="font-semibold text-white">{result.total}</span>
            </p>
            <p>
              Total skipped:{" "}
              <span className="font-semibold text-yellow-400">
                {result.skipped}
              </span>
            </p>
            <p>
              Unsubscribed:{" "}
              <span className="font-semibold text-yellow-400">
                {result.skippedUnsubscribed}
              </span>
            </p>
            <p>
              Archived:{" "}
              <span className="font-semibold text-slate-300">
                {result.skippedArchived}
              </span>
            </p>
            <p>
              Bounced:{" "}
              <span className="font-semibold text-orange-400">
                {result.skippedBounced}
              </span>
            </p>
            <p>
              Complained:{" "}
              <span className="font-semibold text-red-400">
                {result.skippedComplained}
              </span>
            </p>
            <p>
              Unknown:{" "}
              <span className="font-semibold text-slate-400">
                {result.skippedUnknown}
              </span>
            </p>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
