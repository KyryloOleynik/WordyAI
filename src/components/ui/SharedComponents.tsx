/**
 * Shared UI Components - Consistent styling across the app
 */
import { StyleSheet, Text, View, Pressable, Animated, Modal } from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import * as Speech from 'expo-speech';

// ============= SUCCESS ANIMATION =============

interface SuccessAnimationProps {
    visible: boolean;
    xpEarned: number;
    message?: string;
    onComplete?: () => void;
}

export function SuccessAnimation({ visible, xpEarned, message, onComplete }: SuccessAnimationProps) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const xpScaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Reset animations
            scaleAnim.setValue(0);
            opacityAnim.setValue(0);
            xpScaleAnim.setValue(0);

            // Play sequence
            Animated.sequence([
                Animated.parallel([
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        tension: 100,
                        friction: 8,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.spring(xpScaleAnim, {
                    toValue: 1,
                    tension: 120,
                    friction: 6,
                    useNativeDriver: true,
                }),
                Animated.delay(1500),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                onComplete?.();
            });
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={successStyles.overlay}>
            <Animated.View style={[
                successStyles.container,
                {
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                }
            ]}>
                <Text style={successStyles.emoji}>🎉</Text>
                <Text style={successStyles.title}>{message || 'Отлично!'}</Text>
                <Animated.View style={[
                    successStyles.xpBadge,
                    { transform: [{ scale: xpScaleAnim }] }
                ]}>
                    <Text style={successStyles.xpText}>+{xpEarned} XP</Text>
                </Animated.View>
            </Animated.View>
        </View>
    );
}

const successStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    container: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xxl,
        padding: spacing.xxl,
        alignItems: 'center',
        minWidth: 200,
    },
    emoji: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    xpBadge: {
        backgroundColor: colors.accent.amber,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
    },
    xpText: {
        ...typography.h3,
        color: colors.text.inverse,
    },
});

// ============= WORD INFO MODAL =============

interface WordInfoModalProps {
    visible: boolean;
    word: string;
    translation?: string;
    definition?: string;
    phonetic?: string;
    partOfSpeech?: string;
    examples?: string[];
    cefrLevel?: string;
    onClose: () => void;
}

export function WordInfoModal({
    visible,
    word,
    translation,
    definition,
    phonetic,
    partOfSpeech,
    examples,
    cefrLevel,
    onClose,
}: WordInfoModalProps) {
    const [isSpeaking, setIsSpeaking] = useState(false);

    const handleSpeak = async () => {
        if (isSpeaking) {
            await Speech.stop();
            setIsSpeaking(false);
        } else {
            setIsSpeaking(true);
            await Speech.speak(word, {
                language: 'en-US',
                rate: 0.8,
                onDone: () => setIsSpeaking(false),
                onError: () => setIsSpeaking(false),
            });
        }
    };

    const handleClose = () => {
        Speech.stop();
        setIsSpeaking(false);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <Pressable style={wordStyles.overlay} onPress={handleClose}>
                <Pressable style={wordStyles.modal} onPress={e => e.stopPropagation()}>
                    {/* Header with word and pronunciation */}
                    <View style={wordStyles.header}>
                        <View style={wordStyles.wordInfo}>
                            <Text style={wordStyles.word}>{word}</Text>
                            {phonetic && (
                                <Text style={wordStyles.phonetic}>{phonetic}</Text>
                            )}
                            {partOfSpeech && (
                                <Text style={wordStyles.partOfSpeech}>{partOfSpeech}</Text>
                            )}
                        </View>
                        <Pressable
                            style={[wordStyles.speakButton, isSpeaking && wordStyles.speakButtonActive]}
                            onPress={handleSpeak}
                        >
                            <Text style={wordStyles.speakIcon}>{isSpeaking ? '🔊' : '🔈'}</Text>
                        </Pressable>
                    </View>

                    {/* CEFR Level */}
                    {cefrLevel && (
                        <View style={wordStyles.levelBadge}>
                            <Text style={wordStyles.levelText}>{cefrLevel}</Text>
                        </View>
                    )}

                    {/* Translation */}
                    {translation && (
                        <View style={wordStyles.section}>
                            <Text style={wordStyles.sectionLabel}>Перевод</Text>
                            <Text style={wordStyles.translation}>{translation}</Text>
                        </View>
                    )}

                    {/* Definition */}
                    {definition && (
                        <View style={wordStyles.section}>
                            <Text style={wordStyles.sectionLabel}>Определение</Text>
                            <Text style={wordStyles.definition}>{definition}</Text>
                        </View>
                    )}

                    {/* Examples */}
                    {examples && examples.length > 0 && (
                        <View style={wordStyles.section}>
                            <Text style={wordStyles.sectionLabel}>Примеры</Text>
                            {examples.slice(0, 2).map((ex, i) => (
                                <Text key={i} style={wordStyles.example}>• {ex}</Text>
                            ))}
                        </View>
                    )}

                    {/* Close button */}
                    <Pressable style={wordStyles.closeButton} onPress={handleClose}>
                        <Text style={wordStyles.closeText}>Закрыть</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const wordStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modal: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 360,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
    },
    wordInfo: {
        flex: 1,
    },
    word: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    phonetic: {
        ...typography.body,
        color: colors.text.secondary,
        fontStyle: 'italic',
    },
    partOfSpeech: {
        ...typography.caption,
        color: colors.primary[300],
        marginTop: spacing.xs,
    },
    speakButton: {
        backgroundColor: colors.surfaceElevated,
        width: 48,
        height: 48,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    speakButtonActive: {
        backgroundColor: colors.primary[300],
    },
    speakIcon: {
        fontSize: 24,
    },
    levelBadge: {
        alignSelf: 'flex-start',
        backgroundColor: `${colors.primary[300]}20`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginBottom: spacing.lg,
    },
    levelText: {
        ...typography.caption,
        color: colors.primary[300],
        fontWeight: '600',
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionLabel: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
    },
    translation: {
        ...typography.h3,
        color: colors.accent.amber,
    },
    definition: {
        ...typography.body,
        color: colors.text.primary,
        lineHeight: 22,
    },
    example: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        marginTop: spacing.xs,
        fontStyle: 'italic',
    },
    closeButton: {
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        alignItems: 'center',
        marginTop: spacing.md,
    },
    closeText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
    },
});

