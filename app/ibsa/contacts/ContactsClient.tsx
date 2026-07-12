"use client";

import { useState, useTransition } from "react";
import { createSupplier, updateSupplier, deleteSupplier } from "./actions";

export type SupplierRow = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  mobile: string | null;
  notes: string | null;
};

type Draft = {
  name: string;
  contactName: string;
  email: string;
  mobile: string;
  notes: string;
};

const emptyDraft = (): Draft => ({
  name: "", contactName: "", email: "", mobile: "", notes: "",
});

type Props = { suppliers: SupplierRow[] };

export default function ContactsClient({ suppliers }: Props) {
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [draft, setDraft]           = useState<Draft>(emptyDraft());
  const [confirmDelete, setConfirmDelete] = useState<SupplierRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function openEdit(s: SupplierRow) {
    setEditingId(s.id);
    setDraft({
      name:        s.name,
      contactName: s.contactName ?? "",
      email:       s.email ?? "",
      mobile:      s.mobile ?? "",
      notes:       s.notes ?? "",
    });
    setShowAdd(false);
  }

  function openAdd() {
    setDraft(emptyDraft());
    setShowAdd(true);
    setEditingId(null);
  }

  function cancel() {
    setEditingId(null);
    setShowAdd(false);
    setDraft(emptyDraft());
  }

  const set = (field: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((prev) => ({ ...prev, [field]: e.target.value }));

  function submitAdd() {
    const fd = new FormData();
    Object.entries(draft).forEach(([k, v]) => fd.set(k, v));
    startTransition(async () => {
      await createSupplier(fd);
      cancel();
    });
  }

  function submitEdit(oldName: string) {
    const fd = new FormData();
    fd.set("id", editingId!);
    fd.set("oldName", oldName);
    Object.entries(draft).forEach(([k, v]) => fd.set(k, v));
    startTransition(async () => {
      await updateSupplier(fd);
      cancel();
    });
  }

  function submitDelete(s: SupplierRow) {
    const fd = new FormData();
    fd.set("id", s.id);
    startTransition(async () => {
      await deleteSupplier(fd);
      setConfirmDelete(null);
    });
  }

  return (
    <>
      {/* Add button */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={openAdd}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          + Add Supplier
        </button>
      </div>

      {/* Add card (inline at top) */}
      {showAdd && (
        <div className="mb-4 rounded-2xl border border-blue-500/40 bg-blue-950/20 p-5">
          <p className="mb-4 text-sm font-semibold text-blue-300">New supplier</p>
          <SupplierForm
            draft={draft}
            set={set}
            onSave={submitAdd}
            onCancel={cancel}
            isPending={isPending}
            saveLabel="Add supplier"
          />
        </div>
      )}

      {/* Supplier cards */}
      {suppliers.length === 0 && !showAdd ? (
        <p className="text-sm text-slate-500">No suppliers yet — click "Add Supplier" to get started.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) =>
            editingId === s.id ? (
              /* Edit mode */
              <div key={s.id} className="rounded-2xl border border-amber-500/40 bg-amber-950/10 p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-amber-400">Editing</p>
                <SupplierForm
                  draft={draft}
                  set={set}
                  onSave={() => submitEdit(s.name)}
                  onCancel={cancel}
                  isPending={isPending}
                  saveLabel="Save changes"
                  showNameWarning={draft.name !== s.name}
                />
              </div>
            ) : (
              /* Display mode */
              <div
                key={s.id}
                className="group relative rounded-2xl border border-slate-700 bg-slate-800 p-5 transition-colors hover:border-slate-600"
              >
                {/* Supplier name */}
                <p className="text-base font-bold text-white">{s.name}</p>

                {/* Contact details */}
                <div className="mt-3 space-y-2">
                  {s.contactName && (
                    <div className="flex items-center gap-2">
                      <PersonIcon />
                      <span className="text-sm text-slate-300">{s.contactName}</span>
                    </div>
                  )}
                  {s.mobile && (
                    <div className="flex items-center gap-2">
                      <PhoneIcon />
                      <a
                        href={`tel:${s.mobile}`}
                        className="text-sm text-slate-300 hover:text-white"
                      >
                        {s.mobile}
                      </a>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-2">
                      <EmailIcon />
                      <a
                        href={`mailto:${s.email}`}
                        className="text-sm text-blue-400 hover:underline"
                      >
                        {s.email}
                      </a>
                    </div>
                  )}
                  {s.notes && (
                    <p className="mt-2 text-xs text-slate-500 leading-relaxed">{s.notes}</p>
                  )}
                  {!s.contactName && !s.mobile && !s.email && !s.notes && (
                    <p className="text-xs text-slate-600 italic">No contact details yet</p>
                  )}
                </div>

                {/* Edit / delete buttons */}
                <div className="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(s)}
                    className="flex-1 rounded-lg border border-slate-600 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(s)}
                    className="rounded-lg border border-red-900/50 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white">Remove supplier?</h2>
            <p className="mt-2 text-sm text-slate-400">
              <span className="font-medium text-white">{confirmDelete.name}</span> will be removed from your contacts. Their RS product links won't be affected.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isPending}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => submitDelete(confirmDelete)}
                disabled={isPending}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Form shared by Add + Edit ──────────────────────────────────────────────
function SupplierForm({
  draft,
  set,
  onSave,
  onCancel,
  isPending,
  saveLabel,
  showNameWarning = false,
}: {
  draft: Draft;
  set: (field: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  saveLabel: string;
  showNameWarning?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-400">Supplier Name</label>
        <input
          type="text"
          value={draft.name}
          onChange={set("name")}
          placeholder="e.g. Robert Scott"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
        />
        {showNameWarning && (
          <p className="mt-1 text-xs text-amber-400">
            ⚠ Renaming will update all RS product links automatically
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-400">Contact Name</label>
        <input
          type="text"
          value={draft.contactName}
          onChange={set("contactName")}
          placeholder="e.g. Sarah Jones"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400">Mobile</label>
          <input
            type="tel"
            value={draft.mobile}
            onChange={set("mobile")}
            placeholder="07700 900000"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400">Email</label>
          <input
            type="email"
            value={draft.email}
            onChange={set("email")}
            placeholder="name@supplier.com"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-400">
          Notes <span className="font-normal text-slate-600">(optional)</span>
        </label>
        <textarea
          value={draft.notes}
          onChange={set("notes")}
          rows={2}
          placeholder="Account number, delivery days, etc."
          className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
        />
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isPending || !draft.name.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {isPending ? "Saving…" : saveLabel}
        </button>
      </div>
    </div>
  );
}

// ── Tiny icons ─────────────────────────────────────────────────────────────
function PersonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-500">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-500">
      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
    </svg>
  );
}
function EmailIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-500">
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  );
}
