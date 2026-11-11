import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FamilySafeSetting } from "@/components/safety/FamilySafeSetting";

export default function Settings() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch (error) { console.error(error); }
    finally { Object.keys(localStorage).forEach((key) => { if (key.startsWith("sb-")) localStorage.removeItem(key); }); window.location.href = "/auth"; }
  };

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-height)+6rem)]">
      <div className="px-5 py-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold">Settings</h1>
        </div>

        <div className="space-y-3">
          {/* Safety */}
          <p className="px-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Safety</p>
          <FamilySafeSetting />

          {/* Logout */}
          <div className="pt-4">
            <Button variant="ghost" className="w-full justify-start gap-3 h-14 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-2xl" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
              <span className="font-bold">Log Out</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}