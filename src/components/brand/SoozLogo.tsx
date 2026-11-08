import { cn } from "@/lib/utils";

/**
 * SOOZ logo painted with the theme's gold gradient (bright gold in dark mode, deeper gold in light
 * mode) through a transparent mask, so it always matches the app instead of sitting in a white box.
 *  - "full":   mountain, cross, SOOZ wordmark and "Sound out of Zion" — for large spaces.
 *  - "lockup": compact mountain mark + SOOZ — for top bars where the full logo would be unreadable.
 */
export const SoozLogo = ({ variant = "full", className }: { variant?: "full" | "lockup"; className?: string }) => {
  if (variant === "lockup") {
    return (
      <span role="img" aria-label="SOOZ" className={cn("inline-flex items-center gap-2", className)}>
        <span className="sooz-mark h-[22px]" aria-hidden />
        <span className="sooz-wordmark font-sans text-[21px] font-bold leading-none tracking-[0.1em]" aria-hidden>SOOZ</span>
      </span>
    );
  }
  return <span role="img" aria-label="SOOZ — Sound Out Of Zion" className={cn("sooz-logo", className)} />;
};
