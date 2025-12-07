/**
 * Shared UI Components - Consistent styling across the app
 */
import { StyleSheet, Text, View, Pressable, Animated, Modal, ViewStyle, ScrollView, ActivityIndicator } from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { useSpeech } from '@/hooks/useSpeech';
import { VButton, VInput } from './DesignSystem';

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
    children?: React.ReactNode;
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
    children,
}: WordInfoModalProps) {
    const { speak, stop, isSpeaking } = useSpeech();

    const handleSpeak = () => {
        if (isSpeaking) {
            stop();
        } else {
            speak(word);
        }
    };

    const handleClose = () => {
        stop();
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

                    {/* Custom Children (Stats, Buttons, etc) */}
                    {children}

                    {/* Close button (only if no children, or maybe always? typically children handle actions) */}
                    {!children && (
                        <Pressable style={wordStyles.closeButton} onPress={handleClose}>
                            <Text style={wordStyles.closeText}>Закрыть</Text>
                        </Pressable>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ============ SCREEN CONTAINER ============

interface ScreenContainerProps {
    children: React.ReactNode;
    style?: ViewStyle;
    padding?: boolean;
}

export function ScreenContainer({ children, style, padding = false }: ScreenContainerProps) {
    return (
        <View style={[
            { flex: 1, backgroundColor: colors.background },
            padding && { padding: spacing.lg },
            style
        ]}>
            {children}
        </View>
    );
}
// ============= EMPTY STATE =============

interface EmptyStateProps {
    icon?: string;
    title?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({ icon = '📭', title, message, actionLabel, onAction }: EmptyStateProps) {
    return (
        <View style={emptyStyles.container}>
            <Text style={emptyStyles.icon}>{icon}</Text>
            {title && <Text style={emptyStyles.title}>{title}</Text>}
            <Text style={emptyStyles.text}>{message}</Text>
            {actionLabel && onAction && (
                <View style={emptyStyles.buttonContainer}>
                    <VButton title={actionLabel} onPress={onAction} />
                </View>
            )}
        </View>
    );
}

const emptyStyles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xxxl,
    },
    title: {
        ...typography.h3,
        color: colors.text.primary,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    icon: {
        fontSize: 48,
        marginBottom: spacing.lg,
    },
    text: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    buttonContainer: {
        minWidth: 200,
    },
});

// ============= INPUT MODAL =============

interface InputModalProps {
    visible: boolean;
    title: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
    multiline?: boolean;
    numberOfLines?: number;
}

export function InputModal({
    visible,
    title,
    value,
    onChangeText,
    placeholder,
    confirmLabel = 'OK',
    onConfirm,
    onCancel,
    loading,
    multiline,
    numberOfLines,
}: InputModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Pressable style={wordStyles.overlay} onPress={onCancel}>
                <Pressable style={wordStyles.modal} onPress={e => e.stopPropagation()}>
                    <Text style={[wordStyles.word, { textAlign: 'center', marginBottom: spacing.lg }]}>
                        {title}
                    </Text>

                    <View style={{ marginBottom: spacing.lg }}>
                        <VInput
                            value={value}
                            onChangeText={onChangeText}
                            placeholder={placeholder}
                            autoFocus
                            multiline={multiline}
                            numberOfLines={numberOfLines}
                            style={multiline ? { minHeight: 100, textAlignVertical: 'top' } : undefined}
                        />
                    </View>

                    <View style={{ gap: spacing.sm }}>
                        <VButton
                            title={confirmLabel}
                            onPress={onConfirm}
                            loading={loading}
                            fullWidth
                        />
                        <VButton
                            title="Отмена"
                            onPress={onCancel}
                            variant="ghost"
                            fullWidth
                            disabled={loading}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ============= LOADING OVERLAY =============

interface LoadingOverlayProps {
    visible: boolean;
    text?: string;
    subtext?: string;
}

export function LoadingOverlay({ visible, text = 'Загрузка...', subtext }: LoadingOverlayProps) {
    if (!visible) return null;

    return (
        <View style={loadingStyles.overlay}>
            <View style={loadingStyles.container}>
                <ActivityIndicator size="large" color={colors.primary[300]} />
                <Text style={loadingStyles.text}>{text}</Text>
                {subtext && <Text style={loadingStyles.subtext}>{subtext}</Text>}
            </View>
        </View>
    );
}

const loadingStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.background,
        zIndex: 2000,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.lg,
    },
    text: {
        ...typography.h3,
        color: colors.text.primary,
        marginTop: spacing.md,
        textAlign: 'center',
    },
    subtext: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
    }
});

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



