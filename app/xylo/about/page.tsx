export const metadata = {
  title: "About — Xylo Supplies",
  description:
    "Xylo (UK) Ltd is a registered UK wholesale distributor of cleaning products and first aid consumables, based in Staffordshire.",
};

export default function AboutPage() {
  return (
    <section className="flex-1 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-bold tracking-[0.22em] uppercase text-orange-500 mb-5 text-center">
          About Us
        </p>
        <h1 className="text-4xl font-black leading-tight tracking-tight mb-8 text-center">
          A registered UK supplier,<br />built for trade.
        </h1>

        <div className="space-y-6 text-slate-600 leading-relaxed">
          <p>
            Xylo Supplies is the trading name of Xylo (UK) Ltd, a registered
            wholesale distributor of professional cleaning products and first
            aid consumables. We work with trade customers, event organisers
            and convention centres across the UK, supplying the consumables
            they rely on to keep venues running and people safe.
          </p>
          <p>
            We&apos;re based in Longton, Staffordshire, at the heart of the UK&apos;s
            trade and manufacturing corridor — close to the transport links
            that let us move stock quickly to customers nationwide.
          </p>
          <p>
            Our focus is straightforward: reliable stock, fair trade pricing,
            and a direct line to a real person when you need one. No call
            centres, no minimum order surprises — just a supplier that treats
            trade accounts like partnerships.
          </p>
        </div>

        {/* Company details card */}
        <div className="mt-14 rounded-xl border border-slate-200 bg-slate-50 p-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-orange-400 mb-3">
              Registered Office
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              Xylo (UK) Ltd<br />
              R08 Regent Works Studio<br />
              Regent Works, Lawley Street<br />
              Longton, Staffs. ST3 1LZ<br />
              United Kingdom
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-orange-400 mb-3">
              Company Information
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              Company Registration No. GB073 23863<br />
              VAT Registration No. 442 8892 61<br />
              Registered in England &amp; Wales
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
