"use client";

import { useEffect, useState } from "react";

type PageViewRecord = {
  id: string;
  path: string;
  referrer: string | null;
  device: string | null;
  createdAt: string;
};

type WebBehaviourData = {
  pageViews: PageViewRecord[];
  total: number;
};

export default function ContactWebBehaviour({ contactId }: { contactId: string }) {
  const [data, setData]       = useState<WebBehaviourData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/contacts/${contactId}/web-behaviour`)
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => { throw new Error(e.error ?? "Failed"); }))
      .then((d: WebBehaviourData) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [contactId]);

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm p-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Web Behaviour</h3>
        {data && (
          <span className="text-sm text-gray-400">
            {data.total} page view{data.total !== 1 ? "s" : ""} attributed
          </span>
        )}
      </div>

      {loading && (
        <p className="mt-4 text-sm text-gray-400">Loading web behaviour…</p>
      )}

      {error && (
        <p className="mt-4 text-sm text-gray-400">
          {error === "Not configured"
            ? "Web behaviour tracking not configured — add SWF_HUB_URL and BEHAVIOUR_SECRET to env vars."
            : `Could not load web behaviour: ${error}`}
        </p>
      )}

      {data && data.pageViews.length === 0 && !loading && (
        <p className="mt-4 text-sm text-gray-400">
          No attributed page views yet. Page views are recorded when this contact clicks a
          campaign link and visits the SWF website.
        </p>
      )}

      {data && data.pageViews.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Page</th>
                <th className="px-4 py-3 font-medium">Device</th>
                <th className="px-4 py-3 font-medium">Referrer</th>
                <th className="px-4 py-3 font-medium">Visited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.pageViews.map(pv => (
                <tr key={pv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {pv.path}
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">
                    {pv.device ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[180px]" title={pv.referrer ?? ""}>
                    {pv.referrer ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(pv.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.total > data.pageViews.length && (
            <p className="px-4 py-3 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
              Showing latest {data.pageViews.length} of {data.total} total page views.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
