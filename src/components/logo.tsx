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
        alt="Xylo (UK) Ltd"
        width={height}
        height={height}
        className={className}
      />
    );
  }

  // Horizontal: 320×125 native aspect ratio
  const width = Math.round((320 / 125) * height);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-horizontal.svg"
      alt="Xylo (UK) Ltd"
      width={width}
      height={height}
      className={className}
    />
  );
}
