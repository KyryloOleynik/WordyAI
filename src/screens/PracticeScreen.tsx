import { StyleSheet, Text, View, Pressable, Animated, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import Card from '@/components/ui/Card';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { useLocalLLM } from '@/hooks/useLocalLLM';
import { ModelDownloadIndicator } from '@/components/ui/ModelDownloadIndicator';
import { XP_REWARDS } from '@/services/storageService';

interface PracticeCard {
    id: string;
    word: string;
    sentence: string;
    definition: string;
    example: string;
    cefrLevel: string;
}

// Mock words from dictionary - will be replaced with actual DB query
const mockDictionaryWords = [
    { id: '1', word: 'serendipity', cefrLevel: 'C1' },
    { id: '2', word: 'ephemeral', cefrLevel: 'C2' },
    { id: '3', word: 'ubiquitous', cefrLevel: 'C1' },
    { id: '4', word: 'ambiguous', cefrLevel: 'B2' },
];

export default function PracticeScreen() {
    const navigation = useNavigation<any>();
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const flipAnim = useRef(new Animated.Value(0)).current;

    const { isReady, downloadProgress, generateContent } = useLocalLLM();
    const [practiceCards, setPracticeCards] = useState<PracticeCard[]>([]);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [sessionXP, setSessionXP] = useState(0);
    const [results, setResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        if (isReady && practiceCards.length === 0) {
            loadCards();
        }
    }, [isReady]);

    const loadCards = async () => {
        setIsLoadingContent(true);
        const newCards: PracticeCard[] = [];

        // Get words from dictionary (mock for now)
        for (const wordData of mockDictionaryWords) {
            const content = await generateContent(wordData.word);
            if (content) {
                newCards.push({
                    id: wordData.id,
                    word: wordData.word,
                    sentence: content.example_sentence.replace(content.missing_word, '____'),
                    definition: content.definition,
                    example: content.example_sentence,
                    cefrLevel: wordData.cefrLevel,
                });
            }
        }
        setPracticeCards(newCards);
        setIsLoadingContent(false);
    };

    const currentCard = practiceCards[currentCardIndex];

    const handleFlip = () => {
        Animated.timing(flipAnim, {
            toValue: isFlipped ? 0 : 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
        setIsFlipped(!isFlipped);
    };

    const handleResponse = (grade: 1 | 2 | 3 | 4) => {
        // Calculate XP based on response
        let xpGained = 0;
        if (grade >= 3) {
            xpGained = grade === 4 ? XP_REWARDS.WORD_EASY : XP_REWARDS.WORD_CORRECT;
            setResults(prev => ({ ...prev, correct: prev.correct + 1 }));
        }
        setSessionXP(prev => prev + xpGained);
        setResults(prev => ({ ...prev, total: prev.total + 1 }));

        // TODO: Update SRS in database
        // dictionaryService.processReview(currentCard.id, grade);

        if (currentCardIndex < practiceCards.length - 1) {
            setCurrentCardIndex(currentCardIndex + 1);
            setIsFlipped(false);
            flipAnim.setValue(0);
        } else {
            setShowResults(true);
        }
    };

    const frontRotation = flipAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    const backRotation = flipAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['180deg', '360deg'],
    });

    if (!isReady || practiceCards.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ModelDownloadIndicator
                    visible={!!downloadProgress}
                    progress={downloadProgress?.progress || 0}
                    text={downloadProgress?.text || 'Initializing...'}
                />
                {!downloadProgress && (
                    <>
                        <ActivityIndicator size="large" color={colors.primary[300]} />
                        <Text style={styles.loadingText}>
                            {isLoadingContent ? "Generating practice cards..." : "Loading AI..."}
                        </Text>
                    </>
                )}
            </View>
        );
    }

    if (showResults) {
        const percentage = Math.round((results.correct / results.total) * 100);
        return (
            <View style={styles.container}>
                <View style={styles.resultsContainer}>
                    <Card elevated style={styles.resultsCard}>
                        <Text style={styles.resultsEmoji}>
                            {percentage >= 80 ? '🎉' : percentage >= 50 ? '👍' : '💪'}
                        </Text>
                        <Text style={styles.resultsTitle}>Practice Complete!</Text>
                        <Text style={styles.resultsScore}>
                            {results.correct}/{results.total} correct
                        </Text>

                        <View style={styles.xpBadge}>
                            <Text style={styles.xpBadgeText}>+{sessionXP} XP</Text>
                        </View>

                        <View style={styles.resultsButtons}>
                            <Pressable
                                style={styles.continueButton}
                                onPress={() => {
                                    setCurrentCardIndex(0);
                                    setShowResults(false);
                                    setSessionXP(0);
                                    setResults({ correct: 0, total: 0 });
                                    loadCards();
                                }}
                            >
                                <Text style={styles.continueButtonText}>Practice Again</Text>
                            </Pressable>
                            <Pressable
                                style={styles.homeButton}
                                onPress={() => navigation.goBack()}
                            >
                                <Text style={styles.homeButtonText}>Done</Text>
                            </Pressable>
                        </View>
                    </Card>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header with progress */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.progress}>
                        {currentCardIndex + 1} / {practiceCards.length}
                    </Text>
                    <View style={styles.xpDisplay}>
                        <Text style={styles.xpText}>+{sessionXP} XP</Text>
                    </View>
                </View>
                <View style={styles.progressBar}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${((currentCardIndex + 1) / practiceCards.length) * 100}%` },
                        ]}
                    />
                </View>
            </View>

            {/* Flashcard */}
            <View style={styles.cardContainer}>
                <Pressable onPress={handleFlip} style={styles.cardPressable}>
                    {/* Front of card */}
                    <Animated.View
                        style={[
                            styles.card,
                            { transform: [{ rotateY: frontRotation }], opacity: isFlipped ? 0 : 1 },
                        ]}
                    >
                        <Card elevated style={styles.cardContent}>
                            <View style={styles.levelBadge}>
                                <Text style={styles.levelText}>{currentCard.cefrLevel}</Text>
                            </View>
                            <Text style={styles.cardLabel}>Fill in the blank</Text>
                            <Text style={styles.sentence}>{currentCard.sentence}</Text>
                            <Text style={styles.tapHint}>Tap to reveal</Text>
                        </Card>
                    </Animated.View>

                    {/* Back of card */}
                    <Animated.View
                        style={[
                            styles.card,
                            styles.cardBack,
                            { transform: [{ rotateY: backRotation }], opacity: isFlipped ? 1 : 0 },
                        ]}
                    >
                        <Card elevated style={styles.cardContent}>
                            <Text style={styles.word}>{currentCard.word}</Text>
                            <Text style={styles.definition}>{currentCard.definition}</Text>
                            <View style={styles.exampleContainer}>
                                <Text style={styles.exampleLabel}>Example:</Text>
                                <Text style={styles.example}>{currentCard.example}</Text>
                            </View>
                        </Card>
                    </Animated.View>
                </Pressable>
            </View>

            {/* Response Buttons - Duolingo style */}
            {isFlipped && (
                <View style={styles.buttonsContainer}>
                    <Text style={styles.buttonsLabel}>How well did you know this?</Text>
                    <View style={styles.buttonsRow}>
                        <Pressable
                            style={[styles.responseButton, styles.againButton]}
                            onPress={() => handleResponse(1)}
                        >
                            <Text style={styles.responseEmoji}>😓</Text>
                            <Text style={styles.responseButtonText}>Again</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.responseButton, styles.hardButton]}
                            onPress={() => handleResponse(2)}
                        >
                            <Text style={styles.responseEmoji}>🤔</Text>
                            <Text style={styles.responseButtonText}>Hard</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.responseButton, styles.goodButton]}
                            onPress={() => handleResponse(3)}
                        >
                            <Text style={styles.responseEmoji}>😊</Text>
                            <Text style={styles.responseButtonText}>Good</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.responseButton, styles.easyButton]}
                            onPress={() => handleResponse(4)}
                        >
                            <Text style={styles.responseEmoji}>🎯</Text>
                            <Text style={styles.responseButtonText}>Easy</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.text.secondary,
        ...typography.body,
    },
    header: {
        padding: spacing.lg,
        backgroundColor: colors.surface,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    progress: {
        ...typography.bodyBold,
        color: colors.text.primary,
    },
    xpDisplay: {
        backgroundColor: `${colors.accent.amber}20`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    xpText: {
        ...typography.bodySmall,
        color: colors.accent.amber,
        fontWeight: '700',
    },
    progressBar: {
        height: 8,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.full,
    },
    cardContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    cardPressable: {
        width: '100%',
        height: 400,
    },
    card: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backfaceVisibility: 'hidden',
    },
    cardBack: {
        position: 'absolute',
    },
    cardContent: {
        flex: 1,
        padding: spacing.xl,
        justifyContent: 'center',
        alignItems: 'center',
    },
    levelBadge: {
        position: 'absolute',
        top: spacing.lg,
        right: spacing.lg,
        backgroundColor: colors.cefr.B1,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    levelText: {
        ...typography.caption,
        color: colors.text.inverse,
        fontWeight: '700',
    },
    cardLabel: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        marginBottom: spacing.xl,
    },
    sentence: {
        ...typography.h2,
        color: colors.text.primary,
        textAlign: 'center',
        lineHeight: 36,
    },
    tapHint: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginTop: spacing.xxl,
    },
    word: {
        ...typography.h1,
        color: colors.primary[300],
        marginBottom: spacing.md,
    },
    definition: {
        ...typography.body,
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    exampleContainer: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        width: '100%',
    },
    exampleLabel: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginBottom: spacing.xs,
    },
    example: {
        ...typography.body,
        color: colors.text.secondary,
    },
    buttonsContainer: {
        padding: spacing.lg,
        backgroundColor: colors.surface,
    },
    buttonsLabel: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    responseButton: {
        flex: 1,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        alignItems: 'center',
    },
    againButton: {
        backgroundColor: colors.accent.red,
    },
    hardButton: {
        backgroundColor: colors.accent.amber,
    },
    goodButton: {
        backgroundColor: colors.accent.blue,
    },
    easyButton: {
        backgroundColor: colors.accent.green,
    },
    responseEmoji: {
        fontSize: 24,
        marginBottom: spacing.xs,
    },
    responseButtonText: {
        color: colors.text.inverse,
        ...typography.caption,
        fontWeight: '700',
    },
    resultsContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.xl,
    },
    resultsCard: {
        padding: spacing.xxxl,
        alignItems: 'center',
    },
    resultsEmoji: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    resultsTitle: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    resultsScore: {
        ...typography.body,
        color: colors.text.secondary,
        marginBottom: spacing.xl,
    },
    xpBadge: {
        backgroundColor: `${colors.accent.amber}20`,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        marginBottom: spacing.xxl,
    },
    xpBadgeText: {
        ...typography.h3,
        color: colors.accent.amber,
    },
    resultsButtons: {
        width: '100%',
        gap: spacing.md,
    },
    continueButton: {
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
    },
    continueButtonText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
    },
    homeButton: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
    },
    homeButtonText: {
        ...typography.bodyBold,
        color: colors.text.secondary,
    },
});
