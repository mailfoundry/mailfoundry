import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function XyloLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-7 border-b border-slate-200">
        <Link href="/">
          <XyloLogo />
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <a
          href="mailto:hello@xylouk.co.uk"
          className="text-sm text-slate-600 hover:text-slate-900 transition-colors hidden sm:block"
        >
          hello@xylouk.co.uk
        </a>
      </nav>

      {/* Mobile nav */}
      <div className="flex md:hidden items-center justify-center gap-6 px-6 py-4 border-b border-slate-200">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-xs uppercase tracking-wide text-slate-600 hover:text-slate-900 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex-1 flex flex-col">{children}</div>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-6 md:px-10 py-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center sm:text-left">
          <div>
            <p className="font-bold text-sm text-slate-900 mb-2">Xylo (UK) Ltd</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              R08 Regent Works Studio<br />
              Regent Works, Lawley Street<br />
              Longton, Staffs. ST3 1LZ<br />
              United Kingdom
            </p>
          </div>
          <div>
            <p className="font-bold text-sm text-slate-900 mb-2">Company Details</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Company Reg: GB073 23863<br />
              VAT Reg No: 442 8892 61
            </p>
          </div>
          <div>
            <p className="font-bold text-sm text-slate-900 mb-2">Get in Touch</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              <a href="tel:+447714747777" className="hover:text-slate-900 transition-colors">
                07714 747777
              </a>
              <br />
              <a href="mailto:hello@xylouk.co.uk" className="hover:text-slate-900 transition-colors">
                hello@xylouk.co.uk
              </a>
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Xylo (UK) Ltd &nbsp;·&nbsp; Registered in England &amp; Wales &nbsp;·&nbsp; No. GB073 23863
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/privacy" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function XyloLogo() {
  return (
    <svg width="148" height="40" viewBox="0 0 148 40" xmlns="http://www.w3.org/2000/svg" aria-label="Xylo Supplies">
      {/* XYLO */}
      <text
        x="0" y="30"
        fontFamily="Arial Black, Arial, sans-serif"
        fontWeight="900"
        fontSize="30"
        letterSpacing="-0.5"
      >
        <tspan fill="#f97316">X</tspan>
        <tspan fill="#1e293b">YLO</tspan>
      </text>
      {/* SUPPLIES */}
      <text
        x="0" y="39"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="400"
        fontSize="8.5"
        textLength="92"
        lengthAdjust="spacingAndGlyphs"
        fill="#475569"
      >
        SUPPLIES
      </text>
    </svg>
  );
}
