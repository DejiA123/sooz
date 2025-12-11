# SOOZ Style Guide

## Component Gallery

### 🎨 Color Palette

#### Primary Colors
<div style="display: flex; gap: 10px; margin-bottom: 20px;">
  <div style="width: 100px; height: 100px; background: #7C3AED; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">Indigo<br>#7C3AED</div>
  <div style="width: 100px; height: 100px; background: #F59E0B; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">Gold<br>#F59E0B</div>
</div>

#### Semantic Colors
<div style="display: flex; gap: 10px; margin-bottom: 20px;">
  <div style="width: 100px; height: 100px; background: #EF4444; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">Error<br>#EF4444</div>
  <div style="width: 100px; height: 100px; background: #10B981; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">Success<br>#10B981</div>
  <div style="width: 100px; height: 100px; background: #6B7280; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">Muted<br>#6B7280</div>
</div>

### 🔤 Typography

#### Heading Styles
```html
<!-- Page Title -->
<h1 class="text-2xl font-bold text-foreground">Page Title</h1>

<!-- Section Heading -->
<h2 class="text-lg font-semibold text-foreground">Section Heading</h2>

<!-- Subsection -->
<h3 class="text-base font-semibold text-foreground">Subsection</h3>
```

#### Body Text
```html
<!-- Primary text -->
<p class="text-base text-foreground">Main content text</p>

<!-- Secondary text -->
<p class="text-sm text-muted-foreground">Supporting information</p>

<!-- Caption -->
<p class="text-xs text-muted-foreground">Timestamps, metadata</p>
```

### 🎯 Interactive Elements

#### Primary Button
```tsx
<Button variant="default" size="default">
  Primary Action
</Button>
```

#### Secondary Button
```tsx
<Button variant="outline" size="default">
  Secondary Action
</Button>
```

#### Icon Button
```tsx
<Button variant="icon" size="icon">
  <Heart className="w-4 h-4" />
</Button>
```

#### Gradient CTA Button
```tsx
<Button variant="gold" size="lg">
  <span className="flex items-center gap-2">
    <Star className="w-5 h-5" />
    Join Premium
  </span>
</Button>
```

### 🗂️ Cards & Containers

#### Standard Card
```tsx
<Card className="p-6 rounded-xl">
  <CardHeader>
    <CardTitle className="text-lg font-semibold">Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground">Card content goes here</p>
  </CardContent>
</Card>
```

#### Glass Card
```tsx
<Card className="glass rounded-xl border border-border/50">
  <CardContent className="p-6">
    <div className="space-y-4">
      <h3 className="font-semibold">Glass Card</h3>
      <p className="text-sm text-muted-foreground">
        Subtle glassmorphism effect
      </p>
    </div>
  </CardContent>
</Card>
```

#### Elevated Card
```tsx
<Card className="bg-card rounded-xl shadow-lg hover:shadow-xl transition-shadow">
  <CardContent className="p-6">
    <div className="space-y-4">
      <h3 className="font-semibold">Elevated Card</h3>
      <p className="text-sm text-muted-foreground">
        With shadow for emphasis
      </p>
    </div>
  </CardContent>
</Card>
```

### 📱 Form Elements

#### Input Field
```tsx
<div className="space-y-2">
  <Label htmlFor="email" className="text-sm font-medium">
    Email Address
  </Label>
  <Input 
    id="email" 
    type="email" 
    placeholder="Enter your email"
    className="rounded-lg"
  />
  <p className="text-xs text-muted-foreground">
    We'll never share your email
  </p>
</div>
```

#### Select Dropdown
```tsx
<div className="space-y-2">
  <Label htmlFor="category">Category</Label>
  <Select>
    <SelectTrigger className="rounded-lg">
      <SelectValue placeholder="Choose a category" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="worship">Worship</SelectItem>
      <SelectItem value="prayer">Prayer</SelectItem>
      <SelectItem value="community">Community</SelectItem>
    </SelectContent>
  </Select>
</div>
```

#### Checkbox
```tsx
<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms" className="text-sm">
    I agree to the terms and conditions
  </Label>
</div>
```

### 🔔 Feedback & Status

#### Success Message
```tsx
<div className="bg-green-50 border border-green-200 rounded-lg p-4">
  <div className="flex items-center gap-3">
    <CheckCircle className="w-5 h-5 text-green-600" />
    <div>
      <h4 className="font-medium text-green-900">Success!</h4>
      <p className="text-sm text-green-800">Your post has been published.</p>
    </div>
  </div>
</div>
```

#### Error Message
```tsx
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <div className="flex items-center gap-3">
    <AlertCircle className="w-5 h-5 text-red-600" />
    <div>
      <h4 className="font-medium text-red-900">Error</h4>
      <p className="text-sm text-red-800">Unable to save your changes.</p>
    </div>
  </div>
</div>
```

#### Loading State
```tsx
<div className="flex items-center justify-center p-8">
  <Loader2 className="w-6 h-6 animate-spin text-primary" />
  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
</div>
```

