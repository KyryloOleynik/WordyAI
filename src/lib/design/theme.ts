// src/lib/design/theme.ts
// Duolingo-inspired vibrant theme

export const colors = {
    // Background colors
    background: '#131F24',     // Dark background
    surface: '#1C2B33',        // Card surface
    surfaceElevated: '#243B45', // Elevated cards

    // Text
    text: {
        primary: '#FFFFFF',
        secondary: '#A3B8C2',
        tertiary: '#6B8290',
        inverse: '#131F24',
    },

    // Primary brand (Duolingo green)
    primary: {
        50: '#E8FBF0',
        100: '#C6F5D9',
        200: '#89E8B3',
        300: '#58CC02',  // Main green
        400: '#4CAD00',
        500: '#43A000',
        600: '#389200',
        700: '#2E7D00',
        800: '#256600',
        900: '#1A4D00',
    },

    // Secondary (Golden/XP color)
    secondary: {
        300: '#FFD900',
        400: '#FFC800',
        500: '#FFB700',
        600: '#FFA500',
    },

    // Accents
    accent: {
        blue: '#1CB0F6',     // Blue for info/progress
        green: '#58CC02',    // Green for correct
        red: '#FF4B4B',      // Red for incorrect
        amber: '#FFC800',    // Gold for XP/rewards
        purple: '#CE82FF',   // Purple for streaks
    },

    // Status colors
    success: '#58CC02',
    error: '#FF4B4B',
    warning: '#FFC800',
    info: '#1CB0F6',

    // Borders
    border: {
        light: '#2D4451',
        medium: '#3D5663',
        dark: '#4D6673',
    },

    // CEFR Level colors
    cefr: {
        A1: '#58CC02',
        A2: '#89E8B3',
        B1: '#1CB0F6',
        B2: '#1899D6',
        C1: '#CE82FF',
        C2: '#A855F7',
    },
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const borderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
};

export const typography = {
    h1: {
        fontSize: 32,
        fontWeight: '700' as const,
        lineHeight: 40,
    },
    h2: {
        fontSize: 24,
        fontWeight: '700' as const,
        lineHeight: 32,
    },
    h3: {
        fontSize: 20,
        fontWeight: '600' as const,
        lineHeight: 28,
    },
    body: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 24,
    },
    bodyBold: {
        fontSize: 16,
        fontWeight: '700' as const,
        lineHeight: 24,
    },
    bodySmall: {
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
    },
    caption: {
        fontSize: 12,
        fontWeight: '500' as const,
        lineHeight: 16,
    },
    button: {
        fontSize: 16,
        fontWeight: '700' as const,
        lineHeight: 24,
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
    },
};

export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    glow: {
        shadowColor: '#58CC02',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 0,
    },
};
