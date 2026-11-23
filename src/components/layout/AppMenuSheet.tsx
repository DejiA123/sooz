import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Download, Bookmark, ChevronRight, FileText, History, Inbox, Info, LifeBuoy, LogIn, Lock, LogOut, Settings, ShieldCheck, Sparkles, ThumbsUp, Eye, TrendingUp, UserCheck, UserPlus, Video, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { openReportCount } from "@/services/api/safety";
import { openFeedbackCount } from "@/services/api/feedback";
import { signupsToday } from "@/services/api/signups";
import { visitorsNow } from "@/services/api/visitors";
import { FeedbackSheet } from "@/components/feedback/FeedbackSheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { appVersionLabel } from "@/lib/appUpdate";
import { forgetPushOnThisPhone } from "@/lib/push";

/** The app's menu (activity, settings, log out; the admin pages for admins only). */
import { openInstallCard, useInstallKind } from "@/components/InstallPrompt";
export const AppMenuSheet = ({ trigger }: { trigger: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const reports = useQuery({ queryKey: ["moderation-count"], queryFn: openReportCount, enabled: isAdmin && open, staleTime: 30_000 });
  const feedback = useQuery({ queryKey: ["feedback-count"], queryFn: openFeedbackCount, enabled: isAdmin && open, staleTime: 30_000 });
  const signups = useQuery({ queryKey: ["signups-today"], queryFn: signupsToday, enabled: isAdmin && open, staleTime: 30_000 });
  const visitors = useQuery({ queryKey: ["visitors-now"], queryFn: visitorsNow, enabled: isAdmin && open, staleTime: 20_000 });
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const kind = useInstallKind();

  type Row = { label: string; icon: LucideIcon; to?: string; run?: () => void; badge?: number; note?: string };
  const groups: { title: string; rows: Row[] }[] = [
    ...(isAdmin ? [{ title: "Admin", rows: [
      { to: "/tiktok", icon: Sparkles, label: "Christian TikTok" },
      { to: "/moderation", icon: ShieldCheck, label: "Moderation", badge: reports.data || 0 },
      { to: "/feedback", icon: Inbox, label: "Feedback", badge: feedback.data || 0 },
      { to: "/signups", icon: UserCheck, label: "Sign-ups", note: signups.data ? `${signups.data} today` : undefined },
      { to: "/visitors", icon: Eye, label: "Visitors", note: visitors.data ? `${visitors.data} now` : undefined },
      { to: "/insights", icon: TrendingUp, label: "Insights" },
      { to: "/analytics", icon: BarChart3, label: "Analytics" },
    ] }] : [{ title: "Insights", rows: [{ to: "/analytics", icon: BarChart3, label: "Analytics" }] }]),
    { title: "Your activity", rows: [
      { to: "/profile/me?tab=saved", icon: Bookmark, label: "Saved" },
      { to: "/history", icon: History, label: "Watch history" },
      { to: "/archive", icon: Video, label: "Video Archive" },
    ] },
    { title: "People", rows: [{ to: "/friends", icon: UserPlus, label: "Add friends" }] },
    { title: "Settings and support", rows: [
      { to: "/settings", icon: Settings, label: "Settings" },
      ...(kind !== "installed" && kind !== "has-app" ? [{ icon: Download, label: "Get the app", run: () => { close(); setTimeout(openInstallCard, 250); } }] : []),
      { icon: ThumbsUp, label: "Send feedback", run: () => { close(); setFeedbackOpen(true); } },
      { to: "/help", icon: LifeBuoy, label: "Help" },
    ] },
    // Who owns the videos, and how a creator asks for removal, live on these pages.
    { title: "About", rows: [
      { to: "/about", icon: Info, label: "About SOOZ" },
      { to: "/terms", icon: FileText, label: "Terms" },
      { to: "/privacy", icon: Lock, label: "Privacy" },
    ] },
  ];

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      {/* A full page that slides in, like the settings page of other social apps: plain rows in grouped
          cards, one quiet icon colour, an arrow on each row. */}
      <SheetContent side="right" className="flex w-full max-w-none flex-col gap-0 border-0 bg-background p-0 sm:max-w-md [&>button.absolute]:hidden">
        <SheetHeader className="relative flex h-[calc(52px+env(safe-area-inset-top,0px))] shrink-0 flex-row items-center justify-center space-y-0 border-b border-foreground/[0.07] px-2 pt-[env(safe-area-inset-top,0px)]">
          <SheetClose aria-label="Back" className="absolute bottom-1.5 left-1.5 flex h-10 w-10 items-center justify-center rounded-full active:bg-foreground/10">
            <ArrowLeft className="h-6 w-6" />
          </SheetClose>
          <SheetTitle className="text-[17px] font-bold leading-none">Menu</SheetTitle>
          <SheetDescription className="sr-only">Access app settings, analytics, and more.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-2">
          {groups.map((g) => (
            <section key={g.title} className="mt-4">
              <h3 className="px-1 pb-2 text-[13px] font-semibold text-muted-foreground">{g.title}</h3>
              <div className="overflow-hidden rounded-2xl bg-foreground/[0.045]">
                {g.rows.map((r, i) => {
                  const inner = (
                    <>
                      <r.icon className="h-[22px] w-[22px] shrink-0 opacity-80" strokeWidth={1.8} />
                      <span className={cn("flex min-h-[52px] min-w-0 flex-1 items-center gap-2 pr-3", i > 0 && "border-t border-foreground/[0.07]")}>
                        <span className="min-w-0 flex-1 truncate text-[15.5px]">{r.label}</span>
                        {r.note ? <span className="shrink-0 text-[13px] text-muted-foreground">{r.note}</span> : null}
                        {r.badge ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-[12px] font-bold text-white">{r.badge}</span> : null}
                        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground/70" />
                      </span>
                    </>
                  );
                  const cls = "flex w-full items-center gap-3.5 pl-4 text-left active:bg-foreground/[0.06]";
                  return r.to
                    ? <Link key={r.label} to={r.to} onClick={close} className={cls}>{inner}</Link>
                    : <button key={r.label} type="button" onClick={r.run} className={cls}>{inner}</button>;
                })}
              </div>
            </section>
          ))}
          {/* Only signed-in people can log out; everyone else gets Sign in. */}
          {user ? (
            <button
              type="button"
              onClick={async () => { close(); await forgetPushOnThisPhone(); await supabase.auth.signOut(); window.location.href = "/auth"; }}
              className="mt-6 flex h-[52px] w-full items-center gap-3.5 rounded-2xl bg-foreground/[0.045] pl-4 text-left text-[15.5px] font-semibold text-red-500 active:bg-foreground/[0.08]"
            >
              <LogOut className="h-[22px] w-[22px]" strokeWidth={1.8} /> Log out
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={close}
              className="mt-6 flex h-[52px] w-full items-center gap-3.5 rounded-2xl bg-foreground/[0.045] pl-4 text-left text-[15.5px] font-semibold text-primary active:bg-foreground/[0.08]"
            >
              <LogIn className="h-[22px] w-[22px]" strokeWidth={1.8} /> Sign in
            </Link>
          )}
          <p className="mt-5 text-center text-[12px] text-muted-foreground/80">SOOZ {appVersionLabel()}</p>
        </div>
      </SheetContent>
    </Sheet>
    <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
};