### 🏗️ Layout Patterns

#### Header Layout
```tsx
<header className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-xl border-b border-border">
  <div className="container mx-auto px-4 h-16 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Logo />
      <BrandName />
    </div>
    <nav className="hidden md:flex items-center gap-6">
      <NavLinks />
    </nav>
    <div className="flex items-center gap-2">
      <ActionButtons />
    </div>
  </div>
</header>
```

#### Content Container
```tsx
<main className="max-w-lg mx-auto p-4 pt-20 pb-24">
  <div className="space-y-6">
    {/* Content goes here */}
  </div>
</main>
```

#### Grid Layout
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => (
    <Card key={item.id} className="rounded-xl">
      <CardContent className="p-6">
        {/* Grid item content */}
      </CardContent>
    </Card>
  ))}
</div>
```

### 📱 Mobile Patterns

#### Bottom Navigation
```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border">
  <div className="flex justify-around py-2">
    <Button variant="ghost" size="icon" className="flex-col h-12">
      <Home className="w-5 h-5" />
      <span className="text-xs mt-1">Home</span>
    </Button>
    {/* More nav items */}
  </div>
</nav>
```

#### Mobile Card
```tsx
<Card className="mx-4 mb-4 rounded-xl">
  <CardContent className="p-4">
    <div className="flex gap-3">
      <Avatar className="w-10 h-10">
        <AvatarImage src={avatar} />
      </Avatar>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Name</span>
          <span className="text-xs text-muted-foreground">2h</span>
        </div>
        <p className="text-sm">Mobile-optimized content</p>
      </div>
    </div>
  </CardContent>
</Card>
```

### 🎯 Interactive States

#### Hover Effects
```css
/* Subtle scale on hover */
.hover\:scale-105:hover { transform: scale(1.05); }

/* Shadow elevation */
.hover\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }

/* Background change */
.hover\:bg-muted:hover { background-color: hsl(var(--muted)); }
```

#### Focus States
```css
/* Focus ring */
.focus\:ring-2:focus { box-shadow: 0 0 0 2px var(--ring); }
.focus\:ring-offset-2:focus { box-shadow: 0 0 0 2px var(--ring), 0 0 0 4px var(--background); }
```

#### Active States
```css
/* Scale down on click */
.active\:scale-95:active { transform: scale(0.95); }

/* Background highlight */
.active\:bg-primary\/10:active { background-color: hsl(var(--primary) / 0.1); }
```

### ♿ Accessibility Patterns

#### Screen Reader Text
```tsx
<button className="relative">
  <Heart className="w-5 h-5" />
  <span className="sr-only">Like this post</span>
  {likeCount > 0 && (
    <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
      {likeCount}
    </span>
  )}
</button>
```

#### Keyboard Navigation
```tsx
<div role="tablist" className="flex gap-1">
  <button
    role="tab"
    aria-selected={activeTab === 'posts'}
    aria-controls="posts-panel"
    className="px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary"
  >
    Posts
  </button>
  {/* More tabs */}
</div>
```

#### ARIA Labels
```tsx
<nav aria-label="Main navigation" className="flex gap-6">
  <a href="/" aria-label="Go to homepage" className="hover:text-primary">
    Home
  </a>
  {/* More nav items */}
</nav>
```

### 📊 Data Visualization

#### Progress Bar
```tsx
<div className="w-full bg-muted rounded-full h-2">
  <div 
    className="bg-primary h-2 rounded-full transition-all duration-300" 
    style={{ width: `${progress}%` }}
    role="progressbar"
    aria-valuenow={progress}
    aria-valuemin={0}
    aria-valuemax={100}
  />
</div>
```

#### Stat Card
```tsx
<Card className="rounded-xl">
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">Total Posts</p>
        <p className="text-2xl font-bold">1,234</p>
      </div>
      <div className="p-3 bg-primary/10 rounded-full">
        <FileText className="w-6 h-6 text-primary" />
      </div>
    </div>
  </CardContent>
</Card>
```

## Usage Guidelines

### ✅ Do's
- Use consistent spacing (4px grid system)
- Maintain proper color contrast ratios
- Include hover and focus states
- Use semantic HTML elements
- Provide ARIA labels for icons
- Test on multiple screen sizes
- Include loading states

### ❌ Don'ts
- Don't use colors outside the defined palette
- Don't create custom button styles
- Don't skip accessibility attributes
- Don't use fixed pixel values for spacing
- Don't ignore responsive design
- Don't forget error states
- Don't use unclear icon-only buttons

## Component Status

### ✅ Stable Components
- Button (all variants)
- Card (standard, glass, elevated)
- Input fields
- Typography system
- Color tokens
- Layout containers

### 🚧 In Development
- Advanced form components
- Data visualization components
- Animation system
- Premium feature components

### 📋 Planned Components
- Date picker
- File upload
- Rich text editor
- Advanced charts
- Video player controls

---

**Style Guide Version**: 1.0.0  
**Last Updated**: December 2025  
**Next Review**: March 2026