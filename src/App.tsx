// v2.1.4 - Sync Check After Reconnect
import OfflineBanner from "@/components/OfflineBanner";
import { registerServiceWorker } from "@/lib/registerSW";
import { useEffect, useState, Suspense, lazy } from "react";
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { isSlowConnection } from "@/lib/network";
import { applyDarkMode } from "@/lib/theme";
// Lazy load pages for performance
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const Discover = lazy(() => import("./pages/Discover"));
const Activity = lazy(() => import("./pages/Activity"));
const Chat = lazy(() => import("./pages/Chat"));
const PostDetails = lazy(() => import("./pages/PostDetails"));
const Notifications = lazy(() => import("./pages/Notifications"));
const About = lazy(() => import("./pages/About"));
const Help = lazy(() => import("./pages/Help"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const EmailConfirmation = lazy(() => import("./pages/EmailConfirmation"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const Algorithms = lazy(() => import("./pages/Algorithms"));
const AnalyticsDashboard = lazy(() => import("./pages/AnalyticsDashboard"));
const VideoArchive = lazy(() => import("./pages/VideoArchive"));
const ChristianTikTok = lazy(() => import("./pages/ChristianTikTok"));
const Moderation = lazy(() => import("./pages/Moderation"));
const WatchHistory = lazy(() => import("./pages/WatchHistory"));
const AddFriends = lazy(() => import("./pages/AddFriends"));

// Warm up the main tabs in the background so switching between them is instant.
// Skipped on data-saver / 2G so the first video gets all the bandwidth.
if (typeof window !== "undefined") {
  const warm = () => {
    if (isSlowConnection()) return;
    [() => import("./pages/Index"), () => import("./pages/Discover"), () => import("./pages/Chat"), () => import("./pages/Profile"),
     () => import("./pages/Activity"), () => import("./pages/Notifications"), () => import("./pages/PostDetails"),
     () => import("./pages/VideoArchive")].forEach((l, i) => setTimeout(() => l().catch(() => {}), i * 250));
  };
  const ric = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1200));
  window.addEventListener("load", () => setTimeout(() => ric(warm), 2500));
}
import { AuthListener } from "./components/AuthListener";
import { useAccountSync } from "./lib/tasteSync";

/** Keeps the For You taste and family-safe mode on the signed-in account. */
const AccountSync = () => { useAccountSync(); return null; };
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NotificationManager } from "./components/NotificationManager";
import { CallProvider, useCall } from "@/contexts/CallContext";
import { CallOverlay } from "@/components/video/CallOverlay";
import { UpdatePrompt } from "@/components/layout/UpdatePrompt";
import { startUpdateChecks } from "@/lib/appUpdate";

import { queryClient } from "@/lib/react-query";


/** Pop-up messages. During a call, and while Create (the camera) is open, they show at the top
 *  (like a phone's banner), so they never cover the buttons at the bottom (End, Mute, Post…). */
const AppToasts = () => {
  const { callState } = useCall();
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setCreating(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener("sooz:feed-cover", on);
    return () => window.removeEventListener("sooz:feed-cover", on);
  }, []);
  return callState === "IDLE" && !creating
    ? <Sonner />
    : <Sonner position="top-center" mobileOffset={{ top: `calc(env(safe-area-inset-top, 0px) + ${creating ? 64 : 8}px)` }} />; // below Create's close / back row
};

/** /t/{id}?by=handle → open that TikTok first in For You (a full load, so the feed picks it up). */
const SharedTikTokRedirect = () => {
  const { id } = useParams();
  useEffect(() => {
    const by = new URLSearchParams(window.location.search).get("by");
    window.location.replace(`/?tiktok=${encodeURIComponent(id || "")}${by ? `&by=${encodeURIComponent(by)}` : ""}`);
  }, [id]);
  return null;
};
/** /p/{id} → the post. */
const SharedPostRedirect = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => { navigate(`/post/${id}`, { replace: true }); }, [id, navigate]);
  return null;
};

