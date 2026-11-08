import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import { SoozLogo } from "@/components/brand/SoozLogo";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/update-password`,
            });
            if (error) throw error;
            setSubmitted(true);
            toast.success("Password reset link sent!");
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to send reset email");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
                <div className="glass rounded-3xl p-8 max-w-md w-full">
                    <Mail className="w-12 h-12 mx-auto mb-4 text-primary" />
                    <h2 className="text-2xl font-bold mb-2">Check your email</h2>
                    <p className="text-muted-foreground mb-6">
                        We've sent a password reset link to <strong>{email}</strong>.
                    </p>
                    <Button asChild className="w-full" variant="outline">
                        <Link to="/auth">Back to Sign In</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
            <Link to="/auth" className="absolute top-6 left-6 text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                Back
            </Link>

            <div className="flex flex-col items-center mb-8">
                <SoozLogo className="h-20 mb-2" />
            </div>

            <div className="glass rounded-3xl p-8 w-full max-w-md">
                <h2 className="text-2xl font-semibold text-center mb-2">Reset Password</h2>
                <p className="text-muted-foreground text-center mb-6 text-sm">Enter your email to receive reset instructions</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="hello@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-background/50 border-white/10"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Sending..." : "Send Reset Link"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
