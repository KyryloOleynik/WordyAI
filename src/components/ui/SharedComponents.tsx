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

// ============= STREAK ANIMATION =============

interface StreakAnimationProps {
    visible: boolean;
    streakCount: number;
    onComplete?: () => void;
}

export function StreakAnimation({ visible, streakCount, onComplete }: StreakAnimationProps) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const flameScaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (visible) {
            scaleAnim.setValue(0);
            rotateAnim.setValue(0);
            opacityAnim.setValue(0);
            flameScaleAnim.setValue(1);

            // Fire pulse animation
            const flame = Animated.loop(
                Animated.sequence([
                    Animated.timing(flameScaleAnim, { toValue: 1.2, duration: 300, useNativeDriver: true }),
                    Animated.timing(flameScaleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                ]),
                { iterations: 4 }
            );

            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 80,
                    friction: 6,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                flame,
            ]).start();

            setTimeout(() => {
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => onComplete?.());
            }, 2500);
        }
    }, [visible]);

    if (!visible) return null;

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['-10deg', '0deg'],
    });

    return (
        <View style={streakStyles.overlay}>
            <Animated.View style={[
                streakStyles.container,
                {
                    transform: [{ scale: scaleAnim }, { rotate }],
                    opacity: opacityAnim,
                }
            ]}>
                <Animated.Text style={[
                    streakStyles.fire,
                    { transform: [{ scale: flameScaleAnim }] }
                ]}>
                    🔥
                </Animated.Text>
                <Text style={streakStyles.count}>{streakCount}</Text>
                <Text style={streakStyles.label}>дней подряд!</Text>
                <View style={streakStyles.glow} />
            </Animated.View>
        </View>
    );
}

const streakStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    container: {
        alignItems: 'center',
        padding: spacing.xxl,
    },
    fire: {
        fontSize: 80,
        marginBottom: spacing.md,
    },
    count: {
        fontSize: 64,
        fontWeight: '800',
        color: colors.accent.amber,
        marginBottom: spacing.xs,
    },
    label: {
        ...typography.h3,
        color: colors.text.inverse,
    },
    glow: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: colors.accent.amber,
        opacity: 0.2,
        zIndex: -1,
    },
});

// ============= VOLUMETRIC BUTTON (3D Effect) =============

interface VolumetricButtonProps {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'primary' | 'success' | 'amber';
    icon?: string;
    size?: 'normal' | 'large';
}

export function VolumetricButton({
    title,
    onPress,
    disabled,
    loading,
    variant = 'primary',
    icon,
    size = 'normal',
}: VolumetricButtonProps) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const translateYAnim = useRef(new Animated.Value(0)).current;

    const getColors = () => {
        switch (variant) {
            case 'success':
                return {
                    top: colors.accent.green,
                    bottom: '#1a6534',
                    text: colors.text.inverse,
                };
            case 'amber':
                return {
                    top: colors.accent.amber,
                    bottom: '#8B5A00',
                    text: colors.text.inverse,
                };
            default:
                return {
                    top: colors.primary[300],
                    bottom: colors.primary[700],
                    text: colors.text.inverse,
                };
        }
    };

    const colorScheme = getColors();

    const handlePressIn = () => {
        Animated.parallel([
            Animated.timing(scaleAnim, { toValue: 0.97, duration: 100, useNativeDriver: true }),
            Animated.timing(translateYAnim, { toValue: 3, duration: 100, useNativeDriver: true }),
        ]).start();
    };

    const handlePressOut = () => {
        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
            Animated.spring(translateYAnim, { toValue: 0, tension: 200, friction: 10, useNativeDriver: true }),
        ]).start();
    };

    return (
        <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
        >
            <Animated.View style={[
                volumetricStyles.wrapper,
                { transform: [{ scale: scaleAnim }] },
                disabled && { opacity: 0.5 },
            ]}>
                {/* Shadow/Bottom layer */}
                <View style={[
                    volumetricStyles.shadow,
                    { backgroundColor: colorScheme.bottom },
                    size === 'large' && volumetricStyles.shadowLarge,
                ]} />
                {/* Top button */}
                <Animated.View style={[
                    volumetricStyles.button,
                    { backgroundColor: colorScheme.top, transform: [{ translateY: translateYAnim }] },
                    size === 'large' && volumetricStyles.buttonLarge,
                ]}>
                    <View style={volumetricStyles.highlight} />
                    {icon && <Text style={volumetricStyles.icon}>{icon}</Text>}
                    <Text style={[volumetricStyles.text, { color: colorScheme.text }, size === 'large' && volumetricStyles.textLarge]}>
                        {loading ? 'Загрузка...' : title}
                    </Text>
                </Animated.View>
            </Animated.View>
        </Pressable>
    );
}

