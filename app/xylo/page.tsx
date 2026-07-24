export const metadata = {
  title: "Xylo (UK) Ltd — UK Wholesale Cleaning & First Aid",
  description:
    "UK-based wholesale supplier of professional cleaning products and first aid consumables for trade customers, event organisers and convention centres.",
};

export default function XyloHomePage() {
  return (
    <>
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="max-w-2xl w-full text-center">

          {/* Eyebrow */}
          <p className="text-xs font-bold tracking-[0.22em] uppercase text-orange-500 mb-5">
            UK Trade Supplier
          </p>

          {/* Headline */}
          <h1 className="text-5xl font-black leading-[1.08] tracking-tight mb-6">
            Wholesale Cleaning<br />
            <span className="text-orange-400">&amp; First Aid</span> Supplies
          </h1>

          {/* Orange rule */}
          <div className="w-12 h-[3px] bg-orange-500 mx-auto mb-8 rounded-full" />

          {/* Description */}
          <p className="text-lg leading-relaxed text-slate-600 max-w-lg mx-auto mb-12">
            Xylo (UK) Ltd is a UK-based wholesale distributor of professional
            cleaning products and first aid consumables, serving trade customers,
            event organisers and convention centres.
          </p>

          {/* Category cards */}
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-12">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              </div>
              <p className="font-bold text-sm text-slate-900 mb-1">Cleaning Supplies</p>
              <p className="text-xs text-slate-600 leading-relaxed">PPE, janitorial &amp; hygiene products</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
              </div>
              <p className="font-bold text-sm text-slate-900 mb-1">First Aid</p>
              <p className="text-xs text-slate-600 leading-relaxed">Kits, consumables &amp; safety equipment</p>
            </div>
          </div>

          {/* CTA */}
          <a
            href="mailto:hello@xylouk.co.uk"
            className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm px-8 py-3.5 rounded-xl transition-colors tracking-wide"
          >
            General Enquiries →
          </a>
          <p className="mt-3 text-xs text-slate-500">hello@xylouk.co.uk &nbsp;·&nbsp; 07714 747777</p>

        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t border-slate-200 px-6 py-12 bg-slate-50">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <TrustItem label="Registered UK Company" detail="No. GB073 23863" />
          <TrustItem label="VAT Registered" detail="442 8892 61" />
          <TrustItem label="Staffordshire Based" detail="ST3 1LZ" />
          <TrustItem label="Trade & Bulk Orders" detail="Direct account manager" />
        </div>
      </section>
    </>
  );
}

function TrustItem({ label, detail }: { label: string; detail: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-900 mb-1">{label}</p>
      <p className="text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}
