export const metadata = {
  title: "Privacy Policy — Xylo Supplies",
  description: "How Xylo (UK) Ltd collects and uses personal data.",
};

export default function PrivacyPage() {
  return (
    <section className="flex-1 px-6 py-20">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-bold tracking-[0.22em] uppercase text-orange-500 mb-5">
          Legal
        </p>
        <h1 className="text-3xl font-black tracking-tight mb-4">Privacy Policy</h1>
        <p className="text-xs text-slate-600 mb-12">
          Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div className="space-y-8 text-sm text-slate-400 leading-relaxed">
          <div>
            <h2 className="text-white font-bold mb-2">1. Who We Are</h2>
            <p>
              Xylo (UK) Ltd (&quot;Xylo Supplies&quot;), company number
              GB073 23863, registered office R08 Regent Works Studio, Regent
              Works, Lawley Street, Longton, Staffs. ST3 1LZ, is the data
              controller for personal data collected through this site.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">2. What We Collect</h2>
            <p>
              When you make a trade enquiry or set up an account, we collect
              information you provide directly — such as your name, company
              name, email address, phone number and delivery address — in
              order to respond to enquiries and process orders.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">3. How We Use It</h2>
            <p>
              We use your information to respond to enquiries, set up and
              manage trade accounts, process and fulfil orders, and meet our
              legal and accounting obligations. We do not sell your personal
              data to third parties.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">4. Retention</h2>
            <p>
              We keep personal data for as long as needed to provide our
              services and to meet legal, accounting or reporting
              requirements.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">5. Your Rights</h2>
            <p>
              Under UK data protection law you have the right to request
              access to, correction of, or deletion of your personal data.
              To exercise these rights, contact us using the details below.
            </p>
          </div>

          <div>
            <h2 className="text-white font-bold mb-2">6. Contact</h2>
            <p>
              For any privacy-related questions, contact{" "}
              <a href="mailto:hello@xylouk.co.uk" className="text-orange-400 hover:text-orange-300">
                hello@xylouk.co.uk
              </a>.
            </p>
          </div>
        </div>

        <p className="mt-16 text-xs text-slate-600 border-t border-white/5 pt-6">
          This is a general template and has not been reviewed by a
          solicitor. We recommend having it checked against your specific
          data handling practices before relying on it.
        </p>
      </div>
    </section>
  );
}
