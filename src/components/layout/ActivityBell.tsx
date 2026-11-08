import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

/** Bell that opens Activity, with an unread badge. Used in the top bars. */
export const ActivityBell = ({ className, iconClassName }: { className?: string; iconClassName?: string }) => {
  const unread = useUnreadNotifications();
  return (
    <Link
      to="/activity"
      aria-label={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
      className={cn("relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90", className)}
    >
      <Bell className={cn("h-[22px] w-[22px]", iconClassName)} strokeWidth={2} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
};
