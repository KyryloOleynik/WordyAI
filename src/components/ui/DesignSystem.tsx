// src/components/ui/DesignSystem.tsx
// Unified Volumetric Design System Components

import React, { useRef, useEffect, useState } from 'react';
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
    StyleProp,
    Modal
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows, animation, volumetric } from '@/lib/design/theme';

// Initialize sounds only if assets exist
let soundsEnabled = false;

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
    loading?: boolean;
    style?: ViewStyle;
}

export function VButton({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    icon,
    fullWidth = false,
    style,
}: VButtonProps) {
    const pressAnim = useRef(new Animated.Value(0)).current;

    const handlePressIn = () => {
        Animated.timing(pressAnim, {
            toValue: 1,
            duration: 80,
            useNativeDriver: false, // Explicitly false for layout properties
        }).start();
    };

    const handlePressOut = () => {
        Animated.timing(pressAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: false, // Explicitly false for layout properties
        }).start();
    };

    const getColors = () => {
        switch (variant) {
            case 'success':
                return { bg: colors.primary[300], border: colors.primary[700], text: colors.text.inverse };
            case 'danger':
                return { bg: colors.accent.red, border: '#B33A3A', text: colors.text.primary };
            case 'secondary':
                return { bg: colors.surfaceElevated, text: colors.text.primary, border: colors.border.medium };
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

    // We interpolate both transform and border, so we MUST use nativeDriver: false
    const animatedTransform = {
        transform: [
            {
                translateY: pressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, sizeConfig.borderWidth],
                }),
            },
        ],
    };

    const animatedBorder = {
        borderBottomWidth: pressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [sizeConfig.borderWidth, 0],
        }),
    };

    return (
        <Pressable
            onPress={() => {
                if (loading) return;
                playSound('click');
                onPress();
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
            style={[fullWidth && { width: '100%' }]}
        >
            <Animated.View
                style={[
                    styles.vButton,
                    {
                        backgroundColor: (disabled || loading) ? colors.border.light : colorConfig.bg,
                        borderColor: (disabled || loading) ? colors.border.medium : colorConfig.border,
                        paddingVertical: sizeConfig.py,
                        paddingHorizontal: sizeConfig.px,
                    },
                    animatedTransform,
                    animatedBorder,
                    style,
                ]}
            >
                {loading ? (
                    <Text
                        style={[
                            styles.vButtonText,
                            { color: colors.text.tertiary, fontSize: sizeConfig.fontSize },
                        ]}
                    >
                        Please wait...
                    </Text>
                ) : (
                    <>
                        {icon && <Text style={styles.vButtonIcon}>{icon}</Text>}
                        <Text
                            style={[
                                styles.vButtonText,
                                { color: disabled ? colors.text.tertiary : colorConfig.text, fontSize: sizeConfig.fontSize },
                            ]}
                        >
                            {title}
                        </Text>
                    </>
                )}
            </Animated.View>
        </Pressable>
    );
}

// ============ VOLUMETRIC CARD ============

interface VCardProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'success' | 'error' | 'primary';
    style?: StyleProp<ViewStyle>;
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
            case 'primary':
                // Explicitly set all sides to avoid Android black border bug with borderRadius
                return {
                    backgroundColor: colors.surface,
                    borderTopWidth: 2,
                    borderLeftWidth: 2,
                    borderRightWidth: 2,
                    borderBottomWidth: 4,
                    borderTopColor: colors.primary[300],
                    borderLeftColor: colors.primary[300],
                    borderRightColor: colors.primary[300],
                    borderBottomColor: colors.primary[700]
                };
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
            <Pressable onPress={onPress} style={[{ width: '100%' }, style]}>
                <View
                    style={[
                        styles.vCard,
                        cardStyle,
                        { flex: 1 }, // Ensure inner view fills the Pressable area
                    ]}
                >
                    {children}
                </View>
            </Pressable>
        );
    }

    return content;
}

// ============ STYLED INPUT ============

export function StyledInput({ style, ...props }: TextInputProps) {
    return (
        <TextInput
            style={[{
                backgroundColor: colors.surfaceElevated,
                borderRadius: borderRadius.lg,
                padding: spacing.md,
                ...typography.body,
                color: colors.text.primary,
            }, style]}
            placeholderTextColor={colors.text.tertiary}
            {...props}
        />
    );
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
                    <Text style={styles.xpText}>+{xp} XP</Text>
                </View>

                <View style={{ width: '100%', marginTop: spacing.xl }}>
                    <VButton
                        title="Продолжить"
                        onPress={onContinue}
                        fullWidth
                    />
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    vButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.xl,
        borderBottomWidth: 4,
        gap: spacing.sm,
    },
    vButtonText: {
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    vButtonIcon: {
        fontSize: 20,
        marginRight: spacing.xs,
    },
    vCard: {
        padding: spacing.lg,
        ...volumetric.cardBase,
    },
    vInputContainer: {
        marginBottom: spacing.lg,
        width: '100%',
    },
    vInputLabel: {
        ...typography.caption,
        marginBottom: spacing.xs,
        marginLeft: spacing.xs,
    },
    vInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.border.medium,
        paddingHorizontal: spacing.md,
        minHeight: 56,
    },
    vInputIcon: {
        fontSize: 20,
        marginRight: spacing.sm,
    },
    vInput: {
        flex: 1,
        ...typography.body,
        color: colors.text.primary,
        height: '100%',
    },
    vInputError: {
        borderColor: colors.error,
    },
    vInputErrorText: {
        color: colors.error,
        fontSize: 12,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    },
    vProgressContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
    },
    vProgressTrack: {
        flex: 1,
        backgroundColor: colors.border.light,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    vProgressFill: {
        borderRadius: borderRadius.full,
    },
    vProgressLabel: {
        ...typography.caption,
        marginLeft: spacing.sm,
        fontWeight: 'bold',
        width: 35,
    },
    successOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    successModal: {
        width: '85%',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xxl,
        padding: spacing.xxl,
        alignItems: 'center',
        ...shadows.lg,
    },
    successEmoji: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    successTitle: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    xpBadge: {
        backgroundColor: colors.accent.amber,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
    },
    xpText: {
        ...typography.h3,
        color: colors.text.inverse,
    },
});
