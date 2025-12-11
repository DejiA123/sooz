// Premium Social Media Design System
// Combines best practices from Instagram, TikTok, Facebook, Threads, and WhatsApp

export const designSystem = {
  // Color Palette - Material Design 3 compliant
  colors: {
    // Primary Colors - Instagram/TikTok inspired
    primary: {
      50: '#FFF3E0',
      100: '#FFE0B2',
      200: '#FFCC80',
      300: '#FFB74D',
      400: '#FFA726',
      500: '#FF9800', // Main primary
      600: '#FB8C00',
      700: '#F57C00',
      800: '#EF6C00',
      900: '#E65100',
    },
    
    // Secondary Colors - Facebook/Threads inspired
    secondary: {
      50: '#E8F5E8',
      100: '#C8E6C9',
      200: '#A5D6A7',
      300: '#81C784',
      400: '#66BB6A',
      500: '#4CAF50', // Main secondary
      600: '#43A047',
      700: '#388E3C',
      800: '#2E7D32',
      900: '#1B5E20',
    },
    
    // Accent Colors - WhatsApp inspired
    accent: {
      50: '#E0F2F1',
      100: '#B2DFDB',
      200: '#80CBC4',
      300: '#4DB6AC',
      400: '#26A69A',
      500: '#009688', // Main accent
      600: '#00897B',
      700: '#00796B',
      800: '#00695C',
      900: '#004D40',
    },
    
    // Neutral Colors - Premium grays
    neutral: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
    
    // Semantic Colors
    success: {
      light: '#4CAF50',
      main: '#2E7D32',
      dark: '#1B5E20',
    },
    warning: {
      light: '#FFA726',
      main: '#F57C00',
      dark: '#E65100',
    },
    error: {
      light: '#EF5350',
      main: '#D32F2F',
      dark: '#B71C1C',
    },
    info: {
      light: '#29B6F6',
      main: '#0288D1',
      dark: '#01579B',
    },
  },
  
  // Typography System
  typography: {
    // Font Families
    fontFamily: {
      primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace',
    },
    
    // Font Sizes - Material Design 3 scale
    fontSize: {
      xs: '0.75rem',   // 12px
      sm: '0.875rem',  // 14px
      base: '1rem',    // 16px
      lg: '1.125rem',  // 18px
      xl: '1.25rem',   // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
      '5xl': '3rem',     // 48px
      '6xl': '3.75rem',  // 60px
    },
    
    // Font Weights
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    
    // Line Heights
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
    
    // Letter Spacing
    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
    },
  },
  
  // Spacing System - 8px grid
  spacing: {
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
    16: '4rem',    // 64px
    20: '5rem',    // 80px
    24: '6rem',    // 96px
    32: '8rem',    // 128px
  },
  
  // Border Radius System
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    base: '0.5rem',  // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    '2xl': '2rem',   // 32px
    '3xl': '3rem',   // 48px
    full: '9999px',
  },
  
  // Shadow System - Material Design 3 elevation
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    none: 'none',
    
    // Premium glow effects
    glow: '0 0 20px rgba(255, 152, 0, 0.3)',
    'glow-lg': '0 0 40px rgba(255, 152, 0, 0.4)',
    'glow-xl': '0 0 60px rgba(255, 152, 0, 0.5)',
  },
  
  // Animation System
  animations: {
    // Duration
    duration: {
      instant: '0.1s',
      fast: '0.2s',
      normal: '0.3s',
      slow: '0.5s',
      slower: '0.8s',
    },
    
    // Easing Functions
    easing: {
      standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
      accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',
      smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    },
    
    // Keyframe Animations
    keyframes: {
      fadeIn: {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
      slideUp: {
        '0%': { transform: 'translateY(100%)', opacity: '0' },
        '100%': { transform: 'translateY(0)', opacity: '1' },
      },
      slideDown: {
        '0%': { transform: 'translateY(-100%)', opacity: '0' },
        '100%': { transform: 'translateY(0)', opacity: '1' },
      },
      scaleIn: {
        '0%': { transform: 'scale(0.9)', opacity: '0' },
        '100%': { transform: 'scale(1)', opacity: '1' },
      },
      pulse: {
        '0%, 100%': { opacity: '1' },
        '50%': { opacity: '0.5' },
      },
      bounce: {
        '0%, 20%, 53%, 80%, 100%': { transform: 'translateY(0)' },
        '40%, 43%': { transform: 'translateY(-8px)' },
        '70%': { transform: 'translateY(-4px)' },
        '90%': { transform: 'translateY(-2px)' },
      },
      heartBeat: {
        '0%, 100%': { transform: 'scale(1)' },
        '50%': { transform: 'scale(1.1)' },
      },
      shimmer: {
        '0%': { backgroundPosition: '-200% 0' },
        '100%': { backgroundPosition: '200% 0' },
      },
    },
  },
  
  // Component-specific Design Tokens
  components: {
    // Button Styles
    button: {
      primary: {
        background: 'linear-gradient(135deg, var(--primary-500), var(--primary-600))',
        color: 'white',
        shadow: 'var(--shadow-md)',
        hoverShadow: 'var(--shadow-lg)',
        activeShadow: 'var(--shadow-sm)',
      },
      secondary: {
        background: 'var(--neutral-100)',
        color: 'var(--neutral-800)',
        shadow: 'var(--shadow-sm)',
        hoverShadow: 'var(--shadow-md)',
        activeShadow: 'var(--shadow-inner)',
      },
      ghost: {
        background: 'transparent',
        color: 'var(--neutral-700)',
        hoverBackground: 'var(--neutral-100)',
        activeBackground: 'var(--neutral-200)',
      },
    },
    
    // Card Styles
    card: {
      background: 'white',
      shadow: 'var(--shadow-md)',
      borderRadius: 'var(--borderRadius-lg)',
      padding: 'var(--spacing-6)',
      border: '1px solid var(--neutral-200)',
    },
    
    // Input Styles
    input: {
      background: 'white',
      border: '1px solid var(--neutral-300)',
      borderRadius: 'var(--borderRadius-md)',
      padding: 'var(--spacing-3) var(--spacing-4)',
      focusBorder: 'var(--primary-500)',
      focusShadow: '0 0 0 3px rgba(255, 152, 0, 0.1)',
    },
    
    // Navigation Styles
    navigation: {
      background: 'white',
      shadow: 'var(--shadow-sm)',
      borderRadius: 'var(--borderRadius-xl)',
      itemPadding: 'var(--spacing-3) var(--spacing-4)',
      activeBackground: 'var(--primary-50)',
      activeColor: 'var(--primary-600)',
    },
  },
  
  // Breakpoints for Responsive Design
  breakpoints: {
    xs: '320px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
    '3xl': '1920px',
  },
  
  // Z-index System
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
    toast: 1070,
    loading: 1080,
  },
} as const;

// Type definitions for the design system
export type DesignSystem = typeof designSystem;
export type Colors = keyof typeof designSystem.colors;
export type Typography = typeof designSystem.typography;
export type Spacing = keyof typeof designSystem.spacing;
export type BorderRadius = keyof typeof designSystem.borderRadius;
export type Shadow = keyof typeof designSystem.shadows;

// Helper functions for accessing design tokens
export const getColor = (color: string, shade?: number | string): string => {
  const colorObj = designSystem.colors[color as keyof typeof designSystem.colors];
  if (typeof colorObj === 'object' && shade !== undefined) {
    return colorObj[shade as keyof typeof colorObj];
  }
  return colorObj as string;
};

export const getSpacing = (spacing: Spacing): string => designSystem.spacing[spacing];
export const getBorderRadius = (radius: BorderRadius): string => designSystem.borderRadius[radius];
export const getShadow = (shadow: Shadow): string => designSystem.shadows[shadow];
export const getAnimationDuration = (duration: keyof typeof designSystem.animations.duration): string => 
  designSystem.animations.duration[duration];
export const getAnimationEasing = (easing: keyof typeof designSystem.animations.easing): string => 
  designSystem.animations.easing[easing];

export default designSystem;