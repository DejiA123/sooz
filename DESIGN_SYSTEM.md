# SOOZ Design System Documentation

## Overview

SOOZ (Sound Out Of Zion) is a faith-based social media platform built with a modern, accessible, and cohesive design system. This documentation outlines the design principles, components, patterns, and guidelines for maintaining consistency across the application.

## Design Principles

### 1. Faith-Centered Design
- **Purposeful**: Every element serves the mission of connecting faith communities
- **Inclusive**: Welcoming to all denominations and backgrounds
- **Respectful**: Upholds Christian values in visual and interaction design

### 2. Accessibility First
- **WCAG 2.1 AA Compliant**: All colors meet contrast requirements
- **Keyboard Navigable**: Full keyboard accessibility throughout
- **Screen Reader Friendly**: Proper ARIA labels and semantic HTML
- **Responsive**: Works across all devices and screen sizes

### 3. Modern & Clean
- **Minimalist**: Clean interfaces that don't distract from content
- **Consistent**: Unified visual language across all components
- **Intuitive**: Familiar patterns that users expect
- **Performance**: Optimized for speed and smooth interactions

## Color System

### Primary Colors
```css
--primary: 260 60% 55%;        /* Indigo - Main brand color */
--primary-foreground: 0 0% 100%;  /* White text on primary */
```

### Secondary Colors
```css
--secondary: 45 80% 55%;       /* Gold - Accent color */
--secondary-foreground: 210 40% 2%;  /* Dark text on secondary */
```

### Semantic Colors
```css
--destructive: 0 84% 60%;      /* Red - Errors, warnings */
--destructive-foreground: 0 0% 100%;  /* White text */
--muted: 210 20% 96%;          /* Light gray - Disabled states */
--muted-foreground: 210 10% 45%;     /* Medium gray - Secondary text */
```

### Gradients
```css
--gradient-gold: linear-gradient(135deg, hsl(45, 80%, 55%), hsl(35, 90%, 50%));
--gradient-indigo: linear-gradient(135deg, hsl(260, 60%, 55%), hsl(280, 70%, 45%));
--gradient-glass: linear-gradient(180deg, hsl(0, 0%, 100%) 0%, hsl(210, 20%, 98%) 100%);
```

## Typography

### Font Families
- **Display Font**: Used for headings and brand elements
- **Body Font**: System fonts for optimal readability

### Text Sizes
```css
text-xs    /* 12px - Labels, captions */
text-sm    /* 14px - Secondary text */
text-base  /* 16px - Body text */
text-lg    /* 18px - Subheadings */
text-xl    /* 20px - Headings */
text-2xl   /* 24px - Page titles */
```

### Font Weights
```css
font-normal  /* 400 - Body text */
font-medium  /* 500 - Emphasis */
font-semibold /* 600 - Headings */
font-bold    /* 700 - Important text */
```

## Component Library

### Buttons

#### Variants
- **default**: Primary action button
- **destructive**: Dangerous actions (delete, remove)
- **outline**: Secondary actions
- **secondary**: Gold accent button
- **ghost**: Subtle actions
- **link**: Text-only links
- **gold**: Gradient gold button for CTAs
- **indigo**: Gradient indigo button
- **glass**: Glassmorphism effect
- **icon**: Circular icon buttons

#### Sizes
- **default**: 40px height
- **sm**: 36px height
- **lg**: 44px height
- **xl**: 56px height
- **icon**: 40px square
- **icon-sm**: 32px square

#### Usage Examples
```tsx
// Primary action
<Button>Share Post</Button>

// Destructive action
<Button variant="destructive">Delete Account</Button>

// Icon button
<Button variant="icon" size="icon">
  <Heart className="w-4 h-4" />
</Button>

// CTA with gradient
<Button variant="gold" size="lg">
  Join Community
</Button>
```

### Cards

#### Structure
```tsx
<div className="bg-card rounded-xl border border-border p-6 shadow-sm">
  <div className="flex items-center gap-4 mb-4">
    <Avatar />
    <div>
      <h3 className="font-semibold">User Name</h3>
      <p className="text-sm text-muted-foreground">2 hours ago</p>
    </div>
  </div>
  <p className="text-foreground">Post content here...</p>
</div>
```

