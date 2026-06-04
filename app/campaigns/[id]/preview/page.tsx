import Link from "next/link";
import { prisma } from "../../../../src/lib/prisma";
import { notFound } from "next/navigation";
import AppShell from "../../../../src/components/app-shell";
import SendTestEmailForm from "../../../../src/components/send-test-email-form";
import { addEmailFooter } from "../../../../src/lib/emailFooter";

type PreviewCampaignPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PreviewCampaignPage({
  params,
}: PreviewCampaignPageProps) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      list: true,
    },
  });

  if (!campaign) {
    notFound();
  }

  const basePreviewHtml =
    campaign.html && campaign.html.trim().length > 0
      ? campaign.html
      : `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        ${campaign.body.replace(/\n/g, "<br />")}
      </div>
    `;

  const previewHtml = addEmailFooter(basePreviewHtml, "preview@example.com");

  return (
    <AppShell active="campaigns">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Marketing</p>
          <h2 className="text-3xl font-bold">Campaign Preview</h2>
          <p className="mt-2 text-sm text-slate-400">
            Previewing: {campaign.name}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/campaigns/${campaign.id}`}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Back to Campaign
          </Link>
        </div>
      </header>

      <div className="mb-6">
        <SendTestEmailForm campaignId={campaign.id} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Subject Line</p>
          <p className="mt-3 text-lg font-semibold">{campaign.subject}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Target List</p>
          <p className="mt-3 text-lg font-semibold">{campaign.list.name}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Status</p>
          <p className="mt-3 text-lg font-semibold capitalize">
            {campaign.status}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-white text-slate-900 shadow-sm">
        <div className="border-b border-slate-200 px-8 py-6">
          <p className="text-sm text-slate-500">Subject</p>
          <h3 className="mt-2 text-2xl font-bold">{campaign.subject}</h3>
        </div>

        <div className="px-8 py-8">
          <div
            className="text-base leading-7"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </AppShell>
  );
}
