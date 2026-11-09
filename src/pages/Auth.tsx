import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ArrowLeft, KeyRound, Mail } from "lucide-react";
import { z } from "zod";
import { SoozLogo } from "@/components/brand/SoozLogo";
import { cn } from "@/lib/utils";
import { googleAvailable, nameFromEmail, sendEmailCode, signInWithGoogle, usernameFromEmail, usernameTaken, verifyEmailCode } from "@/lib/authProviders";

/** Official multi-colour Google "G". */
const GoogleG = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const inputClass = "w-full bg-transparent border-b-2 border-border/40 focus:border-primary pb-2 pt-1 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/40";

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
  // Sign-in method: password, or a one-time passcode emailed to you.
  const [method, setMethod] = useState<"password" | "code">("password");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [codeUsername, setCodeUsername] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Only offer Google where it works (it's off in Supabase for non-Lovable addresses until switched on).
  const [googleOn, setGoogleOn] = useState(true);
  useEffect(() => { googleAvailable().then(setGoogleOn); }, []);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate("/"); }, [user, navigate]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    // On success the browser goes to Google, so only errors come back here.
    if (error) { toast.error(error); setGoogleLoading(false); }
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const emailResult = emailSchema.safeParse(email.trim());
    if (!emailResult.success) { setErrors({ email: emailResult.error.errors[0].message }); return; }
    setErrors({});
    setIsLoading(true);
    // Joining with a code needs only the email: SOOZ picks a free username and a name from it
    // (both can be changed any time in Edit Profile). A resent code keeps the same username.
    let joinAs: { username: string; displayName: string } | undefined;
    if (!isLogin) {
      const handle = codeSentTo === email.trim() && codeUsername ? codeUsername : await usernameFromEmail(email);
      setCodeUsername(handle);
      joinAs = { username: handle, displayName: nameFromEmail(email) };
    }
    const { error } = await sendEmailCode(email, joinAs);
    setIsLoading(false);
    if (error) { toast.error(error); return; }
    setCodeSentTo(email.trim());
    setCode("");
    setCooldown(60);
    toast.success(isLogin ? "Check your email to sign in" : "Check your email to finish joining");
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSentTo || code.length < 6) return;
    setIsLoading(true);
    const { error, username: joined, isNew } = await verifyEmailCode(codeSentTo, code);
    setIsLoading(false);
    if (error) { toast.error(error); return; }
    if (!isLogin && isNew) toast.success(`Welcome to SOOZ! 🙌 You're @${joined} — change it any time in Edit Profile.`, { duration: 6000 });
    else if (!isLogin) toast.success("Welcome back! You already had a SOOZ account, so we signed you in.");
    navigate("/");
  };

  const switchMode = () => { setIsLogin(!isLogin); setErrors({}); setMethod("password"); setCodeSentTo(null); };

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
        if (await usernameTaken(username)) { setErrors({ username: "That username is taken — try another" }); return; }
        const { error, signedIn } = await signUp(email, password, username, displayName || username);
        if (error) { if (error.message.includes("already registered")) toast.error("This email is already registered — sign in instead."); else toast.error(error.message); }
        else if (signedIn) { toast.success("Welcome to SOOZ! 🙌"); navigate("/"); }
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
          <div className="flex flex-col items-center mb-7">
            <SoozLogo className="h-20 mb-3" />
            <h2 className="text-xl font-display font-bold">
              {isLogin ? "Welcome back" : "Join SOOZ"}
            </h2>
          </div>

          {googleOn && (<>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-black/10 bg-white text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition active:scale-[0.98] disabled:opacity-70"
          >
            {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleG />}
            {isLogin ? "Continue with Google" : "Sign up with Google"}
          </button>

          <div className="my-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
            <span className="h-px flex-1 bg-border/50" /> or <span className="h-px flex-1 bg-border/50" />
          </div>
          </>)}

          <div role="tablist" aria-label={isLogin ? "Sign-in method" : "Sign-up method"} className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-secondary/60 p-1">
            {([
              ["password", "Password", KeyRound],
              ["code", "Email code", Mail],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={method === key}
                onClick={() => { setMethod(key); setErrors({}); setCodeSentTo(null); setCode(""); }}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition",
                  method === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {method === "code" ? (
            codeSentTo ? (
              <form onSubmit={handleVerifyCode} className="space-y-5">
                <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
                  We emailed <span className="font-semibold text-foreground">{codeSentTo}</span>.
                  {isLogin ? " Tap the sign-in button in that email, or type its 6-digit code here." : " Tap the button in that email, or type its 6-digit code here, to finish joining SOOZ."}
                </p>
                <input
                  aria-label="Sign-in code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={10}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="selectable w-full rounded-2xl border border-border/60 bg-secondary/40 py-4 text-center font-display text-[28px] font-bold tracking-[0.45em] outline-none transition-colors placeholder:text-muted-foreground/30 focus:border-primary"
                />
                <Button type="submit" className="w-full h-12 rounded-full text-[15px] font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity" disabled={isLoading || code.length < 6}>
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? "Sign In" : "Create Account"}
                </Button>
                <div className="flex items-center justify-between text-[12px] font-medium">
                  <button type="button" onClick={() => { setCodeSentTo(null); setCode(""); }} className="text-muted-foreground hover:text-foreground">Use a different email</button>
                  <button type="button" disabled={cooldown > 0 || isLoading} onClick={() => handleSendCode()} className="text-primary disabled:text-muted-foreground/60">
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSendCode} className="space-y-5">
                <div className="space-y-1">
                  <Label htmlFor="code-email" className="text-[12px] font-medium text-muted-foreground">Email</Label>
                  <input id="code-email" type="email" inputMode="email" autoComplete="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                  {errors.email && <p className="text-destructive text-[11px]">{errors.email}</p>}
                </div>
                <p className="text-[12px] text-muted-foreground">{isLogin ? "No password needed — we'll email you a one-time code." : "Just your email — no password needed. We'll send a 6-digit code to finish joining, and you can pick your username any time in Edit Profile."}</p>
                <Button type="submit" className="w-full h-12 rounded-full text-[15px] font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send code"}
                </Button>
              </form>
            )
          ) : (
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
          )}

          <p className="text-center text-muted-foreground text-[13px] mt-6">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button onClick={switchMode} className="text-primary font-bold hover:underline">{isLogin ? "Sign Up" : "Sign In"}</button>
          </p>
        </div>

        <p className="text-center text-muted-foreground/50 text-[11px] mt-6">By continuing, you agree to our Terms of Service and Privacy Policy</p>
      </div>
    </div>
  );
};

export default Auth;