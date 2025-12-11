import Header from "@/components/layout/Header";
import ModernBottomNav from "@/components/layout/ModernBottomNav";
import ModernVideoPlayer from "@/components/video/ModernVideoPlayer";
import Feed from "@/components/feed/Feed";
import SampleDataLoader from "@/components/SampleDataLoader";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-modern-fade-in">
            <Feed />
          </div>
          {/* Modern video player for testing the new UI components */}
          <div className="mt-8 mb-20 animate-modern-slide-up animate-delay-200">
            <ModernVideoPlayer 
              videoUrl="https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"
              thumbnail="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=600&fit=crop"
              likes={1234}
              comments={89}
              shares={23}
              isLiked={false}
              onLike={() => console.log('Like clicked')}
              onComment={() => console.log('Comment clicked')}
              onShare={() => console.log('Share clicked')}
              user={{
                name: "Modern User",
                username: "@modernuser",
                avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b5bc?w=150&h=150&fit=crop&crop=face",
                verified: true
              }}
              caption="Testing the new modern video player with side panel functionality"
              music="Original Sound - Modern User"
            />
          </div>
        </div>
      </main>
      <ModernBottomNav />
      <SampleDataLoader />
    </div>
  );
};

export default Index;