// ============= LOADING INDICATOR =============

interface LoadingIndicatorProps {
    text?: string;
}

export function LoadingIndicator({ text = 'Загрузка...' }: LoadingIndicatorProps) {
    return (
        <View style={loadingStyles.container}>
            <ActivityIndicator size="small" color={colors.primary[300]} />
            <Text style={loadingStyles.text}>{text}</Text>
        </View>
    );
}



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
    const widthAnim = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={matchingStyles.container}>
            {/* Game Grid */}
            <Animated.View style={[matchingStyles.gameContainer, { transform: [{ translateX: shakeAnim }] }]}>
                <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
                    {/* Header Row */}
                    <View style={matchingStyles.headerRow}>
                        <Text style={[matchingStyles.columnTitle, { flex: 1 }]}>English</Text>
                        <Text style={[matchingStyles.columnTitle, { flex: 1 }]}>
                            {showTranslation ? 'Русский' : 'Definition'}
                        </Text>
                    </View>

                    {/* Card Rows */}
                    {wordCards.map((wordCard, index) => {
                        const meaningCard = meaningCards[index];
                        return (
                            <View key={`row-${wordCard.id}`} style={matchingStyles.cardRow}>
                                {/* Left Card (Word) */}
                                <Animated.View style={{ flex: 1, opacity: wordCard.opacity }}>
                                    <Pressable
                                        style={[
                                            matchingStyles.card,
                                            wordCard.isSelected && matchingStyles.cardSelected,
                                            wordCard.isMatched && matchingStyles.cardMatched,
                                        ]}
                                        onPress={() => handleCardPress(wordCard)}
                                        disabled={wordCard.isMatched || wordCard.isFading}
                                    >
                                        <Text style={[
                                            matchingStyles.cardText,
                                            wordCard.isMatched && matchingStyles.cardTextMatched,
                                        ]}>
                                            {wordCard.text}
                                        </Text>
                                    </Pressable>
                                </Animated.View>

                                {/* Spacer */}
                                <View style={{ width: spacing.md }} />

                                {/* Right Card (Meaning) */}
                                {meaningCard && (
                                    <Animated.View style={{ flex: 1, opacity: meaningCard.opacity }}>
                                        <Pressable
                                            style={[
                                                matchingStyles.card,
                                                meaningCard.isSelected && matchingStyles.cardSelected,
                                                meaningCard.isMatched && matchingStyles.cardMatched,
                                            ]}
                                            onPress={() => handleCardPress(meaningCard)}
                                            disabled={meaningCard.isMatched || meaningCard.isFading}
                                        >
                                            <Text style={[
                                                matchingStyles.cardText,
                                                matchingStyles.meaningText,
                                                meaningCard.isMatched && matchingStyles.cardTextMatched,
                                            ]} numberOfLines={3}>
                                                {meaningCard.text}
                                            </Text>
                                        </Pressable>
                                    </Animated.View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            </Animated.View>

            {/* Progress Bar at bottom */}
            {showProgressBar && (
                <View style={matchingStyles.progressContainer}>
                    <View style={matchingStyles.progressTrack}>
                        <Animated.View style={[matchingStyles.progressBar, { width: widthAnim }]} />
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
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
    },
    headerRow: {
        flexDirection: 'row',
        marginBottom: spacing.xs,
        gap: spacing.md,
    },
    cardRow: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
        alignItems: 'stretch', // Ensures equal height
    },
    columnTitle: {
        ...typography.caption,
        color: colors.text.tertiary,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        minHeight: 60, // Minimum height, but allows growth
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.border.light,
        borderBottomWidth: 4,
        borderBottomColor: colors.border.medium,
        width: '100%',
        flex: 1, // Grow to fill container height
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
                    <VButton
                        title="Ещё раз"
                        onPress={onRestart}
                        variant={percentage >= 50 ? 'success' : 'primary'}
                    />
                    <View style={{ height: spacing.md }} />
                    <VButton
                        title="На главную"
                        onPress={onHome}
                        variant='secondary'
                        style={completionStyles.Bottom0}
                    />
                </View>
            </View>
        </View>
    );
}

const completionStyles = StyleSheet.create({
    Bottom0: {
        borderBottomWidth: 0,
    },
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
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    pattern: {
        ...typography.caption,
        color: colors.primary[700],
        fontWeight: 'bold',
    },
    explanation: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    saveButton: {
        backgroundColor: colors.accent.amber,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    savedButton: {
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border.medium,
    },
    saveText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
        fontSize: 14,
    },
    savedText: {
        color: colors.text.secondary,
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
    autoFocus?: boolean;
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
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={feedbackModalStyles.overlay}>
                <View style={feedbackModalStyles.modal}>
                    <View style={[feedbackModalStyles.iconContainer, { backgroundColor: type === 'error' ? `${colors.accent.red}20` : type === 'success' ? `${colors.accent.green}20` : type === 'warning' ? `${colors.accent.amber}20` : `${colors.primary[300]}20` }]}>
                        <Text style={feedbackModalStyles.icon}>
                            {type === 'error' ? '❌' : type === 'success' ? '🎉' : type === 'warning' ? '⚠️' : 'ℹ️'}
                        </Text>
                    </View>

                    <Text style={feedbackModalStyles.title}>{title}</Text>
                    <Text style={feedbackModalStyles.message}>{message}</Text>

                    <View style={feedbackModalStyles.actions}>
                        {primaryAction && (
                            <VButton
                                title={primaryAction.label}
                                onPress={primaryAction.onPress}
                                variant={type === 'error' ? 'primary' : type === 'success' ? 'success' : 'primary'}
                                fullWidth
                            />
                        )}
                        {secondaryAction && (
                            <View style={{ marginTop: spacing.sm, width: '100%' }}>
                                <VButton
                                    title={secondaryAction.label}
                                    onPress={secondaryAction.onPress}
                                    variant="secondary"
                                    fullWidth
                                />
                            </View>
                        )}
                        {!primaryAction && !secondaryAction && (
                            <VButton
                                title="Закрыть"
                                onPress={onClose}
                                variant="secondary"
                                fullWidth
                            />
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const feedbackModalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modal: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    icon: {
        fontSize: 32,
    },
    title: {
        ...typography.h2,
        textAlign: 'center',
        marginBottom: spacing.sm,
        color: colors.text.primary,
    },
    message: {
        ...typography.body,
        textAlign: 'center',
        color: colors.text.secondary,
        marginBottom: spacing.xl,
    },
    actions: {
        width: '100%',
        gap: spacing.sm,
    },
});

// Helper for API Key Errors
export const getApiKeyErrorConfig = (navigation: any, onClose: () => void) => ({
    visible: true,
    type: 'warning' as const,
    title: 'Ошибка ключа API',
    message: 'Не удалось подключиться к AI. Проверьте настройки API ключей.',
    primaryAction: {
        label: 'Настройки',
        onPress: () => {
            onClose();
            navigation.navigate('Settings' as never);
        }
    }
});
