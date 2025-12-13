
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

const EmailConfirmation = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="w-full max-w-md p-8 text-center space-y-6 border-primary/20 bg-card/50 backdrop-blur-xl shadow-2xl">
                    <div className="mx-auto w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold font-display tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                            Email Verified!
                        </h1>
                        <p className="text-muted-foreground">
                            Your account has been successfully verified. You now have full access to all features.
                        </p>
                    </div>

                    <Button
                        className="w-full h-12 text-lg group"
                        onClick={() => navigate("/")}
                    >
                        Go to Home
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </Card>
            </motion.div>
        </div>
    );
};

export default EmailConfirmation;
