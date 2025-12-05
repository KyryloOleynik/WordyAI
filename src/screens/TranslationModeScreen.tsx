import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { VolumetricButton, CompletionScreen } from '@/components/ui/SharedComponents';
import { addXP, XP_REWARDS } from '@/services/storageService';
import { unifiedAI } from '@/services/unifiedAIManager';
import { getWordsForPractice, updateWordMetrics, DictionaryWord } from '@/services/database';
import { analyzeGrammarErrors, GrammarError } from '@/services/grammarDetectionService';
import TappableText from '@/components/ui/TappableText';

const LEVELS = [
    { id: 'A1-A2', label: 'Начальный', color: colors.cefr.A1 },
    { id: 'B1-B2', label: 'Средний', color: colors.cefr.B1 },
    { id: 'C1-C2', label: 'Продвинутый', color: colors.cefr.C1 },
] as const;

// Fallback sentences (used if AI generation fails or no vocabulary)
const FALLBACK_SENTENCES = {
    'A1-A2': [
        { sentence: 'Я люблю читать книги.', expected: 'I love reading books.' },
        { sentence: 'Моя семья очень большая.', expected: 'My family is very big.' },
        { sentence: 'Сегодня хорошая погода.', expected: 'The weather is nice today.' },
    ],
    'B1-B2': [
        { sentence: 'Я бы хотел поехать в отпуск.', expected: 'I would like to go on vacation.' },
        { sentence: 'Если бы у меня было время, я бы прочитал эту книгу.', expected: 'If I had time, I would read this book.' },
    ],
    'C1-C2': [
        { sentence: 'Будь я на твоём месте, я бы поступил иначе.', expected: 'If I were you, I would have acted differently.' },
        { sentence: 'Как бы это ни казалось странным, он был прав.', expected: 'Strange as it may seem, he was right.' },
    ],
};

interface TranslationResult {
    isCorrect: boolean;
    accuracy: number;
    feedback: string;
    suggestedTranslation: string;
    errors: string[];
    grammarErrors?: GrammarError[];
}

