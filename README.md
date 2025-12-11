# SOOZ - Sound Out Of Zion

A faith-based social media platform built with React, TypeScript, and modern web technologies.

## 🙏 About SOOZ

SOOZ (Sound Out Of Zion) is a social media platform designed specifically for Christian communities. It provides a safe, respectful environment for sharing faith-based content, connecting with fellow believers, and building meaningful relationships centered around faith.

## ✨ Features

### Core Features
- **User Profiles**: Customizable profiles with faith-focused information
- **Social Feed**: Share posts, photos, and videos with your community
- **Stories**: Temporary content sharing with 24-hour expiration
- **Messaging**: Private conversations with other users
- **Discover**: Find new content and connect with other believers
- **Activity Feed**: Stay updated with community interactions

### Premium Features
- **Enhanced Profiles**: Additional customization options
- **Advanced Search**: Find content and users more effectively
- **Priority Support**: Faster response times
- **Exclusive Content**: Access to premium faith-based resources

### Technical Features
- **Responsive Design**: Works perfectly on all devices
- **Dark/Light Mode**: Automatic theme switching
- **Accessibility**: WCAG 2.1 AA compliant
- **Performance**: Optimized for speed and smooth interactions
- **Error Handling**: Comprehensive error states and recovery

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/sooz.git
   cd sooz
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:8080`

## 📁 Project Structure

```
sooz/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Base UI components (shadcn/ui)
│   │   ├── layout/         # Layout components (Header, BottomNav)
│   │   ├── forms/          # Form-specific components
│   │   ├── feedback/       # Error, loading, success states
│   │   └── [feature]/      # Feature-specific components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   ├── styles/             # CSS files and themes
│   └── types/              # TypeScript type definitions
├── public/                 # Static assets
├── docs/                   # Documentation
└── tests/                  # Test files
```

## 🎨 Design System

SOOZ uses a comprehensive design system built on:

- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Accessible component library
- **Custom Design Tokens**: Colors, typography, spacing
- **WCAG 2.1 AA**: Accessibility compliance

### Design Documentation
- [Design System](DESIGN_SYSTEM.md) - Complete design guidelines
- [Style Guide](STYLE_GUIDE.md) - Component usage examples
- [Component Documentation](COMPONENTS.md) - Component reference

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript checks

### Testing

#### Error Handling Testing
Visit `/test/errors` to access the error testing panel and verify error handling functionality.

#### Browser Testing
Use the [browser testing checklist](browser-testing-checklist.md) to ensure compatibility across all major browsers and devices.

### Code Style

- **ESLint**: Enforces code quality
- **Prettier**: Code formatting
- **TypeScript**: Type safety
- **Conventional Commits**: Commit message format

## 🌟 Key Technologies

### Frontend
- **React 18**: UI library
- **TypeScript**: Type safety
- **Vite**: Build tool and development server
- **Tailwind CSS**: Styling
- **shadcn/ui**: Component library

### Backend Integration
- **Supabase**: Database and authentication
- **Real-time**: Live updates and notifications

### State Management
- **React Query**: Server state management
- **Zustand**: Client state management
- **Context API**: Theme and auth state

### Performance
- **React.lazy**: Code splitting
- **Image optimization**: Next-gen formats
- **Service Worker**: Offline support (planned)

## 🧪 Testing Strategy

### Error Handling
- Comprehensive error boundaries
- User-friendly error messages
- Retry functionality
- Graceful degradation

### Accessibility
- Screen reader compatibility
- Keyboard navigation
- Color contrast compliance
- Semantic HTML

### Performance
- Lighthouse scores > 90
- First Contentful Paint < 1.5s
- Time to Interactive < 3.5s
- Smooth 60fps animations

## 📱 Browser Support

### Desktop
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### Mobile
- Chrome Mobile (Android)
- Safari Mobile (iOS)
- Samsung Internet
- Firefox Mobile

## 🔒 Security

### Authentication
- JWT-based authentication
- Secure password handling
- Session management
- OAuth integration (planned)

### Data Protection
- Input validation
- XSS protection
- CSRF protection
- Rate limiting

## 📈 Performance Metrics

### Current Performance
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.5s
- **Cumulative Layout Shift**: < 0.1

### Optimization Strategies
- Image lazy loading
- Code splitting
- Asset compression
- CDN integration (production)

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Guidelines
- Follow the existing code style
- Write meaningful commit messages
- Include tests for new features
- Update documentation as needed
- Ensure accessibility compliance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **shadcn/ui** for the excellent component library
- **Tailwind CSS** for the utility-first framework
- **React community** for the amazing ecosystem
- **Christian tech community** for inspiration and support

## 📞 Support

### Documentation
- [Design System](DESIGN_SYSTEM.md)
- [Style Guide](STYLE_GUIDE.md)
- [Component Reference](COMPONENTS.md)
- [Browser Testing](browser-testing-checklist.md)

### Getting Help
- Check the documentation first
- Search existing issues
- Create a new issue with details
- Join our community discussions

### Error Testing
Access the error testing panel at `/test/errors` to verify error handling functionality.

## 🗺️ Roadmap

### Q1 2025
- [ ] Video calling feature
- [ ] Live streaming capabilities
- [ ] Advanced search filters
- [ ] Community groups

### Q2 2025
- [ ] Mobile app (React Native)
- [ ] Offline functionality
- [ ] Advanced analytics
- [ ] Content moderation tools

### Q3 2025
- [ ] AI-powered content recommendations
- [ ] Advanced privacy controls
- [ ] Multi-language support
- [ ] API for third-party integrations

---

**Built with ❤️ for the Christian community**

**Version**: 1.0.0  
**Last Updated**: December 2025  
**Maintained By**: SOOZ Development Team