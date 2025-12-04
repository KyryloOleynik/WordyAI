import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { useLocalLLM } from '@/hooks/useLocalLLM';
import { ModelDownloadIndicator } from '@/components/ui/ModelDownloadIndicator';
import { VolumetricButton, SuccessAnimation } from '@/components/ui/SharedComponents';
import { addXP, XP_REWARDS } from '@/services/storageService';
import { generateRussianSentence, evaluateTranslation } from '@/services/aiService';

const LEVELS = [
    { id: 'A1-A2', label: 'Начальный', color: colors.cefr.A1 },
    { id: 'B1-B2', label: 'Средний', color: colors.cefr.B1 },
    { id: 'C1-C2', label: 'Продвинутый', color: colors.cefr.C1 },
] as const;

// Fallback sentences (used if AI generation fails)
const FALLBACK_SENTENCES = {
    'A1-A2': [
        'Я люблю читать книги.',
        'Моя семья очень большая.',
        'Сегодня хорошая погода.',
    ],
    'B1-B2': [
        'Я бы хотел поехать в отпуск.',
        'Если бы у меня было время, я бы прочитал эту книгу.',
    ],
    'C1-C2': [
        'Будь я на твоём месте, я бы поступил иначе.',
        'Как бы это ни казалось странным, он был прав.',
    ],
};

interface TranslationResult {
    isCorrect: boolean;
    accuracy: number;
    feedback: string;
    suggestedTranslation: string;
    errors: string[];
}

export default function TranslationModeScreen() {
    const navigation = useNavigation();
    const { isReady, downloadProgress, checkEnglishTranslation } = useLocalLLM();

    const [step, setStep] = useState<'level' | 'exercise' | 'result'>('level');
    const [selectedLevel, setSelectedLevel] = useState<'A1-A2' | 'B1-B2' | 'C1-C2' | null>(null);
    const [russianSentence, setRussianSentence] = useState('');
    const [sentenceHint, setSentenceHint] = useState<string | null>(null);
    const [userTranslation, setUserTranslation] = useState('');
    const [result, setResult] = useState<TranslationResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [exerciseCount, setExerciseCount] = useState(0);
    const [totalXP, setTotalXP] = useState(0);

    const selectLevel = (level: 'A1-A2' | 'B1-B2' | 'C1-C2') => {
        setSelectedLevel(level);
        loadExercise(level);
    };

    const loadExercise = async (level: 'A1-A2' | 'B1-B2' | 'C1-C2') => {
        setResult(null);
        setUserTranslation('');
        setSentenceHint(null);
        setIsGenerating(true);
        setStep('exercise');

        try {
            // Try to generate AI sentence
            const generated = await generateRussianSentence(level);

            if (generated) {
                setRussianSentence(generated.sentence);
                setSentenceHint(generated.hint || null);
            } else {
                // Fallback to static sentences
                const sentences = FALLBACK_SENTENCES[level];
                setRussianSentence(sentences[Math.floor(Math.random() * sentences.length)]);
            }
        } catch (error) {
            console.log('AI generation failed, using fallback');
            const sentences = FALLBACK_SENTENCES[level];
            setRussianSentence(sentences[Math.floor(Math.random() * sentences.length)]);
        } finally {
            setIsGenerating(false);
        }
    };

    const submitTranslation = async () => {
        if (!russianSentence || !userTranslation.trim()) return;
        setIsLoading(true);

        try {
            // Use LLM to get suggested translation and then calculate accuracy
            const checkResult = await checkEnglishTranslation(russianSentence, userTranslation);

            // Use formula-based accuracy calculation
            const accuracyResult = await evaluateTranslation(
                russianSentence,
                userTranslation,
                checkResult.suggestedTranslation
            );

            // Combine results
            const finalResult: TranslationResult = {
                isCorrect: accuracyResult.accuracy >= 70,
                accuracy: accuracyResult.accuracy,
                feedback: accuracyResult.feedback || checkResult.feedback,
                suggestedTranslation: checkResult.suggestedTranslation,
                errors: accuracyResult.errors.length > 0 ? accuracyResult.errors : checkResult.errors,
            };

            setResult(finalResult);
            setStep('result');
            setExerciseCount(prev => prev + 1);

            // Award XP based on accuracy
            if (finalResult.accuracy >= 70) {
                const xp = finalResult.accuracy >= 90 ? XP_REWARDS.WORD_EASY : XP_REWARDS.WORD_CORRECT;
                setTotalXP(prev => prev + xp);
                await addXP(xp);
            }
        } catch (error) {
            console.error('Translation check error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const nextExercise = () => {
        if (selectedLevel) {
            loadExercise(selectedLevel);
        }
    };

    const changeLevel = () => {
        setStep('level');
        setSelectedLevel(null);
        setRussianSentence('');
        setResult(null);
        setExerciseCount(0);
    };

    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <ModelDownloadIndicator
                    visible={!!downloadProgress}
                    progress={downloadProgress?.progress || 0}
                    text={downloadProgress?.text || 'Инициализация...'}
                />
                {!downloadProgress && (
                    <>
                        <ActivityIndicator size="large" color={colors.primary[300]} />
                        <Text style={styles.loadingText}>Загрузка AI модели...</Text>
                    </>
                )}
            </View>
        );
    }

    // Level Selection
    if (step === 'level') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Перевод</Text>
                    <Text style={styles.subtitle}>
                        Переведите предложение с русского на английский. AI проверит грамматику.
                    </Text>
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
                    <View style={styles.sentenceCard}>
                        <Text style={styles.translateLabel}>Переведите на английский:</Text>
                        <Text style={styles.originalSentence}>{russianSentence}</Text>
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
                        <Pressable style={styles.skipButton} onPress={nextExercise}>
                            <Text style={styles.skipButtonText}>Пропустить</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.primaryButton, !userTranslation.trim() && styles.disabledButton]}
                            onPress={submitTranslation}
                            disabled={!userTranslation.trim() || isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={colors.text.inverse} />
                            ) : (
                                <Text style={styles.primaryButtonText}>Проверить</Text>
                            )}
                        </Pressable>
                    </View>
                </ScrollView>
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
                            <Text style={styles.suggestedText}>{result.suggestedTranslation}</Text>
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

    return null;
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
    exerciseContent: {
        padding: spacing.lg,
        gap: spacing.lg,
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
});
