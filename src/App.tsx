
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
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
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import EmailConfirmation from "./pages/EmailConfirmation";

const queryClient = new QueryClient();

const App = () => {
  // Initialize theme
  if (typeof window !== "undefined") {
    const theme = localStorage.getItem("sooz-mode") || "dark";
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/email-confirmation" element={<EmailConfirmation />} />

              <Route element={<MainLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/activity" element={<Activity />} />
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
