// src/screens/GrammarTestScreen.tsx
// AI-generated grammar test for a specific concept

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ActivityIndicator, ScrollView, Pressable, TextInput } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { VButton, VCard, playSound } from '@/components/ui/DesignSystem';
import { UnifiedFeedbackModal, getApiKeyErrorConfig } from '@/components/ui/SharedComponents';
import { unifiedAI } from '@/services/unifiedAIManager';
import { PromptTemplates } from '@/services/promptTemplates';
import { updateGrammarMetrics, GrammarConcept } from '@/services/database';

type RouteParams = {
    GrammarTest: { concept: GrammarConcept };
};

interface Question {
    id: string;
    question: string;
    correctAnswer: string;
    type: 'fill-blank' | 'multiple-choice';
    options?: string[];
    translation?: string;
}

export default function GrammarTestScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RouteParams, 'GrammarTest'>>();
    const concept = route.params?.concept;

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [score, setScore] = useState({ correct: 0, total: 0 });
    const [isComplete, setIsComplete] = useState(false);

    const [feedbackModal, setFeedbackModal] = useState({
        visible: false,
        type: 'info' as 'success' | 'warning' | 'error' | 'info',
        title: '',
        message: '',
        primaryAction: null as { label: string; onPress: () => void } | null,
    });

    useEffect(() => {
        if (concept) {
            generateTest();
        }
    }, [concept]);

    const generateTest = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const prompt = PromptTemplates.generateGrammarTest(
                concept.name,
                concept.rule || concept.description
            );

            const response = await unifiedAI.generateText(prompt, { jsonMode: true });

            if (!response.success) {
                if (response.source === 'none') {
                    throw { name: 'ApiKeyError', message: 'No AI provider available' };
                }
                throw new Error('Не удалось сгенерировать тест');
            }

            const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new Error('AI вернул некорректные данные');
            }

            setQuestions(parsed.map((q: any, i: number) => ({
                id: `q_${i}`,
                question: q.question,
                correctAnswer: q.correctAnswer,
                type: q.type || 'fill-blank',
                options: q.options,
                translation: q.translation
            })));
            setScore({ correct: 0, total: parsed.length });

        } catch (e: any) {
            console.warn(e);
            if (e.name === 'ApiKeyError' || (e.message && e.message.includes('API'))) {
                setFeedbackModal(getApiKeyErrorConfig(navigation, () => setFeedbackModal(prev => ({ ...prev, visible: false }))));
                setIsLoading(false);
            } else {
                setError('Не удалось создать тест. Попробуйте ещё раз.');
            }
        } finally {
            if (!feedbackModal.visible) setIsLoading(false);
        }
    };

    const checkAnswer = async () => {
        const current = questions[currentIndex];
        const correct = userAnswer.toLowerCase().trim() === current.correctAnswer.toLowerCase().trim();

        setIsCorrect(correct);
        setShowResult(true);
        playSound(correct ? 'correct' : 'wrong');

        if (correct) {
            setScore(s => ({ ...s, correct: s.correct + 1 }));
        }

        // Update grammar metrics
        if (concept) {
            await updateGrammarMetrics(concept.id, correct);
        }
    };

    const nextQuestion = () => {
        if (currentIndex + 1 >= questions.length) {
            setIsComplete(true);
        } else {
            setCurrentIndex(i => i + 1);
            setUserAnswer('');
            setShowResult(false);
        }
    };

    // Loading
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary[300]} />
                    <Text style={styles.loadingText}>Генерация теста...</Text>
                    <Text style={styles.loadingSubtext}>{concept?.nameRu}</Text>
                </View>
                <UnifiedFeedbackModal
                    visible={feedbackModal.visible}
                    type={feedbackModal.type}
                    title={feedbackModal.title}
                    message={feedbackModal.message}
                    primaryAction={feedbackModal.primaryAction ? {
                        label: feedbackModal.primaryAction.label,
                        onPress: feedbackModal.primaryAction.onPress,
                    } : undefined}
                    onClose={() => setFeedbackModal(prev => ({ ...prev, visible: false }))}
                />
            </SafeAreaView>
        );
    }

    // Error
    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContainer}>
                    <Text style={{ fontSize: 48 }}>⚠️</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <VButton title="Попробовать снова" onPress={generateTest} fullWidth />
                    <VButton title="Назад" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
                </View>
            </SafeAreaView>
        );
    }

    // Complete
    if (isComplete) {
        const percentage = Math.round((score.correct / score.total) * 100);
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContainer}>
                    <Text style={{ fontSize: 72 }}>{percentage >= 80 ? '🎉' : percentage >= 50 ? '👍' : '📝'}</Text>
                    <Text style={styles.completeTitle}>Тест завершён!</Text>
                    <Text style={styles.completeScore}>
                        {score.correct}/{score.total} правильно ({percentage}%)
                    </Text>
                    <Text style={styles.completeTopic}>{concept?.nameRu}</Text>
                    <View style={{ width: '100%', gap: spacing.md, marginTop: spacing.xl }}>
                        <VButton title="Пройти ещё раз" onPress={() => { setIsComplete(false); setCurrentIndex(0); setScore({ correct: 0, total: questions.length }); generateTest(); }} fullWidth />
                        <VButton title="Назад" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // Test
    if (questions.length === 0 || !questions[currentIndex]) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary[300]} />
                    <UnifiedFeedbackModal
                        visible={feedbackModal.visible}
                        type={feedbackModal.type}
                        title={feedbackModal.title}
                        message={feedbackModal.message}
                        primaryAction={feedbackModal.primaryAction ? {
                            label: feedbackModal.primaryAction.label,
                            onPress: feedbackModal.primaryAction.onPress,
                        } : undefined}
                        onClose={() => setFeedbackModal(prev => ({ ...prev, visible: false }))}
                    />
                </View>
            </SafeAreaView>
        );
    }

    const current = questions[currentIndex];
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>←</Text>
                </Pressable>
                <Text style={styles.headerTitle}>{concept?.nameRu}</Text>
                <Text style={styles.progress}>{currentIndex + 1}/{questions.length}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <VCard style={styles.questionCard}>
                    <Text style={styles.questionText}>{current.question}</Text>
                    {current.translation && (
                        <Text style={styles.translationText}>{current.translation}</Text>
                    )}
                </VCard>

                {current.type === 'multiple-choice' && current.options ? (
                    <View style={styles.optionsContainer}>
                        {current.options.map((opt, i) => (
                            <Pressable
                                key={i}
                                style={[
                                    styles.optionButton,
                                    userAnswer === opt && styles.optionSelected,
                                    showResult && opt === current.correctAnswer && styles.optionCorrect,
                                    showResult && userAnswer === opt && !isCorrect && styles.optionWrong,
                                ]}
                                onPress={() => !showResult && setUserAnswer(opt)}
                                disabled={showResult}
                            >
                                <Text style={[
                                    styles.optionText,
                                    userAnswer === opt && styles.optionTextSelected,
                                ]}>{opt}</Text>
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <TextInput
                        style={[
                            styles.answerInput,
                            showResult && (isCorrect ? styles.inputCorrect : styles.inputWrong),
                        ]}
                        value={userAnswer}
                        onChangeText={setUserAnswer}
                        placeholder="Введите ответ..."
                        placeholderTextColor={colors.text.tertiary}
                        editable={!showResult}
                        autoCapitalize="none"
                    />
                )}

                {showResult && (
                    <View style={styles.resultContainer}>
                        <Text style={[
                            styles.resultText,
                            isCorrect ? styles.resultTextCorrect : styles.resultTextWrong
                        ]}>
                            {isCorrect ? 'Правильно!' : `Неправильно. Правильный ответ: ${current.correctAnswer}`}
                        </Text>
                        <VButton
                            title={currentIndex + 1 < questions.length ? "Следующий вопрос" : "Завершить"}
                            onPress={nextQuestion}
                            variant={isCorrect ? 'success' : 'primary'}
                            fullWidth
                        />
                    </View>
                )}

                {!showResult && (
                    <View style={styles.footer}>
                        <VButton
                            title="Проверить"
                            onPress={checkAnswer}
                            disabled={!userAnswer}
                            fullWidth
                        />
                    </View>
                )}
            </ScrollView>
            <UnifiedFeedbackModal
                visible={feedbackModal.visible}
                type={feedbackModal.type}
                title={feedbackModal.title}
                message={feedbackModal.message}
                primaryAction={feedbackModal.primaryAction ? {
                    label: feedbackModal.primaryAction.label,
                    onPress: feedbackModal.primaryAction.onPress,
                } : undefined}
                onClose={() => setFeedbackModal(prev => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.lg,
    },
    loadingText: {
        ...typography.h3,
        color: colors.text.primary,
        marginTop: spacing.md,
    },
    loadingSubtext: {
        textAlign: 'center',
        ...typography.body,
        color: colors.text.secondary,
    },
    errorText: {
        ...typography.h3,
        color: colors.text.primary,
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
        backgroundColor: colors.surface,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceElevated,
    },
    backText: {
        fontSize: 24,
        color: colors.text.primary,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        ...typography.h3,
        color: colors.text.primary,
    },
    progress: {
        ...typography.bodyBold,
        color: colors.primary[500],
    },
    content: {
        padding: spacing.lg,
        gap: spacing.xl,
    },
    questionCard: {
        padding: spacing.xl,
        minHeight: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    questionText: {
        ...typography.h3,
        color: colors.text.primary,
        textAlign: 'center',
        lineHeight: 32,
    },
    translationText: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginTop: spacing.sm,
        fontStyle: 'italic',
    },
    optionsContainer: {
        gap: spacing.md,
    },
    optionButton: {
        padding: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 2,
        borderColor: colors.border.light,
    },
    optionSelected: {
        borderColor: colors.primary[300],
        backgroundColor: colors.primary[100],
    },
    optionCorrect: {
        borderColor: colors.success,
        backgroundColor: `${colors.success}20`,
    },
    optionWrong: {
        borderColor: colors.error,
        backgroundColor: `${colors.error}20`,
    },
    optionText: {
        ...typography.body,
        color: colors.text.primary,
        textAlign: 'center',
    },
    optionTextSelected: {
        ...typography.bodyBold,
        color: colors.primary[700],
    },
    answerInput: {
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border.medium,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        fontSize: 18,
        color: colors.text.primary,
    },
    inputCorrect: {
        borderColor: colors.success,
        backgroundColor: `${colors.success}10`,
    },
    inputWrong: {
        borderColor: colors.error,
        backgroundColor: `${colors.error}10`,
    },
    footer: {
        marginTop: spacing.xl,
    },
    resultContainer: {
        gap: spacing.lg,
        padding: spacing.lg,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.xl,
        borderLeftWidth: 4,
        borderColor: colors.primary[300],
    },
    resultText: {
        ...typography.bodyBold,
        textAlign: 'center',
    },
    resultTextCorrect: {
        color: colors.success,
    },
    resultTextWrong: {
        color: colors.error,
    },
    completeTitle: {
        ...typography.h1,
        color: colors.text.primary,
    },
    completeScore: {
        ...typography.h2,
        color: colors.primary[500],
    },
    completeTopic: {
        ...typography.body,
        color: colors.text.secondary,
        marginTop: spacing.sm,
    },
});
