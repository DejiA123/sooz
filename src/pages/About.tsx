import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function About() {
    const navigate = useNavigate();
    return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 pl-0 hover:bg-transparent hover:text-primary">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-3xl font-bold mb-6">About SOOZ</h1>
            <div className="prose dark:prose-invert">
                <p className="text-lg text-muted-foreground mb-4">
                    SOOZ is a next-generation social platform designed to connect people through visual storytelling.
                </p>
                <p>
                    Founded in 2024, we aim to bring back the joy of sharing moments without the clutter.
                    Our focus is on authentic connections, high-quality video sharing, and a community-first approach.
                </p>
            </div>
        </div>
    );
}