#### Card Variants
- **Default**: White background with border
- **Glass**: Glassmorphism effect
- **Elevated**: With shadow for emphasis

### Forms

#### Input Fields
```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input 
    id="email" 
    type="email" 
    placeholder="Enter your email"
    className="rounded-lg"
  />
</div>
```

#### Form Validation
- **Success**: Green border and check icon
- **Error**: Red border with error message
- **Warning**: Yellow border with warning message

### Navigation

#### Header Pattern
```tsx
<header className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-xl border-b border-surface-variant/20">
  <div className="container mx-auto px-4 h-16 flex items-center justify-between">
    {/* Logo */}
    <div className="flex items-center gap-3">
      <Logo />
      <BrandName />
    </div>
    
    {/* Navigation */}
    <nav className="hidden md:flex items-center gap-6">
      <NavLinks />
    </nav>
    
    {/* Actions */}
    <div className="flex items-center gap-2">
      <ActionButtons />
    </div>
  </div>
</header>
```

#### Bottom Navigation (Mobile)
```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border">
  <div className="flex justify-around py-2">
    <BottomNavItem icon={Home} label="Home" active />
    <BottomNavItem icon={Search} label="Discover" />
    <BottomNavItem icon={PlusCircle} label="Create" />
    <BottomNavItem icon={Heart} label="Activity" />
    <BottomNavItem icon={User} label="Profile" />
  </div>
</nav>
```

## Layout Patterns

### Container System
```css
/* Responsive containers */
.container {
  max-width: 100%;
  margin: 0 auto;
  padding: 0 1rem;
}

@media (min-width: 640px) {
  .container { max-width: 640px; }
}

@media (min-width: 768px) {
  .container { max-width: 768px; }
}

@media (min-width: 1024px) {
  .container { max-width: 1024px; }
}

@media (min-width: 1280px) {
  .container { max-width: 1280px; }
}
```

### Grid System
```css
/* 12-column grid */
.grid { display: grid; gap: 1rem; }
.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
```

### Spacing Scale
```css
/* Based on 4px grid */
.space-1 { margin: 0.25rem; }  /* 4px */
.space-2 { margin: 0.5rem; }   /* 8px */
.space-3 { margin: 0.75rem; }  /* 12px */
.space-4 { margin: 1rem; }     /* 16px */
.space-6 { margin: 1.5rem; }   /* 24px */
.space-8 { margin: 2rem; }     /* 32px */
```

## Interactive States

### Hover States
```css
/* Buttons */
.hover\:bg-primary\/90:hover { background-color: hsl(var(--primary) / 0.9); }
.hover\:shadow-lg:hover { box-shadow: var(--shadow-lg); }
.hover\:scale-105:hover { transform: scale(1.05); }

/* Cards */
.hover\:bg-muted:hover { background-color: hsl(var(--muted)); }
```

### Focus States
```css
/* Focus rings */
.focus\:outline-none:focus { outline: none; }
.focus\:ring-2:focus { box-shadow: 0 0 0 2px var(--ring); }
.focus\:ring-offset-2:focus { box-shadow: 0 0 0 2px var(--ring), 0 0 0 4px var(--background); }
```

### Active States
```css
/* Active button */
.active\:scale-95:active { transform: scale(0.95); }

/* Active navigation */
.active\:bg-primary\/10:active { background-color: hsl(var(--primary) / 0.1); }
```

## Animation & Transitions

### Duration
```css
duration-200 { transition-duration: 200ms; }
duration-300 { transition-duration: 300ms; }
duration-500 { transition-duration: 500ms; }
```

### Easing
```css
ease-in-out { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
```

### Transform Transitions
```css
transform { transition-property: transform; }
hover\:scale-105:hover { transform: scale(1.05); }
hover\:rotate-3:hover { transform: rotate(3deg); }
```

## Icon System

### Icon Sizes
```css
w-3 h-3   /* 12px - Small icons */
w-4 h-4   /* 16px - Default icons */
w-5 h-5   /* 20px - Medium icons */
w-6 h-6   /* 24px - Large icons */
w-8 h-8   /* 32px - Extra large icons */
```

