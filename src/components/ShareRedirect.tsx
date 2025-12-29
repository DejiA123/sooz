
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export const ShareRedirect = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (id) {
            navigate(`/post/${id}`, { replace: true });
        }
    }, [id, navigate]);

    return (
        <div className="flex justify-center items-center h-screen bg-background text-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
};
