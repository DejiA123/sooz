# SOOZ Component Documentation

## UI Components (`@/components/ui/`)

### Form Components
- **Button** - Primary interactive element with multiple variants
- **Input** - Text input fields with validation support
- **Label** - Form labels with proper accessibility
- **Select** - Dropdown selection component
- **Checkbox** - Binary choice input
- **RadioGroup** - Single choice from multiple options
- **Textarea** - Multi-line text input
- **Switch** - Toggle switch component

### Layout Components
- **Card** - Content container with variants
- **Avatar** - User profile image display
- **Badge** - Status indicators and labels
- **Separator** - Visual dividers
- **Skeleton** - Loading placeholders
- **ScrollArea** - Scrollable content areas

### Feedback Components
- **Toast** - Temporary notification messages
- **Sonner** - Enhanced toast notifications
- **Alert** - Important messages and warnings
- **Progress** - Progress indicators

### Navigation Components
- **Tabs** - Tabbed content navigation
- **Breadcrumb** - Navigation hierarchy
- **Pagination** - Content pagination
- **Sheet** - Side panels and drawers
- **Dialog** - Modal dialogs
- **Popover** - Contextual floating content

### Data Display
- **Table** - Data tables with sorting
- **Calendar** - Date picker component
- **Tooltip** - Contextual help text
- **HoverCard** - Rich hover content

## Custom Components (`@/components/`)

### Layout Components
- **Header** - Main navigation header
- **BottomNav** - Mobile bottom navigation
- **PageTransition** - Smooth page transitions
- **Sidebar** - Application sidebar

### Form Components
- **CreatePostModal** - Post creation interface
- **EditProfileModal** - Profile editing form
- **CommentModal** - Comment creation modal

### Content Components
- **Feed** - Main content feed
- **PostCard** - Individual post display
- **StoryModal** - Story viewing interface
- **TikTokVideoPlayer** - Video player component

### Social Components
- **FollowButton** - Follow/unfollow functionality
- **LikeButton** - Like/unlike posts
- **ShareButton** - Content sharing
- **CommentSection** - Post comments

### User Components
- **Profile** - User profile page
- **ProfileSkeleton** - Profile loading state
- **UserAvatar** - Enhanced avatar component
- **UserStats** - User statistics display

### Messaging Components
- **ChatInterface** - Chat conversation view
- **ChatList** - List of conversations
- **MessageBubble** - Individual message display
- **Messaging** - Complete messaging system

### Discovery Components
- **Discover** - Content discovery page
- **TrendingSection** - Trending content
- **SuggestedUsers** - User recommendations
- **SearchResults** - Search functionality

### Error Components
- **ErrorBoundary** - Global error handler
- **ErrorState** - Error display component
- **ErrorTestingPanel** - Error testing utilities

### Premium Components
- **PremiumBadge** - Premium user indicator
- **PremiumFeatures** - Premium feature showcase
- **UpgradePrompt** - Subscription upsell

### Theme Components
- **ThemeToggle** - Dark/light mode switcher
- **ThemeProvider** - Theme context provider

## Usage Examples

### Basic Button Usage
```tsx
import { Button } from "@/components/ui/button";

// Primary button
<Button>Share Post</Button>

// Destructive action
<Button variant="destructive">Delete Post</Button>

// Icon button
<Button variant="icon" size="icon">
  <Heart className="w-4 h-4" />
</Button>
```

### Form Example
```tsx
import { Input, Label, Button } from "@/components/ui";

<form className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="email">Email</Label>
    <Input 
      id="email" 
      type="email" 
      placeholder="Enter your email"
    />
  </div>
  <Button type="submit">Submit</Button>
</form>
```

### Card Example
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

<Card className="rounded-xl">
  <CardHeader>
    <CardTitle className="text-lg font-semibold">Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground">Card content goes here</p>
  </CardContent>
</Card>
```

### Avatar Example
```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

<Avatar>
  <AvatarImage src="/user-avatar.jpg" />
  <AvatarFallback>UN</AvatarFallback>
</Avatar>
```

### Toast Notification
```tsx
import { toast } from "sonner";

// Success toast
toast.success("Post published successfully!");

// Error toast
toast.error("Failed to upload image");

// Custom toast
toast("Custom message", {
  description: "Additional details",
  action: {
    label: "Undo",
    onClick: () => console.log("Undo clicked")
  }
});
```

### Error Handling
```tsx
import { ErrorState } from "@/components/error/ErrorState";

<ErrorState 
  title="Connection Failed"
  message="We couldn't connect to the server. Please check your internet connection."
  onRetry={retryFunction}
  error={error}
/>
```

### Loading States
```tsx
import { Skeleton } from "@/components/ui/skeleton";

// Simple skeleton
<Skeleton className="h-4 w-full" />

// Complex skeleton
<div className="space-y-2">
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-4 w-1/2" />
  <Skeleton className="h-32 w-full rounded-lg" />
</div>
```

## Component Props Reference

### Button Props
```tsx
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'gold' | 'indigo' | 'glass' | 'icon' | 'md3-icon';
  size?: 'default' | 'sm' | 'lg' | 'xl' | 'icon' | 'icon-sm';
  asChild?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}
```

### Input Props
```tsx
interface InputProps {
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
```

### Card Props
```tsx
interface CardProps {
  className?: string;
  children: React.ReactNode;
}
```

### ErrorState Props
```tsx
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  className?: string;
  showHomeButton?: boolean;
  error?: Error | null;
}
```

## Best Practices

### Component Composition
1. **Start with base UI components** from `@/components/ui/`
2. **Build custom components** for specific use cases
3. **Maintain consistency** with design tokens
4. **Test accessibility** with keyboard navigation
5. **Document complex components** with examples

### Styling Guidelines
1. **Use Tailwind classes** for styling
2. **Follow spacing scale** (4px grid system)
3. **Maintain color consistency** with design tokens
4. **Include responsive classes** for all screen sizes
5. **Add transition classes** for interactive elements

### Accessibility Requirements
1. **Include ARIA labels** for interactive elements
2. **Use semantic HTML** elements
3. **Ensure keyboard navigation** works
4. **Test with screen readers**
5. **Maintain color contrast** ratios

### Performance Considerations
1. **Use dynamic imports** for heavy components
2. **Implement skeleton loading** states
3. **Optimize images** with next-gen formats
4. **Minimize re-renders** with proper React patterns
5. **Use React.memo** for expensive components

## Troubleshooting

### Common Issues

**Component not found**
```tsx
// ❌ Wrong import
import Button from "@/components/ui/button";

// ✅ Correct import
import { Button } from "@/components/ui/button";
```

**Missing TypeScript types**
```tsx
// Add proper types to your props
interface MyComponentProps {
  title: string;
  onClick: () => void;
  disabled?: boolean;
}
```

**Styling conflicts**
```tsx
// Use cn() utility for conditional classes
import { cn } from "@/lib/utils";

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  className
)}>
```

## Migration Guide

### From v1 to v2
- Button variants updated (removed `secondary`, added `gold`)
- Card component simplified (removed `CardFooter`)
- New error handling components added
- Theme system updated with CSS variables

### Deprecation Notices
- `OldButton` component deprecated (use `Button` instead)
- `CustomCard` being replaced with standard `Card`
- Manual color values should use CSS variables

---

**Component Library Version**: 1.0.0  
**Last Updated**: December 2025  
**Maintained By**: Development Team