// src/components/ui/DesignSystem.tsx
// Unified Volumetric Design System Components

import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    Pressable,
    TextInput,
    StyleSheet,
    Animated,
    ViewStyle,
    TextStyle,
    TextInputProps,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows, animation, volumetric } from '@/lib/design/theme';

// ============ SOUND EFFECTS ============

let soundsEnabled = false;

// Initialize sounds only if assets exist
export function initSounds() {
    soundsEnabled = true;
}

export async function playSound(type: 'correct' | 'wrong' | 'click' | 'levelup' | 'streak') {
    // Sounds disabled by default - will enable when assets are added
    if (!soundsEnabled) return;

    try {
        // Sound files would be loaded here when available
        console.log('Sound:', type);
    } catch (error) {
        // Silently fail if sound files don't exist
    }
}

// ============ ANIMATION HOOKS ============

export function useShake() {
    const shakeAnim = useRef(new Animated.Value(0)).current;

    const shake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    return { shakeAnim, shake };
}

export function usePulse() {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const pulse = () => {
        Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.1, duration: 150, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
    };

    return { pulseAnim, pulse };
}

export function useBounce() {
    const bounceAnim = useRef(new Animated.Value(0)).current;

    const bounce = () => {
        bounceAnim.setValue(0);
        Animated.spring(bounceAnim, {
            toValue: 1,
            damping: 8,
            stiffness: 200,
            useNativeDriver: true,
        }).start();
    };

    const bounceStyle = {
        transform: [{
            translateY: bounceAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, -15, 0],
            }),
        }],
    };

    return { bounceAnim, bounce, bounceStyle };
}

// ============ VOLUMETRIC BUTTON ============

interface VButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    icon?: string;
    fullWidth?: boolean;
    style?: ViewStyle;
}

export function VButton({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    disabled = false,
    icon,
    fullWidth = false,
    style,
}: VButtonProps) {
    const pressAnim = useRef(new Animated.Value(0)).current;

    const handlePressIn = () => {
        Animated.timing(pressAnim, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.timing(pressAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
        }).start();
    };

    const getColors = () => {
        switch (variant) {
            case 'success':
                return { bg: colors.primary[300], border: colors.primary[700], text: colors.text.inverse };
            case 'danger':
                return { bg: colors.accent.red, border: '#B33A3A', text: colors.text.primary };
            case 'secondary':
                return { bg: colors.accent.amber, border: '#CC9C00', text: colors.text.inverse };
            case 'ghost':
                return { bg: 'transparent', border: colors.border.medium, text: colors.text.secondary };
            default:
                return { bg: colors.primary[300], border: colors.primary[700], text: colors.text.inverse };
        }
    };

    const getSizes = () => {
        switch (size) {
            case 'small':
                return { py: spacing.sm, px: spacing.lg, fontSize: 14, borderWidth: 3 };
            case 'large':
                return { py: spacing.xl, px: spacing.xxxl, fontSize: 18, borderWidth: 5 };
            default:
                return { py: spacing.lg, px: spacing.xxl, fontSize: 16, borderWidth: 4 };
        }
    };

    const colorConfig = getColors();
    const sizeConfig = getSizes();

    const animatedStyle = {
        transform: [
            {
                translateY: pressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, sizeConfig.borderWidth],
                }),
            },
        ],
    };

    const borderStyle = {
        borderBottomWidth: pressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [sizeConfig.borderWidth, 0],
        }),
    };

    return (
        <Pressable
            onPress={() => {
                playSound('click');
                onPress();
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            style={[fullWidth && { width: '100%' }]}
        >
            <Animated.View
                style={[
                    styles.vButton,
                    {
                        backgroundColor: disabled ? colors.border.medium : colorConfig.bg,
                        borderBottomColor: colorConfig.border,
                        paddingVertical: sizeConfig.py,
                        paddingHorizontal: sizeConfig.px,
                    },
                    animatedStyle,
                    borderStyle as any,
                    style,
                ]}
            >
                {icon && <Text style={styles.vButtonIcon}>{icon}</Text>}
                <Text
                    style={[
                        styles.vButtonText,
                        { color: disabled ? colors.text.tertiary : colorConfig.text, fontSize: sizeConfig.fontSize },
                    ]}
                >
                    {title}
                </Text>
            </Animated.View>
        </Pressable>
    );
}

// ============ VOLUMETRIC CARD ============

interface VCardProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'success' | 'error';
    style?: ViewStyle;
    onPress?: () => void;
}

export function VCard({ children, variant = 'default', style, onPress }: VCardProps) {
    const getCardStyle = () => {
        switch (variant) {
            case 'elevated':
                return { backgroundColor: colors.surfaceElevated, borderColor: colors.border.medium };
            case 'success':
                return { backgroundColor: `${colors.success}15`, borderColor: colors.success };
            case 'error':
                return { backgroundColor: `${colors.error}15`, borderColor: colors.error };
            default:
                return { backgroundColor: colors.surface, borderColor: colors.border.light };
        }
    };

    const cardStyle = getCardStyle();

    const content = (
        <View
            style={[
                styles.vCard,
                cardStyle,
                style,
            ]}
        >
            {children}
        </View>
    );

    if (onPress) {
        return (
            <Pressable onPress={onPress}>
                {content}
            </Pressable>
        );
    }

    return content;
}

// ============ VOLUMETRIC INPUT ============

