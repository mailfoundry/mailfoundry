"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SendCampaignButtonProps = {
  campaignId: string;
  campaignStatus: string;
};

type FinalResult = {
  totalSent: number;
  totalFailed: number;
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
  const [result, setResult] = useState<FinalResult | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{
    sent: number;
    remaining: number;
    batch: number;
  } | null>(null);

  const hasAlreadyBeenSent =
    campaignStatus === "sent" || campaignStatus === "partially_sent";

  async function handleSendCampaign() {
    setIsSending(true);
    setIsConfirming(false);
    setError("");
    setResult(null);

    let totalSent = 0;
    let totalFailed = 0;
    let skippedData = {
      skipped: 0,
      total: 0,
      skippedUnsubscribed: 0,
      skippedArchived: 0,
      skippedBounced: 0,
      skippedComplained: 0,
      skippedUnknown: 0,
    };
    let batch = 0;
    let remaining = 1; // seed > 0 to enter the loop

    try {
      while (remaining > 0) {
        batch++;
        setProgress({ sent: totalSent, remaining, batch });

        let data: Record<string, number & string>;
        try {
          const response = await fetch(`/api/campaigns/${campaignId}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Always pass confirmResend: true — user confirmed on button click;
            // subsequent batches need this because status will be "sent"/"partially_sent"
            body: JSON.stringify({ confirmResend: true }),
          });

          data = await response.json();

          if (!response.ok) {
            setError((data.error as string) || "Failed to send campaign.");
            break;
          }
        } catch {
          // Network error or Vercel timeout mid-batch — wait and retry
          // The DB already recorded everything sent so far, so no duplicates
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        totalSent += (data.sent as number) ?? 0;
        totalFailed += (data.failed as number) ?? 0;
        remaining = (data.remaining as number) ?? 0;

        // Capture skipped totals from the first batch (they're the same for all batches)
        if (batch === 1) {
          skippedData = {
            skipped: (data.skipped as number) ?? 0,
            total: (data.total as number) ?? 0,
            skippedUnsubscribed: (data.skippedUnsubscribed as number) ?? 0,
            skippedArchived: (data.skippedArchived as number) ?? 0,
            skippedBounced: (data.skippedBounced as number) ?? 0,
            skippedComplained: (data.skippedComplained as number) ?? 0,
            skippedUnknown: (data.skippedUnknown as number) ?? 0,
          };
        }

        setProgress({ sent: totalSent, remaining, batch });

        // Brief pause between batches to avoid hammering the server
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!error) {
        setResult({ totalSent, totalFailed, ...skippedData });
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong while sending the campaign.");
    } finally {
      setIsSending(false);
      setProgress(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
      {!isConfirming ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-600">
              {hasAlreadyBeenSent ? "Send Again" : "Send Campaign"}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {hasAlreadyBeenSent
                ? "This campaign has already been sent. Sending again will reach only contacts who haven't received it yet."
                : "Sends this campaign to eligible contacts in the selected list."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            disabled={isSending}
            className={
              hasAlreadyBeenSent
                ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                : "rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
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
                ? "Only contacts who haven't received it yet will be emailed. It will keep sending automatically until everyone is reached."
                : "This will send the campaign to eligible contacts. It will keep sending automatically until all contacts are reached."}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              disabled={isSending}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSendCampaign}
              disabled={isSending}
              className={
                hasAlreadyBeenSent
                  ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  : "rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
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

      {/* Live progress during send */}
      {isSending && progress && (
        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            <p className="font-semibold text-blue-300">
              Sending — batch {progress.batch}
            </p>
          </div>
          <div className="mt-2 grid gap-2 text-gray-500 md:grid-cols-3">
            <p>
              Sent so far:{" "}
              <span className="font-semibold text-green-500">
                {progress.sent.toLocaleString()}
              </span>
            </p>
            <p>
              Still to send:{" "}
              <span className="font-semibold text-blue-300">
                {progress.remaining.toLocaleString()}
              </span>
            </p>
            <p className="text-gray-600">
              Will continue automatically…
            </p>
          </div>
        </div>
      )}

      {/* Final result */}
      {result && !isSending && (
        <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm">
          <p className="font-semibold text-green-300">Campaign send complete</p>

          <div className="mt-3 grid gap-2 text-gray-600 md:grid-cols-2 xl:grid-cols-4">
            <p>
              Sent:{" "}
              <span className="font-semibold text-green-600">
                {result.totalSent.toLocaleString()}
              </span>
            </p>
            <p>
              Failed:{" "}
              <span className="font-semibold text-red-500">
                {result.totalFailed.toLocaleString()}
              </span>
            </p>
            <p>
              Total processed:{" "}
              <span className="font-semibold text-gray-900">
                {result.total.toLocaleString()}
              </span>
            </p>
            <p>
              Total skipped:{" "}
              <span className="font-semibold text-yellow-400">
                {result.skipped.toLocaleString()}
              </span>
            </p>
            <p>
              Unsubscribed:{" "}
              <span className="font-semibold text-yellow-400">
                {result.skippedUnsubscribed.toLocaleString()}
              </span>
            </p>
            <p>
              Archived:{" "}
              <span className="font-semibold text-gray-600">
                {result.skippedArchived.toLocaleString()}
              </span>
            </p>
            <p>
              Bounced:{" "}
              <span className="font-semibold text-orange-400">
                {result.skippedBounced.toLocaleString()}
              </span>
            </p>
            <p>
              Complained:{" "}
              <span className="font-semibold text-red-500">
                {result.skippedComplained.toLocaleString()}
              </span>
            </p>
            <p>
              Unknown:{" "}
              <span className="font-semibold text-gray-500">
                {result.skippedUnknown.toLocaleString()}
              </span>
            </p>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </div>
  );
}
