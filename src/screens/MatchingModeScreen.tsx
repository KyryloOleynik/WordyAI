import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Animated, ActivityIndicator, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { getAllWords, getSettings, addXP, DictionaryWord, UserSettings, updateWordMetrics, XP_REWARDS } from '@/services/storageService';
import { unifiedAI } from '@/services/unifiedAIManager';
import { MatchingGame, CompletionScreen } from '@/components/ui/SharedComponents';

// Difficulty settings - progressive matches per round
const DIFFICULTY_LEVELS = [
    { totalMatches: 10, visiblePairs: 5, name: 'Легко' },
    { totalMatches: 15, visiblePairs: 6, name: 'Средне' },
    { totalMatches: 20, visiblePairs: 7, name: 'Сложно' },
];

export default function MatchingModeScreen() {
    const navigation = useNavigation<any>();
    const [wordPool, setWordPool] = useState<DictionaryWord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showTranslation, setShowTranslation] = useState(true);
    const [score, setScore] = useState(0); // Cumulative score across rounds
    const [mistakes, setMistakes] = useState(0); // Cumulative mistakes
    const [isComplete, setIsComplete] = useState(false);
    const [currentRound, setCurrentRound] = useState(0);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [completedMatchesInRound, setCompletedMatchesInRound] = useState(0);

    const progressAnim = useRef(new Animated.Value(0)).current;

    // Memoize the words passed to MatchingGame to prevent re-initialization on every render
    const matchingWords = React.useMemo(() => {
        return wordPool.map(w => ({
            id: w.id,
            text: w.text,
            translation: w.translation
        }));
    }, [wordPool]);

    const totalRounds = DIFFICULTY_LEVELS.length;
    const currentLevel = DIFFICULTY_LEVELS[currentRound] || DIFFICULTY_LEVELS[0];
    const [actualTotalMatches, setActualTotalMatches] = useState(currentLevel.totalMatches);

    // Load initial game
    useEffect(() => {
        loadGame();
    }, [currentRound]);

    // Animate progress bar (using local state to drive it)
    useEffect(() => {
        const progress = actualTotalMatches > 0 ? completedMatchesInRound / actualTotalMatches : 0;
        Animated.spring(progressAnim, {
            toValue: progress,
            tension: 50,
            friction: 10,
            useNativeDriver: false,
        }).start();
    }, [completedMatchesInRound, actualTotalMatches]);

    const generateAIWords = async (count: number, level: string): Promise<DictionaryWord[]> => {
        try {
            const prompt = `Generate ${count} random English words appropriate for CEFR level ${level} learner.
Each word should have its Russian translation.
Output JSON array only: [{"word": "...", "translation": "..."}]`;

            const response = await unifiedAI.generateText(prompt, { jsonMode: true });
            if (response.success) {
                const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                const aiWords = JSON.parse(cleaned);
                return aiWords.map((w: any, i: number) => ({
                    id: `ai_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
                    text: w.word,
                    definition: w.word,
                    translation: w.translation,
                    cefrLevel: level,
                    status: 'new',
                    timesShown: 0,
                    timesCorrect: 0,
                    lastReviewedAt: null,
                    nextReviewAt: Date.now(),
                    source: 'lesson',
                    createdAt: Date.now(),
                } as DictionaryWord));
            }
        } catch (e: any) {
            if (e.name === 'ApiKeyError') {
                console.warn('AI Unavailable:', e.message);
            } else {
                console.warn('Failed to generate AI words:', e);
            }
        }
        return [];
    };

    const loadGame = async () => {
        setIsLoading(true);
        setCompletedMatchesInRound(0); // Reset for new round (but keep global score)
        progressAnim.setValue(0);

        const [words, userSettings] = await Promise.all([getAllWords(), getSettings()]);
        setSettings(userSettings);
        setShowTranslation(userSettings.showTranslation);

        const level = userSettings.cefrLevel || 'B1';
        const totalNeeded = currentLevel.totalMatches + 5; // Extra buffer

        // Strict Deduplication Map
        const uniqueWords = new Map<string, DictionaryWord>();
        words.forEach(w => uniqueWords.set(w.text.toLowerCase().trim(), w));

        // Shuffle dictionary words and take some
        const shuffledDbWords = [...words].sort(() => Math.random() - 0.5);

        let pool: DictionaryWord[] = [];
        // Try to fill pool from DB first
        for (const w of shuffledDbWords) {
            if (pool.length >= totalNeeded) break;
            pool.push(w);
        }

        // Fill remaining with AI words
        if (pool.length < totalNeeded) {
            const aiNeeded = totalNeeded - pool.length + 3; // +3 buffer
            const aiWords = await generateAIWords(aiNeeded, level);

            // Aggressive normalization regex
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-zа-я0-9]/gi, '').trim();

            for (const w of aiWords) {
                const txt = normalize(w.text);
                if (!uniqueWords.has(txt)) {
                    uniqueWords.set(txt, w);
                    pool.push(w);
                }
            }
        }

        // Final shuffle
        const finalPool = pool.sort(() => Math.random() - 0.5);
        setWordPool(finalPool);

        // Adjust completion target if we couldn't find enough words
        // We need at least visiblePairs to start.
        // If pool is smaller than totalNeeded, max possibilities involves refilling.
        // Actually, the game logic consumes the pool. 
        // If pool.length < currentLevel.totalMatches, we can only do pool.length matches.

        // We have strict levels, but if AI fails/DB empty, we might have fewer.
        // Let's cap totalMatches at pool.length.
        setActualTotalMatches(Math.min(currentLevel.totalMatches, finalPool.length));

        setIsLoading(false);
    };

    const handleMatch = async (wordId: string, isCorrect: boolean) => {
        if (isCorrect) {
            setScore(s => s + 1); // Reduced from 10 to 1
            setCompletedMatchesInRound(p => p + 1);

            // Only add XP for correct matches
            await addXP(XP_REWARDS.WORD_CORRECT);

            if (!wordId.startsWith('ai_') && !wordId.startsWith('temp_')) {
                await updateWordMetrics(wordId, 'matching', true);
            }
        } else {
            setMistakes(m => m + 1);
            setScore(s => Math.max(0, s - 1)); // Reduced from 5 to 1
        }
    };

    const handleRoundComplete = () => {
        if (currentRound < totalRounds - 1) {
            // Next round
            setCurrentRound(prev => prev + 1);
        } else {
            // Game Complete
            setIsComplete(true);
            addXP(XP_REWARDS.EXERCISE_COMPLETE * 2); // Bonus for finishing all rounds
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary[300]} />
                    <Text style={styles.loadingText}>Подготовка уровня {currentLevel.name}...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (isComplete) {
        const totalPossibleMatches = DIFFICULTY_LEVELS.reduce((acc, level) => acc + level.totalMatches, 0);
        // Note: this total might be slightly off if some rounds had fewer words, 
        // but for the final screen it's an approximation or we could track totalPossible.
        // For now user requested "score relative to words provided".
        // Let's rely on 'score' which tracks correct matches. 
        // If valid words were fewer, max score is lower.

        return (
            <CompletionScreen
                score={score}
                // score={score}
                total={score + mistakes} // This ensures 100% if no mistakes.
                xpEarned={score}
                onRestart={() => {
                    setCurrentRound(0); // Reset to level 1
                    setScore(0);
                    setMistakes(0);
                    setIsComplete(false);
                }}
                onHome={() => navigation.goBack()}
                title="Игра завершена!"
                message={`Все уровни пройдены!\nОшибок: ${mistakes}`}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Соединение слов</Text>
                    <Text style={styles.headerSubtitle}>Уровень: {currentLevel.name}</Text>
                </View>
                <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>{score} XP</Text>
                </View>
            </View>



            {/* Shared Game Component */}
            <View style={{ flex: 1 }}>
                <MatchingGame
                    words={matchingWords}
                    totalMatches={actualTotalMatches}
                    visiblePairs={currentLevel.visiblePairs}
                    showTranslation={showTranslation}
                    showProgressBar={true} // Enable internal bottom progress bar
                    onMatch={handleMatch}
                    onComplete={handleRoundComplete}
                />
            </View>
        </SafeAreaView>
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
    },
    loadingText: {
        ...typography.body,
        color: colors.text.secondary,
        marginTop: spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        backgroundColor: colors.surface,
    },
    headerTitle: {
        ...typography.h3,
        color: colors.text.primary,
    },
    headerSubtitle: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    scoreContainer: {
        backgroundColor: `${colors.accent.amber}20`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    scoreText: {
        ...typography.bodyBold,
        color: colors.accent.amber,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
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
    resultsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    resultsEmoji: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    resultsTitle: {
        textAlign: 'center',
        ...typography.h1,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    resultsScore: {
        ...typography.h2,
        color: colors.accent.amber,
        marginBottom: spacing.sm,
    },
    resultsStats: {
        ...typography.body,
        color: colors.text.secondary,
        marginBottom: spacing.xxl,
    },
    primaryButton: {
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xxxl,
        marginBottom: spacing.md,
        width: '100%',
        alignItems: 'center',
    },
    primaryButtonText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
    },
    secondaryButton: {
        paddingVertical: spacing.md,
        width: '100%',
        alignItems: 'center',
    },
    secondaryButtonText: {
        ...typography.body,
        color: colors.text.secondary,
    },
});
