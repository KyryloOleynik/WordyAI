import { StyleSheet, Text, View, Pressable, Animated, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { getAllWords, getSettings, addXP, DictionaryWord, UserSettings, addWord, XP_REWARDS } from '@/services/storageService';

interface MatchCard {
    id: string;
    text: string;
    matchId: string;
    type: 'word' | 'meaning';
    isSelected: boolean;
    isMatched: boolean;
    translation?: string; // For SRS
}

// Difficulty settings per round
const DIFFICULTY_LEVELS = [
    { pairs: 4, name: 'Легко' },
    { pairs: 6, name: 'Средне' },
    { pairs: 8, name: 'Сложно' },
];

export default function MatchingModeScreen() {
    const navigation = useNavigation<any>();
    const [cards, setCards] = useState<MatchCard[]>([]);
    const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
    const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [showTranslation, setShowTranslation] = useState(true);
    const [score, setScore] = useState(0);
    const [mistakes, setMistakes] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds] = useState(DIFFICULTY_LEVELS.length);
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadGame();
    }, [currentRound]);

    const loadGame = async () => {
        setIsLoading(true);
        const [words, settings] = await Promise.all([getAllWords(), getSettings()]);
        setShowTranslation(settings.showTranslation);

        // Get pairs based on current difficulty
        const pairCount = DIFFICULTY_LEVELS[currentRound]?.pairs || 6;
        const shuffled = words.sort(() => Math.random() - 0.5).slice(0, pairCount);

        if (shuffled.length < 3) {
            // Not enough words - add some defaults
            const defaultWords: DictionaryWord[] = [
                { id: 'd1', text: 'hello', definition: 'a greeting', translation: 'привет', cefrLevel: 'A1', status: 'new', timesShown: 0, timesCorrect: 0, lastReviewedAt: null, nextReviewAt: Date.now(), source: 'manual', createdAt: Date.now() },
                { id: 'd2', text: 'world', definition: 'the earth and all people', translation: 'мир', cefrLevel: 'A1', status: 'new', timesShown: 0, timesCorrect: 0, lastReviewedAt: null, nextReviewAt: Date.now(), source: 'manual', createdAt: Date.now() },
                { id: 'd3', text: 'book', definition: 'pages with text', translation: 'книга', cefrLevel: 'A1', status: 'new', timesShown: 0, timesCorrect: 0, lastReviewedAt: null, nextReviewAt: Date.now(), source: 'manual', createdAt: Date.now() },
                { id: 'd4', text: 'cat', definition: 'a small animal', translation: 'кот', cefrLevel: 'A1', status: 'new', timesShown: 0, timesCorrect: 0, lastReviewedAt: null, nextReviewAt: Date.now(), source: 'manual', createdAt: Date.now() },
                { id: 'd5', text: 'dog', definition: 'a loyal pet', translation: 'собака', cefrLevel: 'A1', status: 'new', timesShown: 0, timesCorrect: 0, lastReviewedAt: null, nextReviewAt: Date.now(), source: 'manual', createdAt: Date.now() },
                { id: 'd6', text: 'house', definition: 'a building', translation: 'дом', cefrLevel: 'A1', status: 'new', timesShown: 0, timesCorrect: 0, lastReviewedAt: null, nextReviewAt: Date.now(), source: 'manual', createdAt: Date.now() },
                { id: 'd7', text: 'water', definition: 'colorless liquid', translation: 'вода', cefrLevel: 'A1', status: 'new', timesShown: 0, timesCorrect: 0, lastReviewedAt: null, nextReviewAt: Date.now(), source: 'manual', createdAt: Date.now() },
                { id: 'd8', text: 'food', definition: 'what we eat', translation: 'еда', cefrLevel: 'A1', status: 'new', timesShown: 0, timesCorrect: 0, lastReviewedAt: null, nextReviewAt: Date.now(), source: 'manual', createdAt: Date.now() },
            ];
            const needed = pairCount - shuffled.length;
            shuffled.push(...defaultWords.slice(0, needed));
        }

        // Create card pairs
        const wordCards: MatchCard[] = shuffled.map(w => ({
            id: `word-${w.id}`,
            text: w.text,
            matchId: w.id,
            type: 'word' as const,
            isSelected: false,
            isMatched: false,
        }));

        const meaningCards: MatchCard[] = shuffled.map(w => ({
            id: `meaning-${w.id}`,
            text: settings.showTranslation ? w.translation : w.definition,
            matchId: w.id,
            type: 'meaning' as const,
            isSelected: false,
            isMatched: false,
        }));

        // Shuffle both arrays
        const allCards = [
            ...wordCards.sort(() => Math.random() - 0.5),
            ...meaningCards.sort(() => Math.random() - 0.5),
        ];

        setCards(allCards);
        setMatchedPairs(new Set());
        setSelectedCard(null);
        setIsLoading(false);
    };

    const handleCardPress = (card: MatchCard) => {
        if (card.isMatched) return;

        if (!selectedCard) {
            // First selection
            setSelectedCard(card);
            setCards(prev => prev.map(c =>
                c.id === card.id ? { ...c, isSelected: true } : c
            ));
        } else if (selectedCard.id === card.id) {
            // Deselect
            setSelectedCard(null);
            setCards(prev => prev.map(c =>
                c.id === card.id ? { ...c, isSelected: false } : c
            ));
        } else {
            // Second selection - check match
            if (selectedCard.matchId === card.matchId && selectedCard.type !== card.type) {
                // Match!
                setMatchedPairs(prev => new Set([...prev, card.matchId]));
                setCards(prev => prev.map(c =>
                    c.matchId === card.matchId
                        ? { ...c, isMatched: true, isSelected: false }
                        : c
                ));
                setScore(prev => prev + XP_REWARDS.WORD_CORRECT);
                setSelectedCard(null);
                // Round completion handled in useEffect
            } else {
                // No match - shake and add word to SRS
                setMistakes(prev => prev + 1);

                // Word will be practiced again via normal review flow

                Animated.sequence([
                    Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
                ]).start();

                setTimeout(() => {
                    setCards(prev => prev.map(c => ({ ...c, isSelected: false })));
                    setSelectedCard(null);
                }, 300);
            }
        }
    };

    const restart = () => {
        setCurrentRound(0);
        setScore(0);
        setMistakes(0);
        setIsComplete(false);
    };

    const nextRound = () => {
        if (currentRound < totalRounds - 1) {
            setCurrentRound(prev => prev + 1);
        } else {
            // All rounds complete
            setIsComplete(true);
            addXP(score);
        }
    };

    // Check for round completion
    useEffect(() => {
        const totalPairs = cards.filter(c => c.type === 'word').length;
        if (totalPairs > 0 && matchedPairs.size >= totalPairs && !isComplete) {
            setTimeout(() => {
                if (currentRound < totalRounds - 1) {
                    nextRound();
                } else {
                    setIsComplete(true);
                    addXP(score);
                }
            }, 800);
        }
    }, [matchedPairs.size]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[300]} />
                <Text style={styles.loadingText}>
                    {currentRound > 0 ? `Раунд ${currentRound + 1}...` : 'Подготовка игры...'}
                </Text>
            </View>
        );
    }

    if (isComplete) {
        const accuracy = Math.round((score / (score + mistakes * 5)) * 100) || 100;
        return (
            <View style={styles.container}>
                <View style={styles.resultsContainer}>
                    <Text style={styles.resultsEmoji}>🎉</Text>
                    <Text style={styles.resultsTitle}>Все раунды пройдены!</Text>
                    <Text style={styles.resultsScore}>+{score} XP</Text>
                    <Text style={styles.resultsStats}>
                        Раундов: {totalRounds} • Ошибок: {mistakes} • Точность: {accuracy}%
                    </Text>
                    <Pressable style={styles.primaryButton} onPress={restart}>
                        <Text style={styles.primaryButtonText}>Играть снова</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.secondaryButtonText}>Назад</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    const wordCards = cards.filter(c => c.type === 'word');
    const meaningCards = cards.filter(c => c.type === 'meaning');

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>
                        Раунд {currentRound + 1} • {DIFFICULTY_LEVELS[currentRound]?.name}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        {showTranslation ? 'Соедини с переводом' : 'Соедини с определением'}
                    </Text>
                </View>
                <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>+{score} XP</Text>
                </View>
            </View>

            {/* Game Grid */}
            <View style={styles.gameContainer}>
                <Animated.View style={[styles.column, { transform: [{ translateX: shakeAnim }] }]}>
                    <Text style={styles.columnTitle}>English</Text>
                    {wordCards.map(card => (
                        <Pressable
                            key={card.id}
                            style={[
                                styles.card,
                                card.isSelected && styles.cardSelected,
                                card.isMatched && styles.cardMatched,
                            ]}
                            onPress={() => handleCardPress(card)}
                            disabled={card.isMatched}
                        >
                            <Text style={[
                                styles.cardText,
                                card.isMatched && styles.cardTextMatched,
                            ]}>
                                {card.text}
                            </Text>
                        </Pressable>
                    ))}
                </Animated.View>

                <Animated.View style={[styles.column, { transform: [{ translateX: shakeAnim }] }]}>
                    <Text style={styles.columnTitle}>
                        {showTranslation ? 'Русский' : 'Definition'}
                    </Text>
                    {meaningCards.map(card => (
                        <Pressable
                            key={card.id}
                            style={[
                                styles.card,
                                card.isSelected && styles.cardSelected,
                                card.isMatched && styles.cardMatched,
                            ]}
                            onPress={() => handleCardPress(card)}
                            disabled={card.isMatched}
                        >
                            <Text style={[
                                styles.cardText,
                                styles.meaningText,
                                card.isMatched && styles.cardTextMatched,
                            ]} numberOfLines={3}>
                                {card.text}
                            </Text>
                        </Pressable>
                    ))}
                </Animated.View>
            </View>

            {/* Progress */}
            <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                    {matchedPairs.size} / {wordCards.length} соединено
                </Text>
            </View>
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
    gameContainer: {
        flex: 1,
        flexDirection: 'row',
        padding: spacing.md,
        gap: spacing.md,
    },
    column: {
        flex: 1,
        gap: spacing.sm,
    },
    columnTitle: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        minHeight: 60,
        justifyContent: 'center',
        alignItems: 'center',
        // Volumetric 3D effect
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        borderLeftColor: 'rgba(255,255,255,0.05)',
        borderBottomWidth: 4,
        borderRightWidth: 2,
        borderBottomColor: 'rgba(0,0,0,0.3)',
        borderRightColor: 'rgba(0,0,0,0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 6,
    },
    cardSelected: {
        backgroundColor: colors.primary[300],
        borderBottomColor: colors.primary[400],
        borderRightColor: colors.primary[400],
        transform: [{ scale: 1.02 }],
    },
    cardMatched: {
        backgroundColor: `${colors.accent.green}30`,
        borderColor: colors.accent.green,
        borderWidth: 2,
        transform: [{ scale: 0.98 }],
        opacity: 0.8,
    },
    cardText: {
        ...typography.body,
        color: colors.text.primary,
        textAlign: 'center',
        fontWeight: '600',
    },
    meaningText: {
        ...typography.bodySmall,
    },
    cardTextMatched: {
        color: colors.accent.green,
    },
    cardTextSelected: {
        color: colors.text.inverse,
    },
    progressContainer: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    progressText: {
        ...typography.body,
        color: colors.text.secondary,
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
    },
    primaryButtonText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
    },
    secondaryButton: {
        paddingVertical: spacing.md,
    },
    secondaryButtonText: {
        ...typography.body,
        color: colors.text.secondary,
    },
});
