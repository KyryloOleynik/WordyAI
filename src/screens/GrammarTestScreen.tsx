// src/screens/GrammarTestScreen.tsx
// AI-generated grammar test for a specific concept

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ActivityIndicator, ScrollView, Pressable, TextInput } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { VButton, VCard, playSound } from '@/components/ui/DesignSystem';
import { unifiedAI } from '@/services/unifiedAIManager';
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

    useEffect(() => {
        if (concept) {
            generateTest();
        }
    }, [concept]);

    const generateTest = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const prompt = `Generate 5 grammar test questions about "${concept.name}" (${concept.nameRu}).

Rule: ${concept.rule || concept.description}

Output JSON array only:
[
  {"question": "Fill: I ___ to school yesterday.", "correctAnswer": "went", "type": "fill-blank"},
  {"question": "Choose correct: She ___ there for years.", "correctAnswer": "has been", "type": "multiple-choice", "options": ["has been", "was", "is", "were"]}
]

Mix fill-blank and multiple-choice. Make them progressively harder.`;

            const response = await unifiedAI.generateText(prompt, { jsonMode: true });

            if (!response.success) {
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
            })));
            setScore({ correct: 0, total: parsed.length });

        } catch (e) {
            setError('Не удалось создать тест. Попробуйте ещё раз.');
        } finally {
            setIsLoading(false);
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
                    <View style={[styles.resultCard, isCorrect ? styles.resultCorrect : styles.resultWrong]}>
                        <Text style={styles.resultEmoji}>{isCorrect ? '✅' : '❌'}</Text>
                        <Text style={styles.resultText}>
                            {isCorrect ? 'Правильно!' : `Ответ: ${current.correctAnswer}`}
                        </Text>
                    </View>
                )}
            </ScrollView>

            <View style={styles.bottomActions}>
                <VButton
                    title={showResult ? 'Далее →' : 'Проверить'}
                    variant={showResult ? (isCorrect ? 'success' : 'danger') : 'primary'}
                    onPress={showResult ? nextQuestion : checkAnswer}
                    disabled={!showResult && !userAnswer.trim()}
                    fullWidth
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    loadingText: { ...typography.h3, color: colors.text.primary, marginTop: spacing.lg },
    loadingSubtext: { ...typography.body, color: colors.text.secondary },
    errorText: { ...typography.body, color: colors.accent.red, textAlign: 'center', marginVertical: spacing.lg },

    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    backText: { fontSize: 24, color: colors.text.primary },
    headerTitle: { ...typography.h3, color: colors.text.primary, flex: 1 },
    progress: { ...typography.caption, color: colors.text.secondary },

    content: { padding: spacing.lg, gap: spacing.lg },
    questionCard: { padding: spacing.xl },
    questionText: { ...typography.h3, color: colors.text.primary, textAlign: 'center' },

    optionsContainer: { gap: spacing.md },
    optionButton: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 2, borderColor: colors.border.light },
    optionSelected: { borderColor: colors.primary[300], backgroundColor: `${colors.primary[300]}10` },
    optionCorrect: { borderColor: colors.accent.green, backgroundColor: `${colors.accent.green}15` },
    optionWrong: { borderColor: colors.accent.red, backgroundColor: `${colors.accent.red}15` },
    optionText: { ...typography.body, color: colors.text.primary, textAlign: 'center' },
    optionTextSelected: { color: colors.primary[300], fontWeight: '700' },

    answerInput: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.lg, padding: spacing.lg, ...typography.h3, color: colors.text.primary, textAlign: 'center', borderWidth: 3, borderColor: colors.border.medium },
    inputCorrect: { borderColor: colors.accent.green, backgroundColor: `${colors.accent.green}10` },
    inputWrong: { borderColor: colors.accent.red, backgroundColor: `${colors.accent.red}10` },

    resultCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: borderRadius.lg, gap: spacing.md },
    resultCorrect: { backgroundColor: `${colors.accent.green}20` },
    resultWrong: { backgroundColor: `${colors.accent.red}20` },
    resultEmoji: { fontSize: 28 },
    resultText: { ...typography.body, color: colors.text.primary, flex: 1 },

    bottomActions: { padding: spacing.lg, backgroundColor: colors.surface },

    completeTitle: { ...typography.h2, color: colors.text.primary, marginTop: spacing.lg },
    completeScore: { ...typography.body, color: colors.text.secondary },
    completeTopic: { ...typography.caption, color: colors.text.tertiary },
});