export default function TranslationModeScreen() {
    const navigation = useNavigation();

    const [step, setStep] = useState<'level' | 'exercise' | 'result' | 'finished'>('level');
    const [selectedLevel, setSelectedLevel] = useState<'A1-A2' | 'B1-B2' | 'C1-C2' | null>(null);
    const [russianSentence, setRussianSentence] = useState('');
    const [expectedTranslation, setExpectedTranslation] = useState('');
    const [sentenceHint, setSentenceHint] = useState<string | null>(null);
    const [userTranslation, setUserTranslation] = useState('');
    const [result, setResult] = useState<TranslationResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [exerciseCount, setExerciseCount] = useState(0);
    const [totalXP, setTotalXP] = useState(0);
    const [aiStatus, setAiStatus] = useState<string>('Проверка AI...');
    const [vocabWords, setVocabWords] = useState<DictionaryWord[]>([]);
    const [currentWordId, setCurrentWordId] = useState<string | null>(null);
    const [grammarErrors, setGrammarErrors] = useState<GrammarError[]>([]);
    const progressAnim = useRef(new Animated.Value(0)).current;

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    // Animate progress bar
    useEffect(() => {
        const progress = (exerciseCount % 10) / 10;
        Animated.spring(progressAnim, {
            toValue: progress,
            tension: 50,
            friction: 10,
            useNativeDriver: false,
        }).start();
    }, [exerciseCount]);

    // Load vocabulary words on mount
    useEffect(() => {
        loadVocabulary();
        checkAIStatus();
    }, []);

    const loadVocabulary = async () => {
        try {
            const words = await getWordsForPractice(20, true);
            setVocabWords(words);
        } catch (error) {
            console.log('Could not load vocabulary, using fallback sentences');
        }
    };

    const checkAIStatus = async () => {
        const status = await unifiedAI.getStatus();
        if (status.activeBackend === 'google') {
            setAiStatus('Google AI');
        } else if (status.activeBackend === 'perplexity') {
            setAiStatus('Perplexity AI');
        } else {
            setAiStatus('AI недоступен');
        }
    };

    const selectLevel = (level: 'A1-A2' | 'B1-B2' | 'C1-C2') => {
        setSelectedLevel(level);
        loadExercise(level);
    };

    const loadExercise = async (level: 'A1-A2' | 'B1-B2' | 'C1-C2') => {
        setResult(null);
        setUserTranslation('');
        setSentenceHint(null);
        setCurrentWordId(null);
        setIsGenerating(true);
        setStep('exercise');

        try {
            // Get vocabulary words for this exercise
            const targetWords = vocabWords.slice(0, 3).map(w => w.text);

            // Try to generate AI sentence with vocabulary
            const generated = await unifiedAI.generateRussianSentence(level, targetWords);

            if (generated) {
                setRussianSentence(generated.sentence);
                setExpectedTranslation(generated.expectedTranslation);
                setSentenceHint(generated.hint || null);

                // Track word if it was used
                if (targetWords.length > 0) {
                    const usedWord = vocabWords.find(w =>
                        generated.expectedTranslation.toLowerCase().includes(w.text.toLowerCase())
                    );
                    if (usedWord) {
                        setCurrentWordId(usedWord.id);
                    }
                }
            } else {
                // Fallback to static sentences
                const sentences = FALLBACK_SENTENCES[level];
                const fallback = sentences[Math.floor(Math.random() * sentences.length)];
                setRussianSentence(fallback.sentence);
                setExpectedTranslation(fallback.expected);
            }
        } catch (error) {
            console.log('AI generation failed, using fallback');
            const sentences = FALLBACK_SENTENCES[level];
            const fallback = sentences[Math.floor(Math.random() * sentences.length)];
            setRussianSentence(fallback.sentence);
            setExpectedTranslation(fallback.expected);
        } finally {
            setIsGenerating(false);
        }
    };

    const submitTranslation = async () => {
        if (!russianSentence || !userTranslation.trim()) return;
        setIsLoading(true);

        try {
            // Use unified AI manager for evaluation
            const evaluationResult = await unifiedAI.evaluateTranslation(
                russianSentence,
                userTranslation,
                expectedTranslation
            );

            const isCorrect = evaluationResult.accuracy >= 70;

            // Analyze grammar errors if incorrect
            let detectedGrammarErrors: GrammarError[] = [];
            if (!isCorrect) {
                try {
                    detectedGrammarErrors = await analyzeGrammarErrors(
                        russianSentence,
                        userTranslation,
                        expectedTranslation
                    );
                    setGrammarErrors(detectedGrammarErrors);
                } catch (e) {
                    console.log('Grammar analysis failed:', e);
                }
            } else {
                setGrammarErrors([]);
            }

            const finalResult: TranslationResult = {
                isCorrect,
                accuracy: evaluationResult.accuracy,
                feedback: evaluationResult.feedback,
                suggestedTranslation: expectedTranslation,
                errors: evaluationResult.errors,
                grammarErrors: detectedGrammarErrors,
            };

            setResult(finalResult);
            setStep('result');
            setExerciseCount(prev => prev + 1);

            // Update word metrics if a vocabulary word was used
            if (currentWordId) {
                await updateWordMetrics(currentWordId, 'translation', isCorrect);
            }

            // Award XP based on accuracy
            if (finalResult.accuracy >= 70) {
                const xp = finalResult.accuracy >= 90 ? XP_REWARDS.WORD_EASY : XP_REWARDS.WORD_CORRECT;
                setTotalXP(prev => prev + xp);
                await addXP(xp);
            }
        } catch (error) {
            console.error('Translation check error:', error);
            // Simple fallback evaluation
            const userWords = userTranslation.toLowerCase().split(/\s+/);
            const expectedWords = expectedTranslation.toLowerCase().split(/\s+/);
            const matched = userWords.filter(w => expectedWords.includes(w));
            const accuracy = Math.round((matched.length / expectedWords.length) * 100);

            setResult({
                isCorrect: accuracy >= 50,
                accuracy,
                feedback: accuracy >= 70 ? 'Хорошо!' : 'Попробуй сравнить с правильным переводом',
                suggestedTranslation: expectedTranslation,
                errors: []
            });
            setStep('result');
            setExerciseCount(prev => prev + 1);
        } finally {
            setIsLoading(false);
        }
    };

    const nextExercise = () => {
        if (exerciseCount >= 9) { // 0-based index, so 9 is the 10th exercise
            setStep('finished');
            return;
        }

        // Rotate vocabulary words
        setVocabWords(prev => [...prev.slice(1), ...prev.slice(0, 1)]);

        if (selectedLevel) {
            loadExercise(selectedLevel);
        }
    };

    const changeLevel = () => {
        setStep('level');
        setSelectedLevel(null);
        setRussianSentence('');
        setExpectedTranslation('');
        setResult(null);
        setExerciseCount(0);
        setTotalXP(0);
    };

    // Level Selection
    if (step === 'level') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Перевод</Text>
                    <Text style={styles.subtitle}>
                        Переведите предложение с русского на английский. AI проверит грамматику.
                    </Text>
                    <View style={styles.aiStatusBadge}>
                        <Text style={styles.aiStatusText}>🤖 {aiStatus}</Text>
                    </View>
                </View>
                <View style={styles.levelContainer}>
                    {LEVELS.map(level => (
                        <Pressable
                            key={level.id}
                            style={[styles.levelCard, { borderColor: level.color }]}
                            onPress={() => selectLevel(level.id)}
                        >
                            <Text style={[styles.levelId, { color: level.color }]}>{level.id}</Text>
                            <Text style={styles.levelLabel}>{level.label}</Text>
                        </Pressable>
                    ))}
                </View>
                {vocabWords.length > 0 && (
                    <View style={styles.vocabInfo}>
                        <Text style={styles.vocabInfoText}>
                            📚 {vocabWords.length} слов из словаря будут использованы
                        </Text>
                    </View>
                )}
            </View>
        );
    }

    // Exercise Phase
    if (step === 'exercise') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <Text style={styles.levelBadge}>{selectedLevel}</Text>
                        <Text style={styles.exerciseCounter}>
                            Упражнение #{exerciseCount + 1} • +{totalXP} XP
                        </Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.exerciseContent}>
                    {isGenerating ? (
                        <View style={styles.generatingContainer}>
                            <ActivityIndicator size="large" color={colors.primary[300]} />
                            <Text style={styles.generatingText}>Генерация предложения...</Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.sentenceCard}>
                                <Text style={styles.translateLabel}>Переведите на английский:</Text>
                                <Text style={styles.originalSentence}>{russianSentence}</Text>
                                {sentenceHint && (
                                    <Text style={styles.hintText}>💡 {sentenceHint}</Text>
                                )}
                            </View>

                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.translationInput}
                                    value={userTranslation}
                                    onChangeText={setUserTranslation}
                                    placeholder="Type your English translation..."
                                    placeholderTextColor={colors.text.tertiary}
                                    multiline
                                />
                            </View>

                            <View style={styles.buttonRow}>
                                <VolumetricButton
                                    title="Пропустить"
                                    onPress={nextExercise}
                                />
                                <View style={{ flex: 1 }}>
                                    <VolumetricButton
                                        title="Проверить"
                                        variant="success"
                                        onPress={submitTranslation}
                                        disabled={!userTranslation.trim() || isLoading}
                                        loading={isLoading}
                                    />
                                </View>
                            </View>
                        </>
                    )}
                </ScrollView>

                {/* Progress Bar matching MatchingMode */}
                {!isGenerating && (
                    <View style={styles.progressContainer}>
                        <View style={styles.progressTrack}>
                            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
                        </View>
                        <Text style={styles.progressText}>
                            {exerciseCount % 10}/10
                        </Text>
                    </View>
                )}
            </View>
        );
    }

    // Result Phase
    if (step === 'result' && result) {
        return (
            <View style={styles.container}>
                <ScrollView contentContainerStyle={styles.resultContent}>
                    <View style={styles.resultCard}>
                        {/* Score */}
                        <View style={styles.scoreContainer}>
                            <Text style={styles.scoreEmoji}>
                                {result.accuracy >= 80 ? '🎉' : result.accuracy >= 50 ? '👍' : '📝'}
                            </Text>
                            <Text style={[
                                styles.scoreText,
                                {
                                    color: result.accuracy >= 80 ? colors.accent.green :
                                        result.accuracy >= 50 ? colors.accent.amber : colors.accent.red
                                }
                            ]}>
                                {result.accuracy}% точность
                            </Text>
                        </View>

                        {/* Original & Your Translation */}
                        <View style={styles.comparisonSection}>
                            <Text style={styles.comparisonLabel}>Оригинал:</Text>
                            <Text style={styles.comparisonText}>{russianSentence}</Text>
                        </View>

                        <View style={styles.comparisonSection}>
                            <Text style={styles.comparisonLabel}>Ваш перевод:</Text>
                            <Text style={styles.comparisonText}>{userTranslation}</Text>
                        </View>

                        <View style={[styles.comparisonSection, styles.suggestedSection]}>
                            <Text style={styles.comparisonLabel}>Правильный перевод:</Text>
                            <TappableText text={result.suggestedTranslation} style={styles.suggestedText} />
                        </View>

                        {/* Feedback */}
                        <View style={styles.feedbackSection}>
                            <Text style={styles.feedbackLabel}>📝 Обратная связь:</Text>
                            <Text style={styles.feedbackText}>{result.feedback}</Text>
                        </View>

                        {/* Errors */}
                        {result.errors && result.errors.length > 0 && (
                            <View style={styles.errorsSection}>
                                <Text style={styles.errorsLabel}>❌ Ошибки:</Text>
                                {result.errors.map((error, index) => (
                                    <View key={index} style={styles.errorItem}>
                                        <Text style={styles.errorText}>• {error}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Grammar Errors - Auto-detected and saved */}
                        {grammarErrors && grammarErrors.length > 0 && (
                            <View style={styles.grammarSection}>
                                <Text style={styles.grammarLabel}>📖 Грамматика для повторения:</Text>
                                {grammarErrors.map((gErr, index) => (
                                    <View key={index} style={styles.grammarItem}>
                                        <View style={styles.grammarHeader}>
                                            <Text style={styles.grammarPattern}>{gErr.patternRu}</Text>
                                            <Text style={styles.grammarPatternEn}>({gErr.pattern})</Text>
                                        </View>
                                        <Text style={styles.grammarDesc}>{gErr.description}</Text>
                                        <View style={styles.grammarExample}>
                                            <Text style={styles.grammarMistake}>❌ {gErr.userMistake}</Text>
                                            <Text style={styles.grammarCorrect}>✅ {gErr.example}</Text>
                                        </View>
                                    </View>
                                ))}
                                <Text style={styles.grammarNote}>
                                    💡 Добавлено в словарь грамматики для практики
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.buttonRow}>
                        <Pressable style={styles.skipButton} onPress={changeLevel}>
                            <Text style={styles.skipButtonText}>Изменить уровень</Text>
                        </Pressable>
                        <View style={{ flex: 1 }}>
                            <VolumetricButton
                                title="Следующее →"
                                variant={result.accuracy >= 70 ? 'success' : 'primary'}
                                onPress={nextExercise}
                            />
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // Finished Phase
    if (step === 'finished') {
        return (
            <CompletionScreen
                score={Math.round(totalXP / 10)} // Approximation of correct answers based on score
                total={10}
                xpEarned={totalXP}
                onRestart={changeLevel}
                onHome={() => navigation.goBack()}
                title="Урок завершен!"
            />
        );
    }

    return null;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        padding: spacing.lg,
        backgroundColor: colors.surface,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        ...typography.h1,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.text.secondary,
    },
    aiStatusBadge: {
        marginTop: spacing.md,
        backgroundColor: `${colors.primary[300]}20`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        alignSelf: 'flex-start',
    },
    aiStatusText: {
        ...typography.caption,
        color: colors.primary[300],
    },
    levelBadge: {
        ...typography.bodyBold,
        color: colors.primary[300],
        backgroundColor: `${colors.primary[300]}20`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    exerciseCounter: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    levelContainer: {
        padding: spacing.xl,
        gap: spacing.lg,
    },
    levelCard: {
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 2,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
    },
    levelId: {
        ...typography.h2,
        fontWeight: 'bold',
        marginBottom: spacing.xs,
    },
    levelLabel: {
        ...typography.body,
        color: colors.text.secondary,
    },
    vocabInfo: {
        marginHorizontal: spacing.xl,
        padding: spacing.md,
        backgroundColor: `${colors.accent.green}20`,
        borderRadius: borderRadius.md,
    },
    vocabInfoText: {
        ...typography.bodySmall,
        color: colors.accent.green,
        textAlign: 'center',
    },
    exerciseContent: {
        padding: spacing.lg,
        gap: spacing.lg,
    },
    generatingContainer: {
        padding: spacing.xxxl,
        alignItems: 'center',
    },
    generatingText: {
        marginTop: spacing.md,
        color: colors.text.secondary,
        ...typography.body,
    },
    sentenceCard: {
        padding: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
    },
    translateLabel: {
        ...typography.caption,
        color: colors.text.secondary,
        marginBottom: spacing.md,
    },
    originalSentence: {
        ...typography.h3,
        color: colors.text.primary,
        lineHeight: 32,
    },
    hintText: {
        ...typography.bodySmall,
        color: colors.accent.amber,
        marginTop: spacing.md,
    },
    inputContainer: {
        gap: spacing.md,
    },
    translationInput: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        ...typography.body,
        color: colors.text.primary,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    skipButton: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
    },
    skipButtonText: {
        color: colors.text.secondary,
        ...typography.bodyBold,
    },
    primaryButton: {
        flex: 2,
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: colors.text.inverse,
        ...typography.bodyBold,
    },
    disabledButton: {
        backgroundColor: colors.border.medium,
    },
    resultContent: {
        padding: spacing.lg,
        gap: spacing.lg,
    },
    resultCard: {
        padding: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
    },
    scoreContainer: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    scoreEmoji: {
        fontSize: 48,
        marginBottom: spacing.sm,
    },
    scoreText: {
        ...typography.h2,
        fontWeight: 'bold',
    },
    comparisonSection: {
        marginBottom: spacing.lg,
    },
    comparisonLabel: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginBottom: spacing.xs,
    },
    comparisonText: {
        ...typography.body,
        color: colors.text.primary,
    },
    suggestedSection: {
        backgroundColor: `${colors.primary[300]}15`,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary[300],
    },
    suggestedText: {
        ...typography.body,
        color: colors.primary[300],
        fontWeight: '500',
    },
    feedbackSection: {
        marginTop: spacing.lg,
        padding: spacing.md,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.md,
    },
    feedbackLabel: {
        ...typography.bodySmall,
        fontWeight: 'bold',
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    feedbackText: {
        ...typography.body,
        color: colors.text.primary,
        lineHeight: 24,
    },
    errorsSection: {
        marginTop: spacing.lg,
        padding: spacing.md,
        backgroundColor: `${colors.accent.red}15`,
        borderRadius: borderRadius.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent.red,
    },
    errorsLabel: {
        ...typography.bodySmall,
        fontWeight: 'bold',
        color: colors.accent.red,
        marginBottom: spacing.sm,
    },
    errorItem: {
        marginBottom: spacing.xs,
    },
    errorText: {
        ...typography.bodySmall,
        color: colors.text.primary,
    },
    // Grammar section styles
    grammarSection: {
        marginTop: spacing.lg,
        padding: spacing.md,
        backgroundColor: `${colors.accent.blue}10`,
        borderRadius: borderRadius.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent.blue,
    },
    grammarLabel: {
        ...typography.bodySmall,
        fontWeight: '700',
        color: colors.accent.blue,
        marginBottom: spacing.md,
    },
    grammarItem: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    grammarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    grammarPattern: {
        ...typography.bodyBold,
        color: colors.text.primary,
    },
    grammarPatternEn: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    grammarDesc: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    grammarExample: {
        gap: spacing.xs,
    },
    grammarMistake: {
        ...typography.bodySmall,
        color: colors.accent.red,
    },
    grammarCorrect: {
        ...typography.bodySmall,
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
    grammarNote: {
        ...typography.caption,
        color: colors.text.tertiary,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
});
