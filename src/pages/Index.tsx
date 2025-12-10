import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import Feed from "@/components/feed/Feed";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-lg mx-auto">
        <Feed />
      </main>
      <BottomNav />
    </div>
  );
};

export default Index;