### Icon Usage
```tsx
// Default icon
<Heart className="w-4 h-4" />

// Button icon
<Button size="icon">
  <Heart className="w-4 h-4" />
</Button>

// With text
<div className="flex items-center gap-2">
  <MapPin className="w-4 h-4 text-muted-foreground" />
  <span className="text-sm">Location</span>
</div>
```

## Error States

### Error Component Structure
```tsx
<ErrorState 
  title="Connection Failed"
  message="We couldn't connect to the server. Please check your internet connection."
  onRetry={retryFunction}
  error={errorObject}
/>
```

### Error Message Guidelines
- **Be specific**: "Profile not found" vs "Something went wrong"
- **Be helpful**: Include actionable next steps
- **Be respectful**: Avoid blame or technical jargon
- **Be consistent**: Use similar language across all errors

## Loading States

### Skeleton Loading
```tsx
<Skeleton className="h-4 w-full" />
<Skeleton className="h-32 w-full rounded-lg" />
```

### Spinner Loading
```tsx
<Loader2 className="w-6 h-6 animate-spin text-primary" />
```

## Responsive Design

### Breakpoints
```css
/* Mobile First Approach */
sm: 640px  /* Small tablets */
md: 768px  /* Tablets */
lg: 1024px /* Small laptops */
xl: 1280px /* Desktop */
```

### Responsive Patterns
```tsx
// Hide on mobile, show on desktop
<div className="hidden md:block">Desktop content</div>

// Stack on mobile, side-by-side on desktop
<div className="flex flex-col md:flex-row gap-4">
  <div className="md:w-1/2">Left column</div>
  <div className="md:w-1/2">Right column</div>
</div>
```

## Accessibility Guidelines

### Color Contrast
- **Normal text**: 4.5:1 contrast ratio minimum
- **Large text**: 3:1 contrast ratio minimum
- **Interactive elements**: 3:1 contrast ratio minimum

### Semantic HTML
```tsx
// Use semantic elements
<nav aria-label="Main navigation">...</nav>
<main role="main">...</main>
<aside aria-label="Sidebar">...</aside>
<footer role="contentinfo">...</footer>
```

### ARIA Labels
```tsx
// Label interactive elements
<button aria-label="Like this post">
  <Heart className="w-4 h-4" />
</button>

// Describe complex components
<div role="status" aria-live="polite" aria-label="Loading posts">
  <Spinner />
</div>
```

## Implementation Examples

### Complete Component Example
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PostCard = ({ post }) => {
  return (
    <Card className="mb-4 hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar>
          <AvatarImage src={post.author.avatar} />
          <AvatarFallback>{post.author.name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle className="text-base">{post.author.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{post.timestamp}</p>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-foreground mb-4">{post.content}</p>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm">
            <Heart className="w-4 h-4 mr-2" />
            {post.likes}
          </Button>
          <Button variant="ghost" size="sm">
            <MessageCircle className="w-4 h-4 mr-2" />
            {post.comments}
          </Button>
          <Button variant="ghost" size="sm">
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

## Maintenance Guidelines

### Adding New Components
1. Follow existing naming conventions
2. Use design tokens for colors and spacing
3. Include proper TypeScript types
4. Add accessibility attributes
5. Test across all screen sizes
6. Document usage examples

### Updating Components
1. Maintain backward compatibility
2. Update documentation
3. Test with screen readers
4. Verify color contrast ratios
5. Check responsive behavior

### Code Organization
```
src/
├── components/
│   ├── ui/           # Base UI components
│   ├── layout/       # Layout components
│   ├── forms/        # Form components
│   └── feedback/     # Error, loading, success
├── styles/
│   ├── theme.css     # Design tokens
│   ├── animations.css # Keyframe animations
│   └── premium-components.css # Premium features
└── lib/
    └── utils.ts      # Utility functions
```

## Resources

### Tools for Testing
- **Color Contrast**: WebAIM Contrast Checker
- **Screen Readers**: NVDA (Windows), VoiceOver (macOS)
- **Responsive Design**: Browser DevTools
- **Performance**: Lighthouse

### Inspiration Sources
- Material Design 3
- Apple Human Interface Guidelines
- WCAG 2.1 Guidelines
- Modern CSS techniques

---

**Last Updated**: December 2025  
**Version**: 1.0.0  
**Maintained By**: Development Team