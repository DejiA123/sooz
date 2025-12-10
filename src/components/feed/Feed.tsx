import PostCard from "./PostCard";
import StoriesBar from "./StoriesBar";

const mockPosts = [
  {
    id: "1",
    user: {
      name: "Praise Worship",
      username: "praiseworship",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      verified: true,
    },
    content: {
      type: "image" as const,
      url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=800&fit=crop",
    },
    caption: "The heavens declare the glory of God; the skies proclaim the work of his hands. ✨🙏 #Faith #Blessed",
    likes: 12500,
    comments: 432,
    shares: 89,
    timeAgo: "2h",
  },
  {
    id: "2",
    user: {
      name: "Gospel Music Daily",
      username: "gospelmusic",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      verified: true,
    },
    content: {
      type: "video" as const,
      url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=800&fit=crop",
    },
    caption: "New worship session just dropped! 🎵 Let the sound of Zion fill your heart. Link in bio 🔥",
    likes: 45200,
    comments: 1893,
    shares: 567,
    timeAgo: "4h",
  },
  {
    id: "3",
    user: {
      name: "Faith Journey",
      username: "faithjourney",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
      verified: false,
    },
    content: {
      type: "image" as const,
      url: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=800&h=800&fit=crop",
    },
    caption: "Morning devotion hits different when you're surrounded by His creation. Psalms 110:3 🌅",
    likes: 8934,
    comments: 267,
    shares: 45,
    timeAgo: "6h",
  },
  {
    id: "4",
    user: {
      name: "Zion Community",
      username: "zioncommunity",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      verified: true,
    },
    content: {
      type: "image" as const,
      url: "https://images.unsplash.com/photo-1507692049790-de58290a4334?w=800&h=800&fit=crop",
    },
    caption: "Sunday service was incredible! The presence of God was so strong 🙌 #ChurchFamily #Worship",
    likes: 23100,
    comments: 892,
    shares: 234,
    timeAgo: "8h",
  },
];

const Feed = () => {
  return (
    <div className="pt-16 pb-24">
      {/* Stories */}
      <StoriesBar />
      
      {/* Divider */}
      <div className="h-px bg-border mx-4 mb-4" />
      
      {/* Posts */}
      <div className="px-4 space-y-6">
        {mockPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
};

export default Feed;