interface VInputProps extends TextInputProps {
    label?: string;
    error?: string;
    icon?: string;
}

export function VInput({ label, error, icon, style, ...props }: VInputProps) {
    const [isFocused, setIsFocused] = React.useState(false);
    const focusAnim = useRef(new Animated.Value(0)).current;

    const handleFocus = () => {
        setIsFocused(true);
        Animated.timing(focusAnim, {
            toValue: 1,
            duration: animation.fast,
            useNativeDriver: false,
        }).start();
    };

    const handleBlur = () => {
        setIsFocused(false);
        Animated.timing(focusAnim, {
            toValue: 0,
            duration: animation.fast,
            useNativeDriver: false,
        }).start();
    };

    const borderColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.border.medium, colors.primary[300]],
    });

    return (
        <View style={styles.vInputContainer}>
            {label && <Text style={styles.vInputLabel}>{label}</Text>}
            <Animated.View
                style={[
                    styles.vInputWrapper,
                    { borderColor },
                    error && styles.vInputError,
                    isFocused && shadows.glow(colors.primary[300]),
                ]}
            >
                {icon && <Text style={styles.vInputIcon}>{icon}</Text>}
                <TextInput
                    style={[styles.vInput, style]}
                    placeholderTextColor={colors.text.tertiary}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    {...props}
                />
            </Animated.View>
            {error && <Text style={styles.vInputErrorText}>{error}</Text>}
        </View>
    );
}

// ============ PROGRESS BAR ============

interface VProgressProps {
    progress: number; // 0-1
    color?: string;
    height?: number;
    showLabel?: boolean;
}

export function VProgress({ progress, color = colors.primary[300], height = 12, showLabel = false }: VProgressProps) {
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: animation.slow,
            useNativeDriver: false,
        }).start();
    }, [progress]);

    const widthPercent = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.vProgressContainer}>
            <View style={[styles.vProgressTrack, { height }]}>
                <Animated.View
                    style={[
                        styles.vProgressFill,
                        { width: widthPercent, backgroundColor: color, height },
                    ]}
                />
            </View>
            {showLabel && (
                <Text style={styles.vProgressLabel}>{Math.round(progress * 100)}%</Text>
            )}
        </View>
    );
}

// ============ SUCCESS CELEBRATION ============

interface SuccessModalProps {
    visible: boolean;
    xp: number;
    message?: string;
    onContinue: () => void;
}

export function SuccessModal({ visible, xp, message = 'Отлично!', onContinue }: SuccessModalProps) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const { bounce, bounceStyle } = useBounce();

    useEffect(() => {
        if (visible) {
            playSound('correct');
            Animated.spring(scaleAnim, {
                toValue: 1,
                damping: 10,
                stiffness: 150,
                useNativeDriver: true,
            }).start();
            bounce();
        } else {
            scaleAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={styles.successOverlay}>
            <Animated.View
                style={[
                    styles.successModal,
                    { transform: [{ scale: scaleAnim }] },
                ]}
            >
                <Animated.Text style={[styles.successEmoji, bounceStyle]}>🎉</Animated.Text>
                <Text style={styles.successTitle}>{message}</Text>
                <View style={styles.xpBadge}>
                    <Text style={styles.xpBadgeText}>+{xp} XP</Text>
                </View>
                <VButton
                    title="Продолжить"
                    variant="success"
                    onPress={onContinue}
                    fullWidth
                />
            </Animated.View>
        </View>
    );
}

// ============ STYLES ============

const styles = StyleSheet.create({
    // VButton
    vButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
    },
    vButtonIcon: {
        fontSize: 20,
    },
    vButtonText: {
        ...typography.button,
        textAlign: 'center',
    },

    // VCard
    vCard: {
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderBottomWidth: 4,
        borderBottomColor: 'rgba(0,0,0,0.3)',
        padding: spacing.xl,
    },

    // VInput
    vInputContainer: {
        gap: spacing.xs,
    },
    vInputLabel: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        marginLeft: spacing.xs,
    },
    vInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        paddingHorizontal: spacing.lg,
    },
    vInputIcon: {
        fontSize: 18,
        marginRight: spacing.sm,
    },
    vInput: {
        flex: 1,
        ...typography.body,
        color: colors.text.primary,
        paddingVertical: spacing.lg,
    },
    vInputError: {
        borderColor: colors.error,
    },
    vInputErrorText: {
        ...typography.caption,
        color: colors.error,
        marginLeft: spacing.xs,
    },

    // VProgress
    vProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    vProgressTrack: {
        flex: 1,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    vProgressFill: {
        borderRadius: borderRadius.full,
    },
    vProgressLabel: {
        ...typography.caption,
        color: colors.text.secondary,
        minWidth: 40,
        textAlign: 'right',
    },

    // Success Modal
    successOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    successModal: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xxl,
        padding: spacing.xxxl,
        alignItems: 'center',
        width: '85%',
        maxWidth: 320,
        borderWidth: 1,
        borderColor: colors.border.light,
    },
    successEmoji: {
        fontSize: 72,
        marginBottom: spacing.lg,
    },
    successTitle: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.xl,
    },
    xpBadge: {
        backgroundColor: `${colors.accent.amber}20`,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        marginBottom: spacing.xxl,
    },
    xpBadgeText: {
        ...typography.h3,
        color: colors.accent.amber,
        fontWeight: '800',
    },
});
