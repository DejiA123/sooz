import { Plus } from "lucide-react";

const stories = [
  { id: "add", name: "Your Story", avatar: "", isAdd: true },
  { id: "1", name: "Grace M.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=140&fit=crop", hasNew: true },
  { id: "2", name: "David K.", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=140&fit=crop", hasNew: true },
  { id: "3", name: "Faith O.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=140&fit=crop", hasNew: true },
  { id: "4", name: "Joshua L.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=140&fit=crop", hasNew: false },
  { id: "5", name: "Sarah N.", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=140&fit=crop", hasNew: true },
];

const StoriesBar = () => {
  return (
    <div className="py-3 px-4 overflow-x-auto hide-scrollbar">
      <div className="flex gap-3">
        {stories.map((story) => (
          <div key={story.id} className="flex flex-col items-center gap-1.5 min-w-fit">
            <div
              className={`relative w-14 h-20 rounded-xl overflow-hidden ${
                story.isAdd
                  ? "border-2 border-dashed border-muted-foreground/30 bg-card"
                  : story.hasNew
                  ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                  : ""
              }`}
            >
              {story.isAdd ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
              ) : (
                <img
                  src={story.avatar}
                  alt={story.name}
                  className="w-full h-full object-cover"
                />
              )}
              {story.hasNew && !story.isAdd && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/60" />
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-center w-14 truncate text-muted-foreground">
              {story.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StoriesBar;