// ============= STREAMING TEXT =============

interface StreamingTextProps {
    text: string;
    style?: any;
}

export function StreamingText({ text, style }: StreamingTextProps) {
    return (
        <Text style={[{ color: colors.text.primary }, style]}>
            {text}
            <Text style={{ color: colors.primary[300] }}>▌</Text>
        </Text>
    );
}

// ============= PRIMARY BUTTON =============

interface PrimaryButtonProps {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'primary' | 'secondary' | 'success';
    icon?: string;
}

export function PrimaryButton({
    title,
    onPress,
    disabled,
    loading,
    variant = 'primary',
    icon,
}: PrimaryButtonProps) {
    const getBackgroundColor = () => {
        if (disabled) return colors.border.medium;
        switch (variant) {
            case 'success': return colors.accent.green;
            case 'secondary': return colors.surface;
            default: return colors.primary[300];
        }
    };

    const getTextColor = () => {
        if (variant === 'secondary') return colors.text.primary;
        return colors.text.inverse;
    };

    return (
        <Pressable
            style={({ pressed }) => [
                buttonStyles.button,
                { backgroundColor: getBackgroundColor() },
                pressed && !disabled && buttonStyles.pressed,
                disabled && buttonStyles.disabled,
            ]}
            onPress={onPress}
            disabled={disabled || loading}
        >
            {icon && <Text style={buttonStyles.icon}>{icon}</Text>}
            <Text style={[buttonStyles.text, { color: getTextColor() }]}>
                {loading ? 'Загрузка...' : title}
            </Text>
        </Pressable>
    );
}

const buttonStyles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
    },
    pressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    disabled: {
        opacity: 0.5,
    },
    icon: {
        fontSize: 20,
    },
    text: {
        ...typography.bodyBold,
    },
});

// ============= LOADING INDICATOR =============

interface LoadingIndicatorProps {
    text?: string;
}

export function LoadingIndicator({ text = 'Загрузка...' }: LoadingIndicatorProps) {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <View style={loadingStyles.container}>
            <Animated.View style={[loadingStyles.dots, { opacity: pulseAnim }]}>
                <View style={loadingStyles.dot} />
                <View style={loadingStyles.dot} />
                <View style={loadingStyles.dot} />
            </Animated.View>
            <Text style={loadingStyles.text}>{text}</Text>
        </View>
    );
}

const loadingStyles = StyleSheet.create({
    container: {
        alignItems: 'center',
        padding: spacing.lg,
    },
    dots: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary[300],
    },
    text: {
        ...typography.body,
        color: colors.text.secondary,
    },
});
