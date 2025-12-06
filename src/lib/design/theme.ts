// src/lib/design/theme.ts
// Volumetric Duolingo-inspired theme with 3D depth

export const colors = {
    // Background colors
    background: '#0F1A1F',     // Deeper dark
    surface: '#1A2930',        // Card surface
    surfaceElevated: '#243B45', // Elevated cards
    surfacePressed: '#152025', // Pressed state

    // Text
    text: {
        primary: '#FFFFFF',
        secondary: '#A3B8C2',
        tertiary: '#6B8290',
        inverse: '#0F1A1F',
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
        glow: 'rgba(88, 204, 2, 0.4)',
        shadow: '#2E5500',
    },

    // Secondary (Golden/XP color)
    secondary: {
        300: '#FFD900',
        400: '#FFC800',
        500: '#FFB700',
        600: '#FFA500',
        glow: 'rgba(255, 200, 0, 0.4)',
    },

    // Accents
    accent: {
        blue: '#1CB0F6',
        blueGlow: 'rgba(28, 176, 246, 0.4)',
        green: '#58CC02',
        greenGlow: 'rgba(88, 204, 2, 0.4)',
        red: '#FF4B4B',
        redGlow: 'rgba(255, 75, 75, 0.4)',
        amber: '#FFC800',
        amberGlow: 'rgba(255, 200, 0, 0.4)',
        purple: '#CE82FF',
        purpleGlow: 'rgba(206, 130, 255, 0.4)',
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

    // Volumetric gradients
    gradients: {
        greenButton: ['#6EE025', '#58CC02', '#43A000'],
        blueButton: ['#4DC4F9', '#1CB0F6', '#0E8FD0'],
        goldButton: ['#FFE066', '#FFC800', '#E6B000'],
        redButton: ['#FF7373', '#FF4B4B', '#E63E3E'],
        surface: ['#243B45', '#1A2930', '#152025'],
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
    xxxxl: 48,
};

export const borderRadius = {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    xxl: 28,
    full: 9999,
};

export const typography = {
    h1: {
        fontSize: 32,
        fontWeight: '800' as const,
        lineHeight: 40,
        letterSpacing: -0.5,
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
        fontWeight: '500' as const,
        lineHeight: 24,
    },
    bodyBold: {
        fontSize: 16,
        fontWeight: '700' as const,
        lineHeight: 24,
    },
    bodySmall: {
        fontSize: 14,
        fontWeight: '500' as const,
        lineHeight: 20,
    },
    caption: {
        fontSize: 12,
        fontWeight: '600' as const,
        lineHeight: 16,
    },
    button: {
        fontSize: 17,
        fontWeight: '800' as const,
        lineHeight: 24,
        letterSpacing: 0.5,
    },
};

// Volumetric shadows for 3D effect
export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    inner: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
        elevation: 0,
    },
    glow: (color: string) => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 0,
    }),
    button: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 0,
        elevation: 8,
    },
};

// Animation timing
export const animation = {
    fast: 150,
    normal: 250,
    slow: 400,
    spring: {
        damping: 12,
        stiffness: 180,
    },
};

// Volumetric component styles
export const volumetric = {
    // Button with 3D press effect
    buttonBase: {
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xxl,
        borderBottomWidth: 4,
    },
    buttonPressed: {
        transform: [{ translateY: 4 }],
        borderBottomWidth: 0,
    },
    // Card with depth
    cardBase: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 4,
        borderTopColor: colors.border.light,
        borderLeftColor: colors.border.light,
        borderRightColor: colors.border.light,
    },
    // Input with inner glow
    inputBase: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.border.medium,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
    },
    inputFocused: {
        borderColor: colors.primary[300],
        shadowColor: colors.primary.glow,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
    },
};
