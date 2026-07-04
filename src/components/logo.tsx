type LogoProps = {
  /** Height of the logo in px */
  height?: number;
  /** "icon" = mark only, "horizontal" = mark + wordmark (default) */
  variant?: "icon" | "horizontal";
  className?: string;
};

export default function Logo({ height = 32, variant = "horizontal", className = "" }: LogoProps) {
  if (variant === "icon") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo-icon.svg"
        alt="MailFoundry"
        width={height}
        height={height}
        className={className}
      />
    );
  }

  // Horizontal: 640×130 native aspect ratio
  const width = Math.round((640 / 130) * height);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-horizontal.svg"
      alt="MailFoundry"
      width={width}
      height={height}
      className={className}
    />
  );
}
