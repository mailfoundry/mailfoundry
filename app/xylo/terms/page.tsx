export const metadata = {
  title: "Terms & Conditions — Xylo Supplies",
  description: "Terms and conditions of trade for Xylo (UK) Ltd.",
};

export default function TermsPage() {
  return (
    <section className="flex-1 px-6 py-20">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-bold tracking-[0.22em] uppercase text-orange-500 mb-5">
          Legal
        </p>
        <h1 className="text-3xl font-black tracking-tight mb-4">Terms &amp; Conditions</h1>
        <p className="text-xs text-slate-600 mb-12">
          Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div className="space-y-8 text-sm text-slate-400 leading-relaxed">
          <div>
            <h2 className="text-white font-bold mb-2">1. Company Information</h2>
            <p>
              These terms apply to trade supplied by Xylo (UK) Ltd (&quot;Xylo
              Supplies&quot;, &quot;we&quot;, &quot;us&quot;), registered in
              England &amp; Wales under company number GB073 23863, VAT
              registration number 442 8892 61. Registered office: R08 Regent
              Works Studio, Regent Works, Lawley Street, Longton, Staffs. ST3
              1LZ, United Kingdom.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">2. Trade Accounts &amp; Orders</h2>
            <p>
              Products are supplied on a wholesale/trade basis. Orders are
              subject to acceptance and stock availability. Prices are quoted
              exclusive of VAT unless stated otherwise, and are confirmed at
              the point of order acceptance.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">3. Payment</h2>
            <p>
              Payment terms are agreed individually with each trade account
              at the time of account set-up. Standard terms apply unless
              otherwise agreed in writing.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">4. Delivery</h2>
            <p>
              Delivery timescales are estimates only and are not guaranteed.
              Risk in goods passes to the customer on delivery. We are not
              liable for delays caused by circumstances outside our
              reasonable control.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">5. Returns &amp; Faulty Goods</h2>
            <p>
              Please notify us within a reasonable period of receipt if goods
              arrive damaged, faulty, or incorrect, so we can arrange a
              replacement, credit or refund as appropriate.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">6. Liability</h2>
            <p>
              Nothing in these terms excludes or limits our liability for
              death or personal injury caused by negligence, or for fraud.
              Subject to that, our liability is limited to the value of the
              order concerned.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">7. Governing Law</h2>
            <p>
              These terms are governed by the laws of England &amp; Wales and
              subject to the exclusive jurisdiction of the courts of England
              &amp; Wales.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">8. Contact</h2>
            <p>
              Questions about these terms can be sent to{" "}
              <a href="mailto:hello@xylouk.co.uk" className="text-orange-400 hover:text-orange-300">
                hello@xylouk.co.uk
              </a>.
            </p>
          </div>
        </div>

        <p className="mt-16 text-xs text-slate-600 border-t border-white/5 pt-6">
          This is a general template and has not been reviewed by a
          solicitor. We recommend having it checked against your specific
          trading arrangements before relying on it.
        </p>
      </div>
    </section>
  );
}
