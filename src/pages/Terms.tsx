import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Terms() {
    const navigate = useNavigate();
    return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 pl-0 hover:bg-transparent hover:text-primary">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
            <div className="prose dark:prose-invert text-sm text-muted-foreground space-y-4">
                <p>Last updated: December 2024</p>
                <h3 className="text-foreground font-semibold text-lg">1. Terms</h3>
                <p>
                    By accessing SOOZ, you agree to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws.
                </p>
                <h3 className="text-foreground font-semibold text-lg">2. Use License</h3>
                <p>
                    Permission is granted to temporarily download one copy of the materials (information or software) on SOOZ's website for personal, non-commercial transitory viewing only.
                </p>
                <h3 className="text-foreground font-semibold text-lg">3. Disclaimer</h3>
                <p>
                    The materials on SOOZ's website are provided on an 'as is' basis. SOOZ makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability.
                </p>
            </div>
        </div>
    );
}
