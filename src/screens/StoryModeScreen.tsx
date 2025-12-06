import { StyleSheet, Text, View, Pressable, ScrollView, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { VProgress, VButton } from '@/components/ui/DesignSystem';
import { CompletionScreen, UnifiedFeedbackModal } from '@/components/ui/SharedComponents';
import { unifiedAI, ApiKeyError } from '@/services/unifiedAIManager';
import { addWord, getSettings, addXP, XP_REWARDS, getAllWords } from '@/services/storageService';
import { translateWord } from '@/services/translationService';
import { getGrammarConcepts, addOrUpdateGrammarConcept } from '@/services/database';

const STORY_TOPICS = [
    { id: 'adventure', label: '🏔️ Приключения' },
    { id: 'mystery', label: '🔍 Загадка' },
    { id: 'romance', label: '❤️ Романтика' },
    { id: 'scifi', label: '🚀 Фантастика' },
    { id: 'everyday', label: '🏠 Повседневность' },
    { id: 'fantasy', label: '🧙 Фэнтези' },
];

const LEVELS = [
    { id: 'A1-A2', label: 'Начальный', color: colors.cefr.A1 },
    { id: 'B1-B2', label: 'Средний', color: colors.cefr.B1 },
    { id: 'C1-C2', label: 'Продвинутый', color: colors.cefr.C1 },
] as const;

interface Question {
    question: string;
    correctAnswer: string;
    options?: string[];
}

interface WordLookupData {
    word: string;
    definition: string;
    translation: string;
    cefrLevel: string;
    isLoading: boolean;
}

export default function StoryModeScreen() {
    const navigation = useNavigation();

    const [step, setStep] = useState<'topic' | 'level' | 'reading' | 'questions' | 'results'>('topic');
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [selectedLevel, setSelectedLevel] = useState<'A1-A2' | 'B1-B2' | 'C1-C2' | null>(null);
    const [story, setStory] = useState<{ title: string; story: string; questions: Question[] } | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<{ isCorrect: boolean; feedback: string }[]>([]);
    const [currentFeedback, setCurrentFeedback] = useState<string | null>(null);

    // Word lookup state
    const [wordLookup, setWordLookup] = useState<WordLookupData | null>(null);
    const [showWordModal, setShowWordModal] = useState(false);
    const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
    const [showTranslation, setShowTranslation] = useState(true);

    const [feedbackModal, setFeedbackModal] = useState<{
        visible: boolean;
        type: 'success' | 'error' | 'info' | 'warning';
        title: string;
        message: string;
        primaryAction?: { label: string; onPress: () => void };
    }>({
        visible: false,
        type: 'info',
        title: '',
        message: ''
    });

    useEffect(() => {
        getSettings().then(s => setShowTranslation(s.showTranslation));
    }, []);

    const selectTopic = (topic: string) => {
        setSelectedTopic(topic);
        setStep('level');
    };

    const selectLevel = async (level: 'A1-A2' | 'B1-B2' | 'C1-C2') => {
        setSelectedLevel(level);
        setIsLoading(true);

        try {
            // Load user's vocabulary and grammar to incorporate in story
            const words = await getAllWords();
            const grammar = await getGrammarConcepts();

            // Select random words to practice (max 5)
            const vocabWords = words
                .filter(w => w.status !== 'known')
                .slice(0, 10)
                .sort(() => Math.random() - 0.5)
                .slice(0, 5)
                .map(w => w.text);

            // Select grammar concepts to practice
            const grammarFocus = grammar
                .filter(g => g.errorCount > 0 || g.masteryScore < 0.5)
                .slice(0, 2)
                .map(g => g.name);

            console.log('[StoryMode] Using vocabulary:', vocabWords);
            console.log('[StoryMode] Using grammar:', grammarFocus);

            const result = await unifiedAI.generateStoryWithQuestions(
                selectedTopic!,
                level,
                vocabWords.length > 0 ? vocabWords : undefined,
                grammarFocus.length > 0 ? grammarFocus : undefined
            );
            if (result) {
                setStory(result);
                setStep('reading');
            } else {
                setFeedbackModal({
                    visible: true,
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось создать историю. Попробуйте другую тему или уровень.'
                });
            }
        } catch (error: any) {
            console.error('Story generation error:', error);
            if (error.name === 'ApiKeyError') {
                setFeedbackModal({
                    visible: true,
                    type: 'warning',
                    title: 'Ошибка ключа API',
                    message: 'Для создания историй нужен API ключ.',
                    primaryAction: {
                        label: 'Настройки',
                        onPress: () => {
                            setFeedbackModal(prev => ({ ...prev, visible: false }));
                            navigation.navigate('Settings' as never);
                        }
                    }
                });
            } else {
                setFeedbackModal({
                    visible: true,
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Произошла ошибка при генерации истории.'
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Handle word tap in story - uses fast API instead of LLM
    const handleWordTap = async (word: string) => {
        const cleanWord = word.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
        if (!cleanWord || cleanWord.length < 2) return;

        setWordLookup({ word: cleanWord, definition: '', translation: '', cefrLevel: '', isLoading: true });
        setShowWordModal(true);

        try {
            // Use fast API translation instead of LLM
            const result = await translateWord(cleanWord);
            if (result) {
                setWordLookup({
                    word: cleanWord,
                    definition: result.definition || 'Definition not found',
                    translation: result.translation || 'Перевод не найден',
                    cefrLevel: result.cefrLevel || 'B1',
                    isLoading: false,
                });
            } else {
                setWordLookup({
                    word: cleanWord,
                    definition: 'Could not look up word',
                    translation: 'Не удалось найти перевод',
                    cefrLevel: 'B1',
                    isLoading: false,
                });
            }
        } catch (error) {
            setWordLookup({
                word: cleanWord,
                definition: 'Error looking up word',
                translation: 'Ошибка поиска',
                cefrLevel: 'B1',
                isLoading: false,
            });
        }
    };

    const addWordToDictionary = async () => {
        if (wordLookup && !addedWords.has(wordLookup.word)) {
            await addWord({
                text: wordLookup.word,
                definition: wordLookup.definition,
                translation: wordLookup.translation,
                cefrLevel: wordLookup.cefrLevel,
                status: 'new',
                timesShown: 0,
                timesCorrect: 0,
                timesWrong: 0,
                lastReviewedAt: null,
                nextReviewAt: Date.now(),
                source: 'lookup',
                reviewCount: 0,
                masteryScore: 0,
            });
            setAddedWords(prev => new Set([...prev, wordLookup.word]));
        }
        setShowWordModal(false);
    };

    const startQuestions = () => {
        setStep('questions');
        setCurrentQuestionIndex(0);
        setResults([]);
    };

    const submitAnswer = async () => {
        if (!story || !userAnswer.trim()) return;
        setIsLoading(true);

        try {
            const currentQuestion = story.questions[currentQuestionIndex];

            // First check the answer correctness
            const result = await unifiedAI.checkStoryAnswer(
                currentQuestion.question,
                userAnswer,
                currentQuestion.correctAnswer,
                story.story
            );

            // Also evaluate user's English for grammar/spelling (if it's a longer response)
            if (userAnswer.split(' ').length >= 3) {
                const evaluation = await unifiedAI.evaluateEnglishText(
                    userAnswer,
                    `Answering question: ${currentQuestion.question}`
                );

                // Save grammar concepts from evaluation
                for (const concept of evaluation.grammarConcepts) {
                    try {
                        await addOrUpdateGrammarConcept({
                            name: concept.name,
                            nameRu: concept.nameRu,
                            description: concept.description,
                            rule: concept.rule,
                            examples: JSON.stringify([concept.example]),
                        });
                        console.log('[Story] Saved grammar concept:', concept.name);
                    } catch (e) {
                        console.error('[Story] Error saving grammar:', e);
                    }
                }

                // Save vocabulary suggestions
                for (const word of evaluation.vocabularySuggestions) {
                    try {
                        await addWord({
                            text: word.word.toLowerCase(),
                            translation: word.translation,
                            definition: word.definition,
                            cefrLevel: word.level || 'B1',
                            status: 'new',
                            timesShown: 0,
                            timesCorrect: 0,
                            timesWrong: 0,
                            lastReviewedAt: null,
                            nextReviewAt: Date.now(),
                            source: 'lookup',
                            reviewCount: 0,
                            masteryScore: 0,
                        });
                        console.log('[Story] Saved vocabulary word:', word.word);
                    } catch (e) {
                        console.error('[Story] Error saving word:', e);
                    }
                }
            }

            setCurrentFeedback(result.feedback);
            setResults(prev => [...prev, result]);
        } catch (error) {
            console.error('Answer check error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const nextQuestion = () => {
        setCurrentFeedback(null);
        setUserAnswer('');

        if (currentQuestionIndex < (story?.questions.length || 0) - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            setStep('results');
        }
    };

    const restart = () => {
        setStep('topic');
        setSelectedTopic(null);
        setSelectedLevel(null);
        setStory(null);
        setCurrentQuestionIndex(0);
        setUserAnswer('');
        setResults([]);
        setCurrentFeedback(null);
        setAddedWords(new Set());
    };

    // With unifiedAI, we don't need to wait for local model - it auto-selects backend

    if (isLoading && step !== 'questions') {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[300]} />
                <Text style={styles.loadingText}>
                    {step === 'level' ? 'Генерация истории...' : 'Обработка...'}
                </Text>
            </View>
        );
    }

    // Topic Selection
    if (step === 'topic') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Режим историй</Text>
                    <Text style={styles.subtitle}>
                        Нажимайте на слова во время чтения, чтобы увидеть перевод
                    </Text>
                </View>
                <ScrollView contentContainerStyle={styles.grid}>
                    {STORY_TOPICS.map(topic => (
                        <Pressable
                            key={topic.id}
                            style={styles.topicCard}
                            onPress={() => selectTopic(topic.id)}
                        >
                            <Text style={styles.topicEmoji}>{topic.label.split(' ')[0]}</Text>
                            <Text style={styles.topicLabel}>{topic.label.split(' ').slice(1).join(' ')}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
        );
    }

    // Level Selection
    if (step === 'level') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Выберите уровень</Text>
                    <Text style={styles.subtitle}>Сложность текста</Text>
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
                <UnifiedFeedbackModal
                    visible={feedbackModal.visible}
                    type={feedbackModal.type}
                    title={feedbackModal.title}
                    message={feedbackModal.message}
                    primaryAction={feedbackModal.primaryAction}
                    onClose={() => setFeedbackModal(prev => ({ ...prev, visible: false }))}
                />
            </View>
        );
    }

    // Reading Phase with Tappable Words
    if (step === 'reading' && story) {
        // Split story into words while preserving punctuation
        const words = story.story.split(/(\s+)/);

        return (
            <View style={styles.container}>
                <ScrollView contentContainerStyle={styles.readingContent}>
                    <View style={styles.storyCard}>
                        <Text style={styles.storyTitle}>{story.title}</Text>
                        <View style={styles.storyTextContainer}>
                            {words.map((word, index) => {
                                const isSpace = /^\s+$/.test(word);
                                if (isSpace) {
                                    return <Text key={index}> </Text>;
                                }

                                const cleanWord = word.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
                                const isAdded = addedWords.has(cleanWord);
                                const punctuation = word.match(/[^a-zA-Z'-]+$/)?.[0] || '';
                                const wordOnly = word.replace(/[^a-zA-Z'-]+$/, '');

                                return (
                                    <Text key={index}>
                                        <Text
                                            style={[
                                                styles.tappableWord,
                                                isAdded && styles.addedWord,
                                            ]}
                                            onPress={() => handleWordTap(wordOnly)}
                                        >
                                            {wordOnly}
                                        </Text>
                                        {punctuation}
                                    </Text>
                                );
                            })}
                        </View>
                        <Text style={styles.tapHint}>💡 Нажмите на любое слово для перевода</Text>
                    </View>

                    {addedWords.size > 0 && (
                        <View style={styles.addedWordsInfo}>
                            <Text style={styles.addedWordsText}>
                                📚 {addedWords.size} {addedWords.size === 1 ? 'слово добавлено' : 'слов добавлено'} в словарь
                            </Text>
                        </View>
                    )}

                    <Pressable style={styles.primaryButton} onPress={startQuestions}>
                        <Text style={styles.primaryButtonText}>Перейти к вопросам →</Text>
                    </Pressable>
                </ScrollView>

                {/* Word Lookup Modal */}
                <Modal visible={showWordModal} transparent animationType="fade">
                    <Pressable style={styles.modalOverlay} onPress={() => setShowWordModal(false)}>
                        <Pressable style={styles.wordModalContent} onPress={e => e.stopPropagation()}>
                            <Text style={styles.wordModalTitle}>{wordLookup?.word}</Text>
                            {wordLookup?.isLoading ? (
                                <ActivityIndicator color={colors.primary[300]} style={{ marginVertical: spacing.lg }} />
                            ) : (
                                <>
                                    {/* Russian Translation */}
                                    <View style={styles.translationBox}>
                                        <Text style={styles.translationLabel}>Перевод:</Text>
                                        <Text style={styles.translationText}>{wordLookup?.translation}</Text>
                                    </View>

                                    {/* English Definition */}
                                    <View style={styles.definitionBox}>
                                        <Text style={styles.definitionLabel}>Definition:</Text>
                                        <Text style={styles.definitionText}>{wordLookup?.definition}</Text>
                                    </View>

                                    {/* CEFR Level */}
                                    <View style={styles.cefrBox}>
                                        <Text style={styles.cefrLabel}>Уровень: </Text>
                                        <Text style={styles.cefrValue}>{wordLookup?.cefrLevel}</Text>
                                    </View>

                                    {!addedWords.has(wordLookup?.word || '') ? (
                                        <Pressable style={styles.addWordButton} onPress={addWordToDictionary}>
                                            <Text style={styles.addWordButtonText}>+ Добавить в словарь</Text>
                                        </Pressable>
                                    ) : (
                                        <Text style={styles.alreadyAdded}>✓ Добавлено в словарь</Text>
                                    )}
                                </>
                            )}
                        </Pressable>
                    </Pressable>
                </Modal>
                <UnifiedFeedbackModal
                    visible={feedbackModal.visible}
                    type={feedbackModal.type}
                    title={feedbackModal.title}
                    message={feedbackModal.message}
                    primaryAction={feedbackModal.primaryAction}
                    onClose={() => setFeedbackModal(prev => ({ ...prev, visible: false }))}
                />
            </View>
        );
    }

    // Questions Phase
    if (step === 'questions' && story) {
        const currentQuestion = story.questions[currentQuestionIndex];

        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.progress}>
                        Вопрос {currentQuestionIndex + 1} из {story.questions.length}
                    </Text>
                    <View style={styles.headerProgressBar}>
                        <VProgress
                            progress={(currentQuestionIndex + 1) / story.questions.length}
                            height={6}
                            color={colors.primary[400]}
                        />
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.questionContent}>
                    <View style={styles.questionCard}>
                        <Text style={styles.questionText}>{currentQuestion.question}</Text>
                    </View>

                    {currentFeedback ? (
                        <View style={styles.feedbackContainer}>
                            <View style={[
                                styles.feedbackCard,
                                results[results.length - 1]?.isCorrect ? styles.correctFeedback : styles.incorrectFeedback
                            ]}>
                                <Text style={styles.feedbackEmoji}>
                                    {results[results.length - 1]?.isCorrect ? '✅' : '❌'}
                                </Text>
                                <Text style={styles.feedbackText}>{currentFeedback}</Text>
                                <Text style={styles.correctAnswerLabel}>Правильный ответ:</Text>
                                <Text style={styles.correctAnswer}>{currentQuestion.correctAnswer}</Text>
                            </View>
                            <Pressable style={styles.primaryButton} onPress={nextQuestion}>
                                <Text style={styles.primaryButtonText}>
                                    {currentQuestionIndex < story.questions.length - 1 ? 'Следующий вопрос →' : 'Результаты →'}
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.answerContainer}>
                            <TextInput
                                style={styles.answerInput}
                                value={userAnswer}
                                onChangeText={setUserAnswer}
                                placeholder="Введите ваш ответ..."
                                placeholderTextColor={colors.text.tertiary}
                                multiline
                            />
                            <Pressable
                                style={[styles.primaryButton, !userAnswer.trim() && styles.disabledButton]}
                                onPress={submitAnswer}
                                disabled={!userAnswer.trim() || isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color={colors.text.inverse} />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Проверить</Text>
                                )}
                            </Pressable>
                        </View>
                    )}
                </ScrollView>
            </View>
        );
    }

    // Results Phase
    if (step === 'results') {
        const correctCount = results.filter(r => r.isCorrect).length;
        const totalQuestions = results.length;
        const percentage = Math.round((correctCount / totalQuestions) * 100);
        const xpEarned = percentage >= 70 ? XP_REWARDS.STORY_PERFECT : XP_REWARDS.STORY_COMPLETE;

        // Add XP
        useEffect(() => {
            addXP(xpEarned);
        }, []);

        return (
            <>
                <CompletionScreen
                    score={correctCount}
                    total={totalQuestions}
                    xpEarned={xpEarned}
                    newWordsCount={addedWords.size}
                    onRestart={restart}
                    onHome={() => navigation.goBack()}
                    title="История прочитана!"
                    message={percentage >= 70
                        ? 'Отлично! Вы хорошо поняли историю!'
                        : 'Продолжайте читать и практиковаться!'}
                />
            </>
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
        display: 'flex',
        padding: spacing.xl,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerProgressBar: {
        flex: 1,
        marginLeft: spacing.md,
    },
    title: {
        ...typography.h1,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    progress: {
        ...typography.h3,
        color: colors.text.primary,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: spacing.lg,
        gap: spacing.md,
    },
    topicCard: {
        width: '47%',
        padding: spacing.xl,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
    },
    topicEmoji: {
        fontSize: 32,
        marginBottom: spacing.sm,
    },
    topicLabel: {
        ...typography.body,
        fontWeight: '600',
        color: colors.text.primary,
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
    readingContent: {
        padding: spacing.lg,
        gap: spacing.lg,
    },
    storyCard: {
        padding: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
    },
    storyTitle: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    storyTextContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tappableWord: {
        ...typography.body,
        color: colors.text.primary,  // Preserve text color
        lineHeight: 32,
        textDecorationLine: 'underline',
        textDecorationStyle: 'dotted',
        textDecorationColor: 'rgba(255, 255, 255, 0.3)',  // Subtle dotted underline
    },
    addedWord: {
        textDecorationColor: colors.primary[300],  // Green underline for added words
    },
    tapHint: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginTop: spacing.lg,
        textAlign: 'center',
    },
    addedWordsInfo: {
        backgroundColor: `${colors.primary[300]}20`,
        borderRadius: borderRadius.md,
        padding: spacing.md,
    },
    addedWordsText: {
        ...typography.bodySmall,
        color: colors.primary[300],
        textAlign: 'center',
    },
    primaryButton: {
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    wordModalContent: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xxl,
        padding: spacing.xxl,
        width: '100%',
        maxWidth: 340,
    },
    wordModalTitle: {
        ...typography.h1,
        color: colors.text.primary,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    translationBox: {
        backgroundColor: `${colors.primary[300]}15`,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    translationLabel: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginBottom: spacing.xs,
    },
    translationText: {
        ...typography.h3,
        color: colors.primary[300],
    },
    definitionBox: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    definitionLabel: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginBottom: spacing.xs,
    },
    definitionText: {
        ...typography.body,
        color: colors.text.secondary,
    },
    cefrBox: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    cefrLabel: {
        ...typography.bodySmall,
        color: colors.text.tertiary,
    },
    cefrValue: {
        ...typography.bodyBold,
        color: colors.accent.blue,
    },
    addWordButton: {
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    addWordButtonText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
    },
    alreadyAdded: {
        ...typography.body,
        color: colors.accent.green,
        textAlign: 'center',
    },
    questionContent: {
        padding: spacing.xl,
        gap: spacing.lg,
    },
    questionCard: {
        padding: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
    },
    questionText: {
        ...typography.h3,
        color: colors.text.primary,
        textAlign: 'center',
    },
    answerContainer: {
        gap: spacing.lg,
    },
    answerInput: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        ...typography.body,
        color: colors.text.primary,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    feedbackContainer: {
        gap: spacing.lg,
    },
    feedbackCard: {
        padding: spacing.xl,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
    },
    correctFeedback: {
        borderLeftWidth: 4,
        borderLeftColor: colors.accent.green,
    },
    incorrectFeedback: {
        borderLeftWidth: 4,
        borderLeftColor: colors.accent.red,
    },
    feedbackEmoji: {
        fontSize: 40,
        marginBottom: spacing.md,
    },
    feedbackText: {
        ...typography.body,
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    correctAnswerLabel: {
        ...typography.caption,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    correctAnswer: {
        ...typography.body,
        color: colors.primary[300],
        fontWeight: '600',
        textAlign: 'center',
    },
    resultsContent: {
        flex: 1,
        padding: spacing.xl,
        justifyContent: 'center',
        gap: spacing.xl,
    },
    resultsCard: {
        padding: spacing.xxxl,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xxl,
    },
    resultsEmoji: {
        fontSize: 60,
        marginBottom: spacing.lg,
    },
    resultsScore: {
        ...typography.h1,
        fontSize: 48,
        color: colors.primary[300],
    },
    resultsPercentage: {
        ...typography.h3,
        color: colors.text.secondary,
        marginBottom: spacing.lg,
    },
    xpEarned: {
        backgroundColor: `${colors.accent.amber}20`,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        marginBottom: spacing.lg,
    },
    xpText: {
        ...typography.bodyBold,
        color: colors.accent.amber,
    },
    wordsAddedText: {
        ...typography.bodySmall,
        color: colors.primary[300],
        marginBottom: spacing.lg,
    },
    resultsMessage: {
        ...typography.body,
        color: colors.text.primary,
        textAlign: 'center',
    },
});
