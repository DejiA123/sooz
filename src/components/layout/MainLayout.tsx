
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";

export const MainLayout = () => {
    return (
        <div className="min-h-screen bg-background pb-20 pt-16 md:pt-0 md:pb-0">
            <div className="md:hidden">
                <TopBar />
            </div>

            <Sidebar />

            <main className="container max-w-md md:max-w-xl lg:max-w-2xl mx-auto px-0 md:px-4 animate-fade-in md:ml-64 min-h-screen md:py-8">
                <Outlet />
            </main>

            <div className="md:hidden">
                <BottomNav />
            </div>
        </div>
    );
};