const App = () => {
  // Initialize theme
  if (typeof window !== "undefined") {
    applyDarkMode();

    // Normalize theme to the sacred gold accent
    localStorage.setItem("sooz-theme", "gold"); // the accent colour choice was removed: SOOZ is gold
    document.documentElement.style.setProperty("--primary", "38 92% 50%");

    registerServiceWorker();
    startUpdateChecks();

    // Request Notification Permission logic updated to use hook
    // We need to move this INSIDE a component that is inside AuthProvider
    // But App component is OUTSIDE AuthProvider content?
    // Wait, App component RENTERS AuthProvider.
    // So we can't use useAuth or usePushNotifications directly in App if they depend on context provided BY App.
    // AuthProvider is rendered in App return.
    // So 'usePushNotifications' (which uses useAuth) CANNOT be called in App.

    // Solution: Move the notification check to AuthListener or MainLayout.
    // MainLayout is a good place. It runs when logged in?
    // Or AuthListener which runs always on auth change.
    // Let's use AuthListener.

  }

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <AuthProvider>
          <CallProvider>
            <CallOverlay />
            <UpdatePrompt />
            <TooltipProvider>
              <Toaster />
              <AppToasts />
              <BrowserRouter>
<OfflineBanner />
                <AuthListener />
                <AccountSync />
                <NotificationManager />
                <Routes>
                  <Route path="/auth" element={<Suspense fallback={null}><Auth /></Suspense>} />
                  <Route path="/email-confirmation" element={<Suspense fallback={null}><EmailConfirmation /></Suspense>} />
                  <Route path="/forgot-password" element={<Suspense fallback={null}><ForgotPassword /></Suspense>} />
                  <Route path="/update-password" element={<Suspense fallback={null}><UpdatePassword /></Suspense>} />

                  <Route element={<MainLayout />}>
                    <Route path="/" element={<Suspense fallback={null}><Index /></Suspense>} />
                    <Route path="/discover" element={<Suspense fallback={null}><Discover /></Suspense>} />
                    <Route path="/activity" element={<Suspense fallback={null}><Activity /></Suspense>} />
                    <Route path="/suggested-people" element={<Suspense fallback={null}><AddFriends /></Suspense>} />
                    <Route path="/about" element={<Suspense fallback={null}><About /></Suspense>} />
                    <Route path="/help" element={<Suspense fallback={null}><Help /></Suspense>} />
                    <Route path="/privacy" element={<Suspense fallback={null}><Privacy /></Suspense>} />
                    <Route path="/terms" element={<Suspense fallback={null}><Terms /></Suspense>} />
                    <Route path="/algorithms" element={<Suspense fallback={null}><Algorithms /></Suspense>} />
                    <Route path="/analytics" element={<Suspense fallback={null}><AnalyticsDashboard /></Suspense>} />
                    <Route path="/archive" element={<Suspense fallback={null}><VideoArchive /></Suspense>} />
                    <Route path="/tiktok" element={<Suspense fallback={null}><ChristianTikTok /></Suspense>} />
                    <Route path="/moderation" element={<Suspense fallback={null}><Moderation /></Suspense>} />
                    <Route path="/history" element={<Suspense fallback={null}><WatchHistory /></Suspense>} />
                    <Route path="/friends" element={<Suspense fallback={null}><AddFriends /></Suspense>} />
                    <Route element={<ProtectedRoute />}>
                      <Route path="/chat" element={<Suspense fallback={null}><Chat /></Suspense>} />
                    </Route>
                    <Route path="/notifications" element={<Suspense fallback={null}><Notifications /></Suspense>} />
                    <Route path="/profile/:username" element={<Suspense fallback={null}><Profile /></Suspense>} />
                    <Route path="/post/:id" element={<Suspense fallback={null}><PostDetails /></Suspense>} />
                    <Route path="/share/:id" element={<Suspense fallback={null}><PostDetails /></Suspense>} />
                    {/* Share links (sooz.vercel.app serves link previews for these; elsewhere they just open) */}
                    <Route path="/t/:id" element={<SharedTikTokRedirect />} />
                    <Route path="/p/:id" element={<SharedPostRedirect />} />
                    <Route path="/settings" element={<Suspense fallback={null}><Settings /></Suspense>} />
                  </Route>

                  <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />

                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </CallProvider>
        </AuthProvider>
      </HelmetProvider>
    </QueryClientProvider >
  );
};

export default App;
