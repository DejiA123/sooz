import type { ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";

/** Solid forward arrow used for Share. */
export const ShareArrow = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M13.2 4.3a.8.8 0 0 1 1.32-.6l7.1 6.25a.8.8 0 0 1 0 1.2l-7.1 6.25a.8.8 0 0 1-1.32-.6v-3.1c-4.6.05-7.7 1.45-10.07 4.68a.45.45 0 0 1-.8-.36C3.15 12.5 6.6 8.5 13.2 7.6z" />
  </svg>
);

/** One button in the right-hand action column. */
export const RailButton = ({
  icon,
  label,
  onClick,
  ariaLabel,
  pressed,
  className,
}: {
  icon: ReactNode;
  label?: ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  pressed?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    aria-pressed={pressed}
    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    className={cn("group flex flex-col items-center gap-1 text-white outline-none", className)}
  >
    <span className="reel-rail-icon flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-150 group-active:scale-90 group-focus-visible:ring-2 group-focus-visible:ring-primary">
      {icon}
    </span>
    {label !== undefined && <span className="reel-rail-label text-[12.5px] font-semibold leading-none tabular-nums">{label}</span>}
  </button>
);

export const railIconClass = "h-[33px] w-[33px] drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]";
