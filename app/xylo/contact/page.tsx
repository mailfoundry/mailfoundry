export const metadata = {
  title: "Contact — Xylo Supplies",
  description:
    "Get in touch with Xylo (UK) Ltd for trade enquiries, bulk orders and account set-up. Based in Longton, Staffordshire.",
};

export default function ContactPage() {
  return (
    <section className="flex-1 px-6 py-20">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-bold tracking-[0.22em] uppercase text-orange-500 mb-5">
          Contact
        </p>
        <h1 className="text-4xl font-black leading-tight tracking-tight mb-6">
          Talk to us about a trade account
        </h1>
        <p className="text-lg text-slate-400 max-w-lg mx-auto mb-16 leading-relaxed">
          Whether you&apos;re setting up a new trade account, placing a bulk
          order, or just have a question about stock — reach us directly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-16">
          <ContactCard label="Email" value="hello@xylouk.co.uk" href="mailto:hello@xylouk.co.uk" />
          <ContactCard label="Phone" value="07714 747777" href="tel:+447714747777" />
          <ContactCard
            label="Registered Office"
            value={"R08 Regent Works Studio, Lawley Street, Longton, ST3 1LZ"}
          />
        </div>

        <a
          href="mailto:hello@xylouk.co.uk"
          className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm px-8 py-3.5 rounded-xl transition-colors tracking-wide"
        >
          Email Trade Enquiries →
        </a>
      </div>
    </section>
  );
}

function ContactCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <>
      <p className="text-xs font-bold uppercase tracking-wide text-orange-400 mb-2">{label}</p>
      <p className="text-sm text-slate-300 leading-relaxed">{value}</p>
    </>
  );

  const className =
    "rounded-xl border border-white/8 bg-white/3 p-5 text-left block h-full";

  if (href) {
    return (
      <a href={href} className={`${className} hover:border-orange-500/40 hover:bg-white/5 transition-colors`}>
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}
