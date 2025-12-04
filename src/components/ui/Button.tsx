import { StyleSheet, Text, Pressable, View, ViewStyle, ActivityIndicator } from 'react-native';
import { colors, borderRadius, spacing, typography } from '@/lib/design/theme';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'success' | 'danger';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    icon?: string;
}

// Duolingo-style 3D button colors
const BUTTON_COLORS: Record<string, { top: string; bottom: string; text: string; border?: string }> = {
    primary: {
        top: colors.primary[300],      // Bright green
        bottom: colors.primary[700],   // Darker green for 3D effect
        text: colors.text.inverse,
    },
    secondary: {
        top: colors.surface,
        bottom: colors.border.dark,
        text: colors.text.primary,
    },
    outline: {
        top: 'transparent',
        bottom: 'transparent',
        text: colors.primary[300],
        border: colors.primary[300],
    },
    success: {
        top: colors.accent.green,
        bottom: '#2E7D00',
        text: colors.text.inverse,
    },
    danger: {
        top: colors.accent.red,
        bottom: '#CC3333',
        text: colors.text.inverse,
    },
};

export default function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    style,
    icon,
}: ButtonProps) {
    const colorScheme = BUTTON_COLORS[variant];
    const isOutline = variant === 'outline';

    return (
        <View style={[styles.container, style]}>
            {/* 3D shadow/bottom layer */}
            {!isOutline && (
                <View
                    style={[
                        styles.shadowLayer,
                        styles[`${size}Shadow`],
                        { backgroundColor: colorScheme.bottom },
                        disabled && styles.disabledShadow,
                    ]}
                />
            )}

            {/* Main button */}
            <Pressable
                onPress={onPress}
                disabled={disabled || loading}
                style={({ pressed }) => [
                    styles.button,
                    styles[size],
                    isOutline && styles.outlineBorder,
                    isOutline && { borderColor: colorScheme.border },
                    { backgroundColor: isOutline ? 'transparent' : colorScheme.top },
                    disabled && styles.disabled,
                    pressed && !disabled && styles.pressed,
                    pressed && !disabled && !isOutline && { transform: [{ translateY: 2 }] },
                ]}
            >
                {loading ? (
                    <ActivityIndicator color={colorScheme.text} />
                ) : (
                    <View style={styles.content}>
                        {icon && <Text style={styles.icon}>{icon}</Text>}
                        <Text style={[
                            styles.text,
                            styles[`${size}Text`],
                            { color: colorScheme.text }
                        ]}>
                            {title}
                        </Text>
                    </View>
                )}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },

    // 3D shadow layer (sits behind the button)
    shadowLayer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: borderRadius.lg,
    },
    smallShadow: {
        height: spacing.sm + 4,
    },
    mediumShadow: {
        height: spacing.md + 6,
    },
    largeShadow: {
        height: spacing.lg + 6,
    },

    // Main button
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.lg,
        // Lifted above the shadow
        marginBottom: 4,
    },

    outlineBorder: {
        borderWidth: 2,
        marginBottom: 0,
    },

    // Sizes
    small: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        minHeight: 36,
    },
    medium: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        minHeight: 48,
    },
    large: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xxl,
        minHeight: 56,
    },

    // States
    disabled: {
        opacity: 0.5,
    },
    disabledShadow: {
        opacity: 0.3,
    },
    pressed: {
        // Button "pushes down" when pressed
    },

    // Content
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    icon: {
        fontSize: 18,
    },

    // Text styles
    text: {
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    smallText: {
        fontSize: typography.bodySmall.fontSize,
    },
    mediumText: {
        fontSize: typography.body.fontSize,
    },
    largeText: {
        fontSize: typography.h3.fontSize,
    },
});
