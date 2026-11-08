// v2.1.4 - Sync Check After Reconnect
import OfflineBanner from "@/components/OfflineBanner";
import { registerServiceWorker } from "@/lib/registerSW";
import { useEffect, Suspense, lazy } from "react";
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
// Lazy load pages for performance
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const Discover = lazy(() => import("./pages/Discover"));
const Activity = lazy(() => import("./pages/Activity"));
const Chat = lazy(() => import("./pages/Chat"));
const PostDetails = lazy(() => import("./pages/PostDetails"));
const SuggestedPeople = lazy(() => import("./pages/SuggestedPeople"));
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
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NotificationManager } from "./components/NotificationManager";
import { CallProvider } from "@/contexts/CallContext";
import { CallOverlay } from "@/components/video/CallOverlay";

import { queryClient } from "@/lib/react-query";


const App = () => {
  // Initialize theme
  if (typeof window !== "undefined") {
    const theme = localStorage.getItem("sooz-mode") || "dark";
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Normalize theme to the sacred gold accent
    const colorTheme = localStorage.getItem("sooz-theme");
    if (!colorTheme || colorTheme === "blue") {
      localStorage.setItem("sooz-theme", "gold");
    }
    document.documentElement.style.setProperty("--primary", "38 92% 50%");

    registerServiceWorker();

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
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
<OfflineBanner />
                <AuthListener />
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
                    <Route path="/suggested-people" element={<Suspense fallback={null}><SuggestedPeople /></Suspense>} />
                    <Route path="/about" element={<Suspense fallback={null}><About /></Suspense>} />
                    <Route path="/help" element={<Suspense fallback={null}><Help /></Suspense>} />
                    <Route path="/privacy" element={<Suspense fallback={null}><Privacy /></Suspense>} />
                    <Route path="/terms" element={<Suspense fallback={null}><Terms /></Suspense>} />
                    <Route path="/algorithms" element={<Suspense fallback={null}><Algorithms /></Suspense>} />
                    <Route path="/analytics" element={<Suspense fallback={null}><AnalyticsDashboard /></Suspense>} />
                    <Route path="/archive" element={<Suspense fallback={null}><VideoArchive /></Suspense>} />
                    <Route path="/tiktok" element={<Suspense fallback={null}><ChristianTikTok /></Suspense>} />
                    <Route element={<ProtectedRoute />}>
                      <Route path="/chat" element={<Suspense fallback={null}><Chat /></Suspense>} />
                    </Route>
                    <Route path="/notifications" element={<Suspense fallback={null}><Notifications /></Suspense>} />
                    <Route path="/profile/:username" element={<Suspense fallback={null}><Profile /></Suspense>} />
                    <Route path="/post/:id" element={<Suspense fallback={null}><PostDetails /></Suspense>} />
                    <Route path="/share/:id" element={<Suspense fallback={null}><PostDetails /></Suspense>} />
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
