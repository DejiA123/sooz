
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

export const MainLayout = () => {
    return (
        <div className="min-h-screen bg-background pb-20 pt-16">
            <TopBar />
            <main className="container max-w-md mx-auto px-0 md:px-4 animate-fade-in">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
};
