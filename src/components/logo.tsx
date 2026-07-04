type LogoProps = {
  /** Width of the icon mark in px (height scales proportionally) */
  size?: number;
  /** Show the "MailFoundry" wordmark beside the mark */
  wordmark?: boolean;
  className?: string;
};

export default function Logo({ size = 32, wordmark = true, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Icon mark — envelope body with orange flame flap */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Envelope body */}
        <rect x="3" y="14" width="34" height="23" rx="3.5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />

        {/* Closed-envelope V fold (slate) */}
        <path d="M3 14 L20 27 L37 14" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinejoin="round" />

        {/* Open flap — orange flame pointing up */}
        <path
          d="M4 14.5 L20 2 L36 14.5"
          fill="rgba(249,115,22,0.12)"
          stroke="#f97316"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Spark at apex */}
        <circle cx="20" cy="2" r="2.5" fill="#f97316" />
      </svg>

      {wordmark && (
        <span
          style={{ fontSize: size * 0.65, lineHeight: 1 }}
          className="font-bold tracking-tight text-white"
        >
          MailFoundry
        </span>
      )}
    </span>
  );
}
