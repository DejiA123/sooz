import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { SoozLogo } from "@/components/brand/SoozLogo";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const usernameSchema = z.string().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");
const loginIdentifierSchema = z.string().min(3, "Please enter your email or username");

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; username?: string }>({});

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate("/"); }, [user, navigate]);

  const validateForm = () => {
    const newErrors: typeof errors = {};
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) newErrors.password = passwordResult.error.errors[0].message;
    if (!isLogin) {
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) newErrors.email = emailResult.error.errors[0].message;
      const usernameResult = usernameSchema.safeParse(username);
      if (!usernameResult.success) newErrors.username = usernameResult.error.errors[0].message;
    } else {
      const identifierResult = loginIdentifierSchema.safeParse(email);
      if (!identifierResult.success) newErrors.email = identifierResult.error.errors[0].message;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      if (isLogin) {
        const isEmail = z.string().email().safeParse(email).success;
        if (!isEmail) { toast.error("Please use your email address to sign in"); setIsLoading(false); return; }
        const { error } = await signIn(email, password);
        if (error) { if (error.message.includes("Invalid login credentials")) toast.error("Invalid email or password"); else toast.error(error.message); }
        else navigate("/");
      } else {
        const { error } = await signUp(email, password, username, displayName || username);
        if (error) { if (error.message.includes("already registered")) toast.error("This email is already registered."); else toast.error(error.message); }
        else toast.success("Account created! Check your email to verify.");
      }
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 gradient-mesh-bg" />

      <button
        onClick={() => navigate("/")}
        className="absolute top-[calc(1.5rem+env(safe-area-inset-top,0px))] left-5 z-50 w-11 h-11 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center text-foreground/80 hover:bg-white/20 active:scale-90 transition-all duration-200 shadow-lg"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="relative z-10 w-full max-w-[360px]">
        {/* Glass card */}
        <div className="bg-background/60 backdrop-blur-2xl border border-border/20 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <SoozLogo className="h-20 mb-3" />
            <h2 className="text-xl font-display font-bold">
              {isLogin ? "Welcome back" : "Join SOOZ"}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="username" className="text-[12px] font-medium text-muted-foreground">Username</Label>
                  <input id="username" type="text" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    className="w-full bg-transparent border-b-2 border-border/40 focus:border-primary pb-2 pt-1 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/40" />
                  {errors.username && <p className="text-destructive text-[11px]">{errors.username}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="displayName" className="text-[12px] font-medium text-muted-foreground">Display Name <span className="opacity-50">(optional)</span></Label>
                  <input id="displayName" type="text" placeholder="How others see you" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-border/40 focus:border-primary pb-2 pt-1 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/40" />
                </div>
              </>
            )}

            <div className="space-y-1">
              <Label htmlFor="email" className="text-[12px] font-medium text-muted-foreground">{isLogin ? "Email" : "Email"}</Label>
              <input id="email" type="text" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b-2 border-border/40 focus:border-primary pb-2 pt-1 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/40" />
              {errors.email && <p className="text-destructive text-[11px]">{errors.email}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-[12px] font-medium text-muted-foreground">Password</Label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-border/40 focus:border-primary pb-2 pt-1 pr-10 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/40" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-destructive text-[11px]">{errors.password}</p>}
            </div>

            {isLogin && (
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-[12px] text-primary hover:underline font-medium">Forgot password?</Link>
              </div>
            )}

            <Button type="submit" className="w-full h-12 rounded-full text-[15px] font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity mt-2" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-[13px] mt-6">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button onClick={() => { setIsLogin(!isLogin); setErrors({}); }} className="text-primary font-bold hover:underline">{isLogin ? "Sign Up" : "Sign In"}</button>
          </p>
        </div>

        <p className="text-center text-muted-foreground/50 text-[11px] mt-6">By continuing, you agree to our Terms of Service and Privacy Policy</p>
      </div>
    </div>
  );
};

export default Auth;