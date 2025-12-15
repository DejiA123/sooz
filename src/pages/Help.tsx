import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Help() {
    const navigate = useNavigate();
    return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 pl-0 hover:bg-transparent hover:text-primary">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-3xl font-bold mb-6">Help Center</h1>
            <div className="space-y-6">
                <section>
                    <h2 className="text-xl font-semibold mb-2">Frequently Asked Questions</h2>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                        <li>How do I reset my password?</li>
                        <li>How can I change my profile picture?</li>
                        <li>Who can see my posts?</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold mb-2">Contact Support</h2>
                    <p className="text-muted-foreground">
                        Need more help? Reach out to us at <a href="mailto:support@sooz.app" className="text-primary hover:underline">support@sooz.app</a>.
                    </p>
                </section>
            </div>
        </div>
    );
}
