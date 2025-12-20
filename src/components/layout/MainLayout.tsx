
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";

export const MainLayout = () => {
    return (
        <div className="min-h-screen bg-background pb-20 pt-14 md:pt-0 md:pb-0">
            <div className="md:hidden">
                <TopBar />
            </div>

            <Sidebar />

            <div className="md:ml-64 min-h-screen">
                <main className="w-full max-w-7xl mx-auto px-0 md:px-8 md:pr-24 lg:pr-32 animate-fade-in md:py-8">
                    <Outlet />
                </main>
            </div>

            <div className="md:hidden">
                <BottomNav />
            </div>
        </div>
    );
};