const volumetricStyles = StyleSheet.create({
    wrapper: {
        position: 'relative',
    },
    shadow: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 52,
        borderRadius: borderRadius.xl,
    },
    shadowLarge: {
        height: 64,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xxl,
        borderRadius: borderRadius.xl,
        gap: spacing.sm,
        position: 'relative',
        overflow: 'hidden',
    },
    buttonLarge: {
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.xxxl,
    },
    highlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '50%',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
    },
    icon: {
        fontSize: 22,
    },
    text: {
        ...typography.bodyBold,
        fontSize: 16,
    },
    textLarge: {
        fontSize: 18,
    },
});

// ============= EXERCISE HEADER (XP + Progress) =============

interface ExerciseHeaderProps {
    progress: number; // 0-1
    xpEarned: number;
    onBack?: () => void;
}

export function ExerciseHeader({ progress, xpEarned, onBack }: ExerciseHeaderProps) {
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(progressAnim, {
            toValue: progress,
            tension: 50,
            friction: 10,
            useNativeDriver: false,
        }).start();
    }, [progress]);

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={exerciseHeaderStyles.container}>
            {onBack && (
                <Pressable style={exerciseHeaderStyles.backButton} onPress={onBack}>
                    <Text style={exerciseHeaderStyles.backIcon}>←</Text>
                </Pressable>
            )}
            <View style={exerciseHeaderStyles.progressContainer}>
                <View style={exerciseHeaderStyles.progressTrack}>
                    <Animated.View style={[exerciseHeaderStyles.progressBar, { width: progressWidth }]} />
                </View>
            </View>
            <View style={exerciseHeaderStyles.xpBadge}>
                <Text style={exerciseHeaderStyles.xpText}>+{xpEarned} XP</Text>
            </View>
        </View>
    );
}

const exerciseHeaderStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surfaceElevated,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        fontSize: 20,
        color: colors.text.primary,
    },
    progressContainer: {
        flex: 1,
    },
    progressTrack: {
        height: 10,
        backgroundColor: colors.surfaceElevated,
        borderRadius: 5,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primary[300],
        borderRadius: 5,
    },
    xpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${colors.accent.amber}20`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: spacing.xs,
    },
    xpText: {
        ...typography.caption,
        color: colors.accent.amber,
        fontWeight: '700',
    },
});

// ============= WRONG ANSWER OVERLAY (Red Flash) =============

interface WrongAnswerFlashProps {
    visible: boolean;
}

export function WrongAnswerFlash({ visible }: WrongAnswerFlashProps) {
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            opacityAnim.setValue(0.4);
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                wrongFlashStyles.overlay,
                { opacity: opacityAnim },
            ]}
            pointerEvents="none"
        />
    );
}

const wrongFlashStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.accent.red,
        zIndex: 999,
    },
});

// ============= MATCHING GAME COMPONENT =============

export interface MatchingWord {
    id: string;
    text: string;
    translation: string;
}

interface MatchCard {
    id: string;
    text: string;
    matchId: string;
    type: 'word' | 'meaning';
    isSelected: boolean;
    isMatched: boolean;
    isFading: boolean;
    opacity: Animated.Value;
}

interface MatchingGameProps {
    words: MatchingWord[];
    showTranslation?: boolean;
    onMatch: (wordId: string, isCorrect: boolean) => void;
    onComplete: (score: number, mistakes: number) => void;
    totalMatches?: number;
    visiblePairs?: number;
    showProgressBar?: boolean;
}

export function MatchingGame({
    words,
    showTranslation = true,
    onMatch,
    onComplete,
    totalMatches = 10,
    visiblePairs = 5,
    showProgressBar = true,
}: MatchingGameProps) {
    const [visibleCards, setVisibleCards] = useState<MatchCard[]>([]);
    const [wordPool, setWordPool] = useState<MatchingWord[]>([]);
    const [nextWordIndex, setNextWordIndex] = useState(visiblePairs);
    const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
    const [completedMatches, setCompletedMatches] = useState(0);
    const [mistakes, setMistakes] = useState(0);
    const [score, setScore] = useState(0);
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Initialize game
    useEffect(() => {
        // Strict deduplication to prevent recurring words
        const seen = new Set<string>();
        const uniqueWords = words.filter(w => {
            const txt = w.text.toLowerCase().trim();
            if (seen.has(txt)) return false;
            seen.add(txt);
            return true;
        });

        const shuffled = [...uniqueWords].sort(() => Math.random() - 0.5).slice(0, totalMatches);
        setWordPool(shuffled);
        createVisibleCards(shuffled.slice(0, visiblePairs));
        setNextWordIndex(visiblePairs);

        // Reset game state for new round
        setCompletedMatches(0);
        setMistakes(0);
        setScore(0);
        setMatchedQueue([]);
    }, [words, visiblePairs, totalMatches]);

    // Animate progress
    useEffect(() => {
        const progress = completedMatches / totalMatches;
        Animated.spring(progressAnim, {
            toValue: progress,
            tension: 50,
            friction: 10,
            useNativeDriver: false,
        }).start();

        if (completedMatches >= totalMatches) {
            setTimeout(() => onComplete(score, mistakes), 500);
        }
    }, [completedMatches, totalMatches, score, mistakes]);

    const createVisibleCards = (selectedWords: MatchingWord[]) => {
        const wordCards: MatchCard[] = selectedWords.map(w => ({
            id: `word-${w.id}`,
            text: w.text,
            matchId: w.id,
            type: 'word' as const,
            isSelected: false,
            isMatched: false,
            isFading: false,
            opacity: new Animated.Value(1),
        }));

        const meaningCards: MatchCard[] = selectedWords.map(w => ({
            id: `meaning-${w.id}`,
            text: w.translation,
            matchId: w.id,
            type: 'meaning' as const,
            isSelected: false,
            isMatched: false,
            isFading: false,
            opacity: new Animated.Value(1),
        }));

        setVisibleCards([
            ...wordCards.sort(() => Math.random() - 0.5),
            ...meaningCards.sort(() => Math.random() - 0.5),
        ]);
        setSelectedCard(null);
    };

    const [matchedQueue, setMatchedQueue] = useState<string[]>([]);

    const triggerRefillFor = (matchIdToReplace: string) => {
        if (nextWordIndex >= wordPool.length) {
            // No more words? REQUIREMENT: Matched cards stay visible on screen.
            // Do not fade out. Do not replace. Just return.
            return;
        }

        const nextWord = wordPool[nextWordIndex];
        setNextWordIndex(prev => prev + 1);

        const newWordCard: MatchCard = {
            id: `word-${nextWord.id}`,
            text: nextWord.text,
            matchId: nextWord.id,
            type: 'word',
            isSelected: false,
            isMatched: false,
            isFading: false,
            opacity: new Animated.Value(0),
        };

        const newMeaningCard: MatchCard = {
            id: `meaning-${nextWord.id}`,
            text: nextWord.translation,
            matchId: nextWord.id,
            type: 'meaning',
            isSelected: false,
            isMatched: false,
            isFading: false,
            opacity: new Animated.Value(0),
        };

        // Fade out old cards
        const oldCards = visibleCards.filter(c => c.matchId === matchIdToReplace);
        Animated.parallel(
            oldCards.map(c =>
                Animated.timing(c.opacity, { toValue: 0, duration: 400, useNativeDriver: true })
            )
        ).start(() => {
            // After fade out, replace data
            setVisibleCards(prev => {
                return prev.map(card => {
                    if (card.matchId === matchIdToReplace && card.type === 'word') return newWordCard;
                    if (card.matchId === matchIdToReplace && card.type === 'meaning') return newMeaningCard;
                    return card;
                });
            });

            // Fade in new cards
            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(newWordCard.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(newMeaningCard.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
                ]).start();
            }, 50);
        });
    };

    const handleCardPress = (card: MatchCard) => {
        if (card.isMatched || card.isFading) return;

        if (!selectedCard) {
            // First selection
            setSelectedCard(card);
            setVisibleCards(prev => prev.map(c =>
                c.id === card.id ? { ...c, isSelected: true } : c
            ));
        } else if (selectedCard.id === card.id) {
            // Deselect
            setSelectedCard(null);
            setVisibleCards(prev => prev.map(c =>
                c.id === card.id ? { ...c, isSelected: false } : c
            ));
        } else {
            // Second selection
            if (selectedCard.matchId === card.matchId && selectedCard.type !== card.type) {
                // CORRECT MATCH!
                const newScore = score + 1;
                setScore(prev => prev + 1);
                setCompletedMatches(prev => prev + 1);
                setSelectedCard(null);
                onMatch(card.matchId, true);

                // Update cards to matched state
                setVisibleCards(prev => prev.map(c =>
                    c.matchId === card.matchId
                        ? { ...c, isMatched: true, isSelected: false }
                        : c
                ));

                // Add to queue and manage refill
                setMatchedQueue(prevQueue => {
                    const newQueue = [...prevQueue, card.matchId];
                    if (newQueue.length >= 2) {
                        // We have 2 matches, time to remove the OLDEST one (index 0)
                        const oldestMatchId = newQueue[0];
                        // Trigger refill for the oldest match
                        triggerRefillFor(oldestMatchId);
                        // Return queue with oldest removed
                        return newQueue.slice(1);
                    }
                    return newQueue;
                });

            } else {
                // WRONG MATCH
                setMistakes(prev => prev + 1);
                onMatch(selectedCard.matchId, false);

                Animated.sequence([
                    Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
                ]).start();

                setTimeout(() => {
                    setVisibleCards(prev => prev.map(c => ({ ...c, isSelected: false })));
                    setSelectedCard(null);
                }, 300);
            }
        }
    };

    const wordCards = visibleCards.filter(c => c.type === 'word');
    const meaningCards = visibleCards.filter(c => c.type === 'meaning');
    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={matchingStyles.container}>
            {/* Game Grid */}
            <View style={matchingStyles.gameContainer}>
                <Animated.View style={[matchingStyles.column, { transform: [{ translateX: shakeAnim }] }]}>
                    <Text style={matchingStyles.columnTitle}>English</Text>
                    {wordCards.map(card => (
                        <Animated.View key={card.id} style={{ opacity: card.opacity }}>
                            <Pressable
                                style={[
                                    matchingStyles.card,
                                    card.isSelected && matchingStyles.cardSelected,
                                    card.isMatched && matchingStyles.cardMatched,
                                ]}
                                onPress={() => handleCardPress(card)}
                                disabled={card.isMatched || card.isFading}
                            >
                                <Text style={[
                                    matchingStyles.cardText,
                                    card.isMatched && matchingStyles.cardTextMatched,
                                ]}>
                                    {card.text}
                                </Text>
                            </Pressable>
                        </Animated.View>
                    ))}
                </Animated.View>

                <Animated.View style={[matchingStyles.column, { transform: [{ translateX: shakeAnim }] }]}>
                    <Text style={matchingStyles.columnTitle}>
                        {showTranslation ? 'Русский' : 'Definition'}
                    </Text>
                    {meaningCards.map(card => (
                        <Animated.View key={card.id} style={{ opacity: card.opacity }}>
                            <Pressable
                                style={[
                                    matchingStyles.card,
                                    card.isSelected && matchingStyles.cardSelected,
                                    card.isMatched && matchingStyles.cardMatched,
                                ]}
                                onPress={() => handleCardPress(card)}
                                disabled={card.isMatched || card.isFading}
                            >
                                <Text style={[
                                    matchingStyles.cardText,
                                    matchingStyles.meaningText,
                                    card.isMatched && matchingStyles.cardTextMatched,
                                ]} numberOfLines={3}>
                                    {card.text}
                                </Text>
                            </Pressable>
                        </Animated.View>
                    ))}
                </Animated.View>
            </View>

            {/* Progress Bar at bottom */}
            {showProgressBar && (
                <View style={matchingStyles.progressContainer}>
                    <View style={matchingStyles.progressTrack}>
                        <Animated.View style={[matchingStyles.progressBar, { width: progressWidth }]} />
                    </View>
                    <Text style={matchingStyles.progressText}>
                        {completedMatches}/{totalMatches}
                    </Text>
                </View>
            )}
        </View>
    );
}

const matchingStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gameContainer: {
        flex: 1,
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        gap: spacing.md,
    },
    column: {
        flex: 1,
        gap: spacing.sm,
    },
    columnTitle: {
        ...typography.caption,
        color: colors.text.tertiary,
        textAlign: 'center',
        textTransform: 'uppercase',
        marginBottom: spacing.xs,
        letterSpacing: 1,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        height: 60, // Fixed height for uniformity
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.border.light,
        borderBottomWidth: 4,
        borderBottomColor: colors.border.medium,
    },
    // GREEN BORDER ONLY when selected (not filled)
    cardSelected: {
        borderColor: colors.accent.green,
        borderWidth: 3,
        borderBottomWidth: 5,
        borderBottomColor: colors.accent.green,
    },
    cardMatched: {
        backgroundColor: `${colors.accent.green}20`,
        borderColor: colors.accent.green,
        opacity: 0.8,
    },
    cardText: {
        ...typography.bodySmall,
        color: colors.text.primary,
        textAlign: 'center',
        fontWeight: '600',
    },
    meaningText: {
        fontSize: 13,
    },
    cardTextMatched: {
        color: colors.accent.green,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
        gap: spacing.md,
    },
    progressTrack: {
        flex: 1,
        height: 8,
        backgroundColor: colors.surfaceElevated,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primary[300],
        borderRadius: 4,
    },
    progressText: {
        ...typography.caption,
        color: colors.text.secondary,
        fontWeight: '700',
        minWidth: 40,
        textAlign: 'right',
    },
});

// Legacy styles export for backward compatibility
export const matchingCardStyles = matchingStyles;

// ============= COMPLETION SCREEN =============

export interface CompletionScreenProps {
    score: number;
    total: number;
    xpEarned: number;
    onRestart: () => void;
    onHome: () => void;
    title?: string;
    message?: string;
    newWordsCount?: number;
}

export function CompletionScreen({
    score,
    total,
    xpEarned,
    onRestart,
    onHome,
    title = 'Урок завершён!',
    message,
    newWordsCount = 0
}: CompletionScreenProps) {
    const percentage = total > 0 ? Math.round((score / total) * 100) : 100;

    // Determine emoji and color based on score
    let emoji = '🎉';
    let color = colors.accent.green;
    let defaultMsg = 'Отлично! Вы справились!';

    if (percentage < 50) {
        emoji = '📝';
        color = colors.accent.amber;
        defaultMsg = 'Хорошая попытка! Продолжайте практиковаться.';
    } else if (percentage < 80) {
        emoji = '👍';
        color = colors.primary[300];
        defaultMsg = 'Хорошая работа!';
    }

    return (
        <View style={completionStyles.container}>
            <View style={completionStyles.card}>
                <Text style={completionStyles.emoji}>{emoji}</Text>
                <Text style={completionStyles.title}>{title}</Text>

                <Text style={[completionStyles.score, { color }]}>
                    {score}/{total} правильно ({percentage}%)
                </Text>

                <View style={completionStyles.xpBadge}>
                    <Text style={completionStyles.xpText}>+{xpEarned} XP</Text>
                </View>

                {newWordsCount > 0 && (
                    <Text style={completionStyles.newWords}>
                        📚 +{newWordsCount} новых слов в словаре
                    </Text>
                )}

                <Text style={completionStyles.message}>
                    {message || defaultMsg}
                </Text>

                <View style={completionStyles.buttons}>
                    <VolumetricButton
                        title="Ещё раз"
                        onPress={onRestart}
                        variant={percentage >= 50 ? 'success' : 'primary'}
                    />
                    <View style={{ height: spacing.md }} />
                    <VolumetricButton
                        title="На главную"
                        onPress={onHome}
                        variant="amber"
                    />
                </View>
            </View>
        </View>
    );
}

const completionStyles = StyleSheet.create({
    container: {
        flex: 1,
        padding: spacing.lg,
        justifyContent: 'center',
        backgroundColor: colors.background,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xxl,
        padding: spacing.xxl,
        alignItems: 'center',
    },
    emoji: {
        fontSize: 64,
        marginBottom: spacing.md,
    },
    title: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    score: {
        ...typography.h3,
        marginBottom: spacing.lg,
        fontWeight: '800',
    },
    xpBadge: {
        backgroundColor: colors.accent.amber,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        marginBottom: spacing.lg,
    },
    xpText: {
        ...typography.h3,
        color: colors.text.inverse,
    },
    newWords: {
        ...typography.bodyBold,
        color: colors.primary[300],
        marginBottom: spacing.md,
    },
    message: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 24,
    },
    buttons: {
        width: '100%',
    }
});

// ============= ERROR FEEDBACK PLATE =============

export interface ErrorFeedbackPlateProps {
    original?: string;
    correction?: string;
    explanation?: string;
    grammarPattern?: string;
    onSave?: () => void;
    isSaved?: boolean;
}

export function ErrorFeedbackPlate({
    original,
    correction,
    explanation,
    grammarPattern,
    onSave,
    isSaved
}: ErrorFeedbackPlateProps) {
    if (!correction) return null;

    return (
        <View style={errorPlateStyles.container}>
            <View style={errorPlateStyles.header}>
                <Text style={errorPlateStyles.icon}>⚠️</Text>
                <Text style={errorPlateStyles.title}>Работа над ошибками</Text>
            </View>

            <View style={errorPlateStyles.content}>
                {original && (
                    <View style={errorPlateStyles.row}>
                        <Text style={errorPlateStyles.label}>Вы написали:</Text>
                        <Text style={[errorPlateStyles.text, errorPlateStyles.strike]}>{original}</Text>
                    </View>
                )}

                <View style={errorPlateStyles.row}>
                    <Text style={errorPlateStyles.label}>Лучше сказать:</Text>
                    <Text style={[errorPlateStyles.text, errorPlateStyles.correct]}>{correction}</Text>
                </View>

                {(explanation || grammarPattern) && (
                    <View style={errorPlateStyles.infoBox}>
                        {grammarPattern && (
                            <Text style={errorPlateStyles.pattern}>{grammarPattern}</Text>
                        )}
                        {explanation && (
                            <Text style={errorPlateStyles.explanation}>{explanation}</Text>
                        )}
                    </View>
                )}

                {onSave && (
                    <Pressable
                        style={[errorPlateStyles.saveButton, isSaved && errorPlateStyles.savedButton]}
                        onPress={onSave}
                        disabled={isSaved}
                    >
                        <Text style={[errorPlateStyles.saveText, isSaved && errorPlateStyles.savedText]}>
                            {isSaved ? '✓ Сохранено в словарь' : '+ Сохранить правило'}
                        </Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

const errorPlateStyles = StyleSheet.create({
    container: {
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        marginTop: spacing.sm,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.accent.amber,
        backgroundColor: `${colors.accent.amber}10`, // Light yellow background
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: `${colors.accent.amber}15`,
        gap: spacing.sm,
    },
    icon: {
        fontSize: 18,
    },
    title: {
        ...typography.bodyBold,
        color: colors.accent.amber,
    },
    content: {
        padding: spacing.md,
        gap: spacing.md,
    },
    row: {
        gap: spacing.xs,
    },
    label: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    text: {
        ...typography.body,
        color: colors.text.primary,
    },
    strike: {
        textDecorationLine: 'line-through',
        color: colors.accent.red,
        opacity: 0.8,
    },
    correct: {
        color: colors.accent.green,
        fontWeight: '500',
    },
    infoBox: {
        backgroundColor: colors.surfaceElevated,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    pattern: {
        ...typography.bodySmall,
        fontWeight: 'bold',
        color: colors.primary[300],
    },
    explanation: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    saveButton: {
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        marginTop: spacing.xs,
        backgroundColor: `${colors.primary[300]}10`,
        borderRadius: borderRadius.full,
    },
    savedButton: {
        backgroundColor: 'transparent',
    },
    saveText: {
        ...typography.caption,
        fontWeight: 'bold',
        color: colors.primary[300],
    },
    savedText: {
        color: colors.accent.green,
    },
});

// ============= UNIFIED FEEDBACK MODAL =============

interface UnifiedFeedbackModalProps {
    visible: boolean;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    primaryAction?: {
        label: string;
        onPress: () => void;
    };
    secondaryAction?: {
        label: string;
        onPress: () => void;
    };
    onClose: () => void;
}

export function UnifiedFeedbackModal({
    visible,
    type,
    title,
    message,
    primaryAction,
    secondaryAction,
    onClose
}: UnifiedFeedbackModalProps) {
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            scaleAnim.setValue(0);
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 60,
                friction: 7,
                useNativeDriver: true
            }).start();
        }
    }, [visible]);

    if (!visible) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return '🎉';
            case 'error': return '⚠️';
            case 'warning': return '⚡';
            default: return 'ℹ️';
        }
    };

    const getColor = () => {
        switch (type) {
            case 'success': return colors.accent.green;
            case 'error': return colors.accent.red;
            case 'warning': return colors.accent.amber;
            default: return colors.primary[300];
        }
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <Pressable style={feedbackStyles.overlay} onPress={onClose}>
                <Pressable onPress={e => e.stopPropagation()}>
                    <Animated.View style={[
                        feedbackStyles.container,
                        { transform: [{ scale: scaleAnim }] }
                    ]}>
                        <View style={[feedbackStyles.iconContainer, { backgroundColor: `${getColor()}20` }]}>
                            <Text style={feedbackStyles.icon}>{getIcon()}</Text>
                        </View>

                        <Text style={feedbackStyles.title}>{title}</Text>
                        <Text style={feedbackStyles.message}>{message}</Text>

                        <View style={feedbackStyles.actions}>
                            {secondaryAction && (
                                <Pressable
                                    style={[feedbackStyles.button, feedbackStyles.secondaryButton]}
                                    onPress={secondaryAction.onPress}
                                >
                                    <Text style={feedbackStyles.secondaryButtonText}>{secondaryAction.label}</Text>
                                </Pressable>
                            )}
                            <Pressable
                                style={[feedbackStyles.button, feedbackStyles.primaryButton, { backgroundColor: getColor() }]}
                                onPress={primaryAction ? primaryAction.onPress : onClose}
                            >
                                <Text style={feedbackStyles.primaryButtonText}>
                                    {primaryAction ? primaryAction.label : 'OK'}
                                </Text>
                            </Pressable>
                        </View>
                    </Animated.View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const feedbackStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    container: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    icon: {
        fontSize: 32,
    },
    title: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    message: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
    button: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButton: {
        backgroundColor: colors.surfaceElevated,
    },
    primaryButton: {
        // bg color set dynamically
    },
    secondaryButtonText: {
        ...typography.bodyBold,
        color: colors.text.primary,
    },
    primaryButtonText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
    },
});
