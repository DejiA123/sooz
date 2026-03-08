import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { z } from "zod";

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

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

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
        let signInEmail = email;
        const isEmail = z.string().email().safeParse(email).success;
        if (!isEmail) {
          const { data: profile, error: profileError } = await supabase.from('profiles').select('id').eq('username', email.toLowerCase()).maybeSingle();
          if (profileError || !profile) { toast.error("Invalid username or password"); setIsLoading(false); return; }
          toast.error("Please use your email address to sign in"); setIsLoading(false); return;
        }
        const { error } = await signIn(signInEmail, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) toast.error("Invalid email/username or password");
          else toast.error(error.message);
        } else navigate("/");
      } else {
        const { error } = await signUp(email, password, username, displayName || username);
        if (error) {
          if (error.message.includes("already registered")) toast.error("This email is already registered. Please sign in instead.");
          else toast.error(error.message);
        } else toast.success("Account created! Please check your email to verify.");
      }
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-6 left-6 z-50 rounded-full"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="relative z-10 w-full max-w-[380px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img src="/sooz-logo-v3.svg" alt="SOOZ" className="h-16 w-auto mb-1 object-contain" />
          <p className="text-muted-foreground text-sm">Sound Out Of Zion</p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <h2 className="text-2xl font-display font-bold text-center">
            {isLogin ? "Welcome back" : "Join SOOZ"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-[13px] font-medium">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    className="h-14 rounded-full px-5 bg-secondary/50 border-border/30"
                  />
                  {errors.username && <p className="text-destructive text-xs px-2">{errors.username}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-[13px] font-medium">Display Name <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="How others will see you"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="h-14 rounded-full px-5 bg-secondary/50 border-border/30"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium">{isLogin ? "Email or Username" : "Email"}</Label>
              <Input
                id="email"
                type="text"
                placeholder={isLogin ? "email@example.com" : "Enter your email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 rounded-full px-5 bg-secondary/50 border-border/30"
              />
              {errors.email && <p className="text-destructive text-xs px-2">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 rounded-full px-5 pr-14 bg-secondary/50 border-border/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-destructive text-xs px-2">{errors.password}</p>}
            </div>

            {isLogin && (
              <div className="flex justify-end px-2">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-14 rounded-full text-base font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setIsLogin(!isLogin); setErrors({}); }}
              className="text-primary font-bold hover:underline"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-10">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default Auth;
