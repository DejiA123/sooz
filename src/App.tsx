
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Discover from "./pages/Discover";
import Activity from "./pages/Activity";
import Chat from "./pages/Chat";
import PostDetails from "./pages/PostDetails";
import SuggestedPeople from "./pages/SuggestedPeople";
import Notifications from "./pages/Notifications";
import About from "./pages/About";
import Help from "./pages/Help";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import EmailConfirmation from "./pages/EmailConfirmation";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";
import { AuthListener } from "./components/AuthListener";
import { NotificationManager } from "./components/NotificationManager";

const queryClient = new QueryClient();

const App = () => {
  // Initialize theme
  if (typeof window !== "undefined") {
    const theme = localStorage.getItem("sooz-mode") || "light";
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Migrate gold theme to blue
    const colorTheme = localStorage.getItem("sooz-theme");
    if (!colorTheme || colorTheme === "gold") {
      localStorage.setItem("sooz-theme", "blue");
      // Apply blue theme immediately
      document.documentElement.style.setProperty("--primary", "240 100% 27%");
    }

    // Register Service Worker and handle updates
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((opts) => {
          console.log('SW registered:', opts);

          // Check for updates
          opts.onupdatefound = () => {
            const installingWorker = opts.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New update available
                    toast("New version available!", {
                      action: {
                        label: "Update",
                        onClick: () => window.location.reload()
                      },
                      duration: Infinity
                    });
                  }
                }
              };
            }
          };
        }).catch(err => console.log('SW fetch fail', err));
      });
    }

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
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthListener />
            <NotificationManager />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/email-confirmation" element={<EmailConfirmation />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/update-password" element={<UpdatePassword />} />

              <Route element={<MainLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/suggested-people" element={<SuggestedPeople />} />
                <Route path="/about" element={<About />} />
                <Route path="/help" element={<Help />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile/:username" element={<Profile />} />
                <Route path="/post/:id" element={<PostDetails />} />
                <Route path="/settings" element={<Settings />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
