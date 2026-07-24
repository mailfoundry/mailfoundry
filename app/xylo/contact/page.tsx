import { submitContactForm } from "./actions";

export const metadata = {
  title: "Contact — Xylo (UK) Ltd",
  description:
    "Get in touch with Xylo (UK) Ltd for trade enquiries, bulk orders and account set-up. Based in Longton, Staffordshire.",
};

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function ContactPage({ searchParams }: Props) {
  const params = await searchParams;
  const success = params.success === "1";
  const error   = params.error;

  const errorMessage =
    error === "missing-fields" ? "Please fill in your name, email and message." :
    error === "send-failed"    ? "Something went wrong sending your message. Please email us directly at hello@xylouk.co.uk." :
    null;

  return (
    <section className="flex-1 px-6 py-20">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold tracking-[0.22em] uppercase text-orange-500 mb-5">
            Contact
          </p>
          <h1 className="text-4xl font-black leading-tight tracking-tight mb-4">
            Get in touch
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Trade accounts, bulk orders, stock queries — we&apos;re happy to help.
          </p>
        </div>

        {/* Success state */}
        {success ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Message sent</h2>
            <p className="text-sm text-slate-600">
              Thanks for getting in touch — we&apos;ll come back to you as soon as possible.
            </p>
            <a
              href="/contact"
              className="inline-block mt-6 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
            >
              Send another message →
            </a>
          </div>
        ) : (
          <>
            {/* Error banner */}
            {errorMessage && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {/* Form */}
            <form action={submitContactForm} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    autoComplete="name"
                    placeholder="Your name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Email <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Company / Organisation
                  </label>
                  <input
                    type="text"
                    name="company"
                    autoComplete="organization"
                    placeholder="Optional"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    placeholder="Optional"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Message <span className="text-orange-500">*</span>
                </label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us what you need..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500">
                  Or email us directly at{" "}
                  <a href="mailto:hello@xylouk.co.uk" className="text-orange-600 hover:underline">
                    hello@xylouk.co.uk
                  </a>
                </p>
                <button
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-8 py-3 rounded-xl transition-colors tracking-wide"
                >
                  Send message →
                </button>
              </div>
            </form>
          </>
        )}

        {/* Contact details */}
        <div className="mt-14 pt-10 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-orange-400 mb-1">Email</p>
            <a href="mailto:hello@xylouk.co.uk" className="text-sm text-slate-700 hover:text-orange-600 transition-colors">
              hello@xylouk.co.uk
            </a>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-orange-400 mb-1">Phone</p>
            <a href="tel:+447714747777" className="text-sm text-slate-700 hover:text-orange-600 transition-colors">
              07714 747777
            </a>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-orange-400 mb-1">Address</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              R08 Regent Works Studio<br />
              Lawley Street, Longton<br />
              Staffordshire ST3 1LZ
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
