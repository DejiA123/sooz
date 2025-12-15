import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Privacy() {
    const navigate = useNavigate();
    return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 pl-0 hover:bg-transparent hover:text-primary">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
            <div className="prose dark:prose-invert text-sm text-muted-foreground space-y-4">
                <p>Last updated: December 2024</p>
                <p>
                    Your privacy is important to us. It is SOOZ's policy to respect your privacy regarding any information we may collect from you across our website and application.
                </p>
                <h3 className="text-foreground font-semibold text-lg">1. Information We Collect</h3>
                <p>
                    We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent.
                </p>
                <h3 className="text-foreground font-semibold text-lg">2. How We Use Information</h3>
                <p>
                    We use the information we collect to operate and maintain our application, send you marketing communications, and respond to your comments and questions.
                </p>
            </div>
        </div>
    );
}
