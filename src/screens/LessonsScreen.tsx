// src/screens/LessonsScreen.tsx
// Auto-generated lessons - always generates content based on words, grammar, or user level

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, Pressable, ActivityIndicator, Animated, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { colors, spacing, borderRadius, typography } from '@/lib/design/theme';
import { VButton, VCard, VProgress, playSound, useShake, usePulse } from '@/components/ui/DesignSystem';
import { ExerciseHeader, WrongAnswerFlash } from '@/components/ui/SharedComponents';
import { addXP, XP_REWARDS, getSettings } from '@/services/storageService';
import { unifiedAI } from '@/services/unifiedAIManager';
import {
    getWordsForPractice,
    updateWordMetrics,
    DictionaryWord,
    getGrammarForPractice,
    GrammarConcept,
    updateGrammarMetrics,
    addWord
} from '@/services/database';
import TappableText from '@/components/ui/TappableText';

// No hardcoded words - all content is AI-generated

type ExerciseType = 'fill-blank' | 'matching' | 'translation' | 'listening' | 'multiple-choice' | 'sentence-build';

interface Exercise {
    id: string;
    type: ExerciseType;
    question: string;
    correctAnswer: string;
    hint?: string;
    options?: string[];
    pairs?: { word: string; translation: string }[];
    word?: DictionaryWord;
    grammarConcept?: GrammarConcept;
    isNewWord?: boolean;
}

interface LessonProgress {
    current: number;
    total: number;
    correct: number;
    xpEarned: number;
}

export default function LessonsScreen() {
    const navigation = useNavigation<any>();
    const [isLoading, setIsLoading] = useState(true);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState<LessonProgress>({ current: 0, total: 0, correct: 0, xpEarned: 0 });
    const [userAnswer, setUserAnswer] = useState('');
    const [selectedPairs, setSelectedPairs] = useState<Map<string, string>>(new Map());
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [lessonComplete, setLessonComplete] = useState(false);
    const [userLevel, setUserLevel] = useState<string>('B1');
    const [shuffledTranslations, setShuffledTranslations] = useState<string[]>([]);  // Prevent re-shuffle on render
    const [selectedWord, setSelectedWord] = useState<string | null>(null);  // For matching pairs
    const [wrongFlashVisible, setWrongFlashVisible] = useState(false);  // Red flash on wrong answer
    const [error, setError] = useState<string | null>(null);  // Error message for AI failures

    const { shakeAnim, shake } = useShake();
    const { pulseAnim, pulse } = usePulse();

    useEffect(() => {
        generateLesson();
    }, []);

    const generateLesson = async () => {
        setIsLoading(true);
        try {
            const settings = await getSettings();
            const level = settings.cefrLevel || 'B1';
            setUserLevel(level);

            // Get words from dictionary
            let words = await getWordsForPractice(5, false);
            const grammar = await getGrammarForPractice(2);

            const newExercises: Exercise[] = [];
            let exerciseId = 0;

            // If dictionary is empty, generate words using AI
            if (words.length === 0) {
                // Try AI generation first
                const aiWordPrompt = `Generate 5 English words appropriate for CEFR level ${level} learner.
Each word should have its Russian translation.
Output JSON array only: [{"word": "...", "translation": "..."}]`;

                try {
                    const response = await unifiedAI.generateText(aiWordPrompt, { jsonMode: true });
                    if (response.success) {
                        const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                        const aiWords = JSON.parse(cleaned);
                        for (const w of aiWords.slice(0, 5)) {
                            const fakeWord: DictionaryWord = {
                                id: `temp_${exerciseId++}`,
                                text: w.word,
                                translation: w.translation,
                                definition: w.word,
                                cefrLevel: level,
                                status: 'new',
                                timesShown: 0,
                                timesCorrect: 0,
                                lastReviewedAt: null,
                                nextReviewAt: Date.now(),
                                createdAt: Date.now(),
                                source: 'lesson',
                                translationCorrect: 0,
                                translationWrong: 0,
                                matchingCorrect: 0,
                                matchingWrong: 0,
                                lessonCorrect: 0,
                                lessonWrong: 0,
                                reviewCount: 0,
                                masteryScore: 0,
                            };
                            words.push(fakeWord);
                        }
                    }
                } catch (e) {
                    setError('Не удалось сгенерировать слова. Проверьте подключение к AI или добавьте слова в словарь.');
                    setIsLoading(false);
                    return;
                }

                if (words.length === 0) {
                    setError('AI не вернул слова. Попробуйте ещё раз или добавьте слова в словарь.');
                    setIsLoading(false);
                    return;
                }
            }

            // Generate exercises from words
            for (let i = 0; i < Math.min(words.length, 5); i++) {
                const word = words[i];
                const isNewWord = word.id.startsWith('temp_');
                const exerciseTypes: ExerciseType[] = ['fill-blank', 'translation', 'multiple-choice', 'listening'];
                const type = exerciseTypes[i % exerciseTypes.length];

                switch (type) {
                    case 'fill-blank':
                        try {
                            const result = await unifiedAI.generateSentenceForWord(word.text, word.translation, word.cefrLevel || level);
                            newExercises.push({
                                id: `ex_${exerciseId++}`,
                                type: 'fill-blank',
                                question: result?.sentence || `The _____ is very important.`,
                                correctAnswer: result?.missingWord || word.text,
                                hint: word.translation,
                                word,
                                isNewWord,
                            });
                        } catch {
                            newExercises.push({
                                id: `ex_${exerciseId++}`,
                                type: 'fill-blank',
                                question: `I need to _____ this task.`,
                                correctAnswer: word.text,
                                hint: word.translation,
                                word,
                                isNewWord,
                            });
                        }
                        break;

                    case 'translation':
                        newExercises.push({
                            id: `ex_${exerciseId++}`,
                            type: 'translation',
                            question: word.translation,
                            correctAnswer: word.text,
                            word,
                            isNewWord,
                        });
                        break;

                    case 'multiple-choice':
                        const otherWords = words.filter(w => w.id !== word.id).slice(0, 3).map(w => w.text);
                        const allOptions = [...otherWords, word.text];
                        while (allOptions.length < 4) {
                            allOptions.push(['example', 'answer', 'question', 'result'][allOptions.length]);
                        }
                        newExercises.push({
                            id: `ex_${exerciseId++}`,
                            type: 'multiple-choice',
                            question: `Выберите перевод: "${word.translation}"`,
                            correctAnswer: word.text,
                            options: allOptions.sort(() => Math.random() - 0.5),
                            word,
                            isNewWord,
                        });
                        break;

                    case 'listening':
                        newExercises.push({
                            id: `ex_${exerciseId++}`,
                            type: 'listening',
                            question: 'Напишите услышанное слово:',
                            correctAnswer: word.text,
                            hint: word.translation,
                            word,
                            isNewWord,
                        });
                        break;
                }
            }

            // Add matching exercise
            if (words.length >= 3) {
                newExercises.push({
                    id: `ex_${exerciseId++}`,
                    type: 'matching',
                    question: 'Соедините слова с переводами:',
                    correctAnswer: '',
                    pairs: words.slice(0, 4).map(w => ({ word: w.text, translation: w.translation })),
                });
            }

            // Add sentence-build
            if (words.length > 0) {
                const word = words[0];
                const sentence = `I want to ${word.text} today`;
                newExercises.push({
                    id: `ex_${exerciseId++}`,
                    type: 'sentence-build',
                    question: 'Составьте предложение:',
                    correctAnswer: sentence,
                    options: sentence.split(' ').sort(() => Math.random() - 0.5),
                    hint: word.translation,
                    word,
                });
            }

            // Add grammar exercises from grammar concepts needing practice
            if (grammar.length > 0) {
                for (const gc of grammar.slice(0, 2)) {
                    // Generate a grammar fill-blank exercise
                    const examples = JSON.parse(gc.examples || '[]') as string[];
                    if (examples.length > 0) {
                        const example = examples[Math.floor(Math.random() * examples.length)];
                        // Find key word/phrase to blank out
                        const blankWord = example.split(' ').find(w => w.length > 3) || example.split(' ')[0];
                        const blanked = example.replace(blankWord, '_____');

                        newExercises.push({
                            id: `ex_${exerciseId++}`,
                            type: 'fill-blank',
                            question: `📚 ${gc.nameRu}\n${blanked}`,
                            correctAnswer: blankWord.toLowerCase().replace(/[.,!?]/g, ''),
                            hint: gc.description,
                            grammarConcept: gc,
                        });
                    }
                }
            }

            const shuffled = newExercises.sort(() => Math.random() - 0.5);
            setExercises(shuffled);
            setProgress({ current: 0, total: shuffled.length, correct: 0, xpEarned: 0 });

            // Pre-shuffle translations for first matching exercise
            const firstMatching = shuffled.find(e => e.type === 'matching');
            if (firstMatching?.pairs) {
                const translations = firstMatching.pairs.map(p => p.translation).sort(() => Math.random() - 0.5);
                setShuffledTranslations(translations);
            }
        } catch (error) {
            console.error('Error generating lesson:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const currentExercise = exercises[currentIndex];

    const speakWord = async (text: string) => {
        if (isSpeaking) {
            await Speech.stop();
            setIsSpeaking(false);
            return;
        }
        setIsSpeaking(true);
        await Speech.speak(text, {
            language: 'en-US',
            rate: 0.85,
            onDone: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
        });
    };

    const checkAnswer = async () => {
        if (!currentExercise) return;

        let correct = false;
        const userInput = userAnswer.toLowerCase().trim();
        const expected = currentExercise.correctAnswer.toLowerCase().trim();

        switch (currentExercise.type) {
            case 'fill-blank':
            case 'translation':
            case 'listening':
                correct = userInput === expected || userInput.includes(expected) || expected.includes(userInput);
                break;
            case 'multiple-choice':
                correct = userAnswer === currentExercise.correctAnswer;
                break;
            case 'matching':
                if (currentExercise.pairs) {
                    correct = currentExercise.pairs.every(p => selectedPairs.get(p.word) === p.translation);
                }
                break;
            case 'sentence-build':
                correct = userInput === expected;
                break;
        }

        setIsCorrect(correct);
        setShowResult(true);

        // Update word metrics (only for real dictionary words)
        if (currentExercise.word && !currentExercise.isNewWord) {
            await updateWordMetrics(currentExercise.word.id, 'lesson', correct);
        }

        // Update grammar concept metrics
        if (currentExercise.grammarConcept) {
            await updateGrammarMetrics(currentExercise.grammarConcept.id, correct);
        }

        // If new word and correct, add to dictionary
        if (currentExercise.isNewWord && currentExercise.word && correct) {
            try {
                await addWord({
                    text: currentExercise.word.text,
                    translation: currentExercise.word.translation,
                    definition: currentExercise.word.text,
                    cefrLevel: userLevel,
                    status: 'learning',
                    timesShown: 1,
                    timesCorrect: 1,
                    lastReviewedAt: Date.now(),
                    nextReviewAt: Date.now() + 24 * 60 * 60 * 1000,
                    source: 'lesson',
                    translationCorrect: 0,
                    translationWrong: 0,
                    matchingCorrect: 0,
                    matchingWrong: 0,
                    lessonCorrect: 1,
                    lessonWrong: 0,
                    reviewCount: 1,
                    masteryScore: 0.1,
                });
            } catch { /* Word may already exist */ }
        }

        if (correct) {
            pulse();
            playSound('correct');
            const xp = XP_REWARDS.WORD_CORRECT;
            await addXP(xp);
            setProgress(p => ({ ...p, correct: p.correct + 1, xpEarned: p.xpEarned + xp }));
        } else {
            shake();
            playSound('wrong');
            // Trigger red flash overlay
            setWrongFlashVisible(true);
            setTimeout(() => setWrongFlashVisible(false), 500);
        }
    };

    const nextExercise = () => {
        if (currentIndex < exercises.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(p => ({ ...p, current: p.current + 1 }));
            setUserAnswer('');
            setSelectedPairs(new Map());
            setShowResult(false);
            setIsCorrect(false);
            setSelectedWord(null);

            // Shuffle translations for next matching exercise
            const nextEx = exercises[currentIndex + 1];
            if (nextEx?.type === 'matching' && nextEx.pairs) {
                const shuffled = [...nextEx.pairs.map(p => p.translation)].sort(() => Math.random() - 0.5);
                setShuffledTranslations(shuffled);
            } else {
                setShuffledTranslations([]);
            }
        } else {
            setLessonComplete(true);
            playSound('levelup');
        }
    };

    const handleMatchSelect = (word: string, translation: string) => {
        const newPairs = new Map(selectedPairs);
        if (newPairs.get(word) === translation) {
            newPairs.delete(word);
        } else {
            newPairs.set(word, translation);
        }
        setSelectedPairs(newPairs);
    };

    // ============ LOADING ============
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary[300]} />
                    <Text style={styles.loadingText}>Генерация урока...</Text>
                    <Text style={styles.loadingSubtext}>Уровень: {userLevel}</Text>
                </View>
            </SafeAreaView>
        );
    }

    // ============ ERROR ============
    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>⚠️</Text>
                    <Text style={[styles.loadingText, { color: colors.accent.red }]}>{error}</Text>
                    <View style={{ marginTop: spacing.xl, gap: spacing.md, width: '100%', paddingHorizontal: spacing.xl }}>
                        <VButton title="Попробовать снова" onPress={() => { setError(null); generateLesson(); }} fullWidth />
                        <VButton title="Назад" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // ============ LESSON COMPLETE ============
    if (lessonComplete) {
        const percentage = Math.round((progress.correct / progress.total) * 100);
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.completeContainer}>
                    <VCard style={styles.completeCard}>
                        <Text style={styles.completeEmoji}>
                            {percentage >= 80 ? '🎉' : percentage >= 50 ? '👍' : '📝'}
                        </Text>
                        <Text style={styles.completeTitle}>Урок завершён!</Text>
                        <Text style={styles.completeScore}>
                            {progress.correct}/{progress.total} правильно ({percentage}%)
                        </Text>

                        <View style={styles.xpBadge}>
                            <Text style={styles.xpBadgeText}>+{progress.xpEarned} XP</Text>
                        </View>

                        <View style={styles.completeButtons}>
                            <VButton title="Ещё урок" variant="success" onPress={() => {
                                setLessonComplete(false);
                                setCurrentIndex(0);
                                setProgress({ current: 0, total: 0, correct: 0, xpEarned: 0 });
                                generateLesson();
                            }} fullWidth />
                            <VButton title="Главная" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
                        </View>
                    </VCard>
                </View>
            </SafeAreaView>
        );
    }

    // ============ EXERCISE SCREEN ============
    return (
        <SafeAreaView style={styles.container}>
            {/* Wrong answer red flash overlay */}
            <WrongAnswerFlash visible={wrongFlashVisible} />

            {/* Header with XP and progress */}
            <ExerciseHeader
                progress={(currentIndex + 1) / exercises.length}
                xpEarned={progress.xpEarned}
                onBack={() => navigation.goBack()}
            />

            <ScrollView contentContainerStyle={styles.exerciseContent}>
                <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                    {/* Exercise Type Badge */}
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>
                            {currentExercise.type === 'fill-blank' && '📝 Заполни пропуск'}
                            {currentExercise.type === 'translation' && '🔄 Переведи'}
                            {currentExercise.type === 'multiple-choice' && '📋 Выбери ответ'}
                            {currentExercise.type === 'listening' && '🎧 Напиши услышанное'}
                            {currentExercise.type === 'matching' && '🔗 Соедини пары'}
                            {currentExercise.type === 'sentence-build' && '🧩 Составь предложение'}
                        </Text>
                    </View>

                    {/* Question Card */}
                    <VCard style={styles.questionCard}>
                        {currentExercise.type === 'listening' && (
                            <Pressable style={styles.playButton} onPress={() => speakWord(currentExercise.correctAnswer)}>
                                <Text style={styles.playIcon}>{isSpeaking ? '🔊' : '🔈'}</Text>
                                <Text style={styles.playText}>Нажми чтобы услышать</Text>
                            </Pressable>
                        )}

                        {/* Use TappableText for sentence exercises */}
                        {['fill-blank', 'sentence-build'].includes(currentExercise.type) ? (
                            <TappableText text={currentExercise.question} style={styles.questionText} />
                        ) : (
                            <Text style={styles.questionText}>{currentExercise.question}</Text>
                        )}

                        {currentExercise.hint && currentExercise.type !== 'matching' && (
                            <View style={styles.hint}>
                                <Text style={styles.hintLabel}>Подсказка:</Text>
                                <Text style={styles.hintText}>{currentExercise.hint}</Text>
                            </View>
                        )}
                    </VCard>

                    {/* Text Input Types */}
                    {['fill-blank', 'translation', 'listening'].includes(currentExercise.type) && (
                        <TextInput
                            style={[styles.answerInput, showResult && (isCorrect ? styles.inputCorrect : styles.inputWrong)]}
                            value={userAnswer}
                            onChangeText={setUserAnswer}
                            placeholder="Введите ответ..."
                            placeholderTextColor={colors.text.tertiary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!showResult}
                            onSubmitEditing={showResult ? nextExercise : checkAnswer}
                        />
                    )}

                    {/* Sentence Build */}
                    {currentExercise.type === 'sentence-build' && currentExercise.options && (
                        <View style={styles.sentenceBuildContainer}>
                            <View style={styles.sentenceResult}>
                                <Text style={styles.sentenceResultText}>{userAnswer || '...'}</Text>
                            </View>
                            <View style={styles.wordChips}>
                                {currentExercise.options.map((word, i) => (
                                    <Pressable
                                        key={i}
                                        style={[styles.wordChip, userAnswer.includes(word) && styles.wordChipUsed]}
                                        onPress={() => !showResult && setUserAnswer(prev => prev ? `${prev} ${word}` : word)}
                                        disabled={showResult || userAnswer.includes(word)}
                                    >
                                        <Text style={styles.wordChipText}>{word}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            {userAnswer && !showResult && (
                                <Pressable onPress={() => setUserAnswer('')} style={styles.clearButton}>
                                    <Text style={styles.clearButtonText}>Очистить</Text>
                                </Pressable>
                            )}
                        </View>
                    )}

                    {/* Multiple Choice */}
                    {currentExercise.type === 'multiple-choice' && currentExercise.options && (
                        <View style={styles.optionsContainer}>
                            {currentExercise.options.map((option, i) => (
                                <Pressable
                                    key={i}
                                    style={[
                                        styles.optionButton,
                                        userAnswer === option && styles.optionSelected,
                                        showResult && option === currentExercise.correctAnswer && styles.optionCorrect,
                                        showResult && userAnswer === option && !isCorrect && styles.optionWrong,
                                    ]}
                                    onPress={() => !showResult && setUserAnswer(option)}
                                    disabled={showResult}
                                >
                                    <Text style={[styles.optionText, userAnswer === option && styles.optionTextSelected]}>{option}</Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* Matching - word pair connection */}
                    {currentExercise.type === 'matching' && currentExercise.pairs && (
                        <View style={styles.matchingContainer}>
                            <View style={styles.matchingColumn}>
                                <Text style={styles.matchingLabel}>English</Text>
                                {currentExercise.pairs.map((pair, i) => {
                                    const isWordSelected = selectedWord === pair.word;
                                    const isWordMatched = selectedPairs.has(pair.word);
                                    return (
                                        <Pressable
                                            key={`w_${i}`}
                                            style={[
                                                styles.matchingItem,
                                                isWordSelected && styles.matchingItemActive,
                                                isWordMatched && styles.matchingItemMatched,
                                            ]}
                                            onPress={() => {
                                                if (!showResult && !isWordMatched) {
                                                    speakWord(pair.word);
                                                    setSelectedWord(pair.word);
                                                }
                                            }}
                                            disabled={showResult || isWordMatched}
                                        >
                                            <Text style={[
                                                styles.matchingItemText,
                                                isWordMatched && styles.matchingItemTextMatched
                                            ]}>{pair.word}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <View style={styles.matchingColumn}>
                                <Text style={styles.matchingLabel}>Русский</Text>
                                {(shuffledTranslations.length > 0 ? shuffledTranslations : currentExercise.pairs.map(p => p.translation)).map((translation, i) => {
                                    const isTranslationMatched = [...selectedPairs.values()].includes(translation);
                                    return (
                                        <Pressable
                                            key={`t_${i}`}
                                            style={[
                                                styles.matchingItem,
                                                selectedWord && !isTranslationMatched && styles.matchingItemHighlight,
                                                isTranslationMatched && styles.matchingItemMatched,
                                            ]}
                                            onPress={() => {
                                                if (selectedWord && !showResult && !isTranslationMatched) {
                                                    handleMatchSelect(selectedWord, translation);
                                                    setSelectedWord(null);
                                                }
                                            }}
                                            disabled={showResult || isTranslationMatched}
                                        >
                                            <Text style={[
                                                styles.matchingItemText,
                                                isTranslationMatched && styles.matchingItemTextMatched
                                            ]}>{translation}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Result Feedback */}
                    {showResult && (
                        <Animated.View style={[styles.resultCard, isCorrect ? styles.resultCorrect : styles.resultWrong, { transform: [{ scale: pulseAnim }] }]}>
                            <Text style={styles.resultEmoji}>{isCorrect ? '✅' : '❌'}</Text>
                            <Text style={styles.resultText}>
                                {isCorrect ? 'Правильно!' : `Ответ: ${currentExercise.correctAnswer}`}
                            </Text>
                        </Animated.View>
                    )}
                </Animated.View>
            </ScrollView>

            {/* Bottom Action */}
            <View style={styles.bottomActions}>
                <VButton
                    title={showResult ? 'Далее →' : 'Проверить'}
                    variant={showResult ? (isCorrect ? 'success' : 'danger') : 'primary'}
                    onPress={showResult ? nextExercise : checkAnswer}
                    disabled={!showResult && !userAnswer.trim() && currentExercise.type !== 'matching'}
                    fullWidth
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, backgroundColor: colors.surface },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    backText: { fontSize: 24, color: colors.text.primary },
    headerTitle: { ...typography.h3, color: colors.text.primary },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: spacing.md, color: colors.text.primary, ...typography.h3 },
    loadingSubtext: { color: colors.text.secondary, ...typography.body },
    xpMini: { backgroundColor: `${colors.accent.amber}20`, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
    xpMiniText: { ...typography.caption, color: colors.accent.amber, fontWeight: '700' },

    exerciseContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xl, gap: spacing.lg },
    typeBadge: { alignSelf: 'flex-start', backgroundColor: colors.surfaceElevated, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginBottom: spacing.lg },
    typeBadgeText: { ...typography.caption, color: colors.text.secondary },

    questionCard: { padding: spacing.lg, marginHorizontal: 0 },
    questionText: { ...typography.h3, color: colors.text.primary, lineHeight: 30 },

    playButton: { alignItems: 'center', padding: spacing.xl, backgroundColor: `${colors.accent.blue}10`, borderRadius: borderRadius.lg, marginBottom: spacing.lg },
    playIcon: { fontSize: 48 },
    playText: { ...typography.bodySmall, color: colors.accent.blue, marginTop: spacing.sm },

    hint: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md },
    hintLabel: { ...typography.caption, color: colors.text.tertiary },
    hintText: { ...typography.body, color: colors.text.secondary },

    answerInput: { marginTop: spacing.lg, backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.lg, padding: spacing.lg, ...typography.h3, color: colors.text.primary, textAlign: 'center', borderWidth: 3, borderColor: colors.border.medium },
    inputCorrect: { borderColor: colors.accent.green, backgroundColor: `${colors.accent.green}10` },
    inputWrong: { borderColor: colors.accent.red, backgroundColor: `${colors.accent.red}10` },

    sentenceBuildContainer: { gap: spacing.lg },
    sentenceResult: { backgroundColor: colors.surfaceElevated, padding: spacing.lg, borderRadius: borderRadius.lg, minHeight: 60 },
    sentenceResultText: { ...typography.body, color: colors.text.primary, textAlign: 'center' },
    wordChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
    wordChip: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 2, borderColor: colors.border.light },
    wordChipUsed: { opacity: 0.4 },
    wordChipText: { ...typography.body, color: colors.text.primary },
    clearButton: { alignSelf: 'center' },
    clearButtonText: { ...typography.bodySmall, color: colors.accent.red },

    optionsContainer: { marginTop: spacing.lg, gap: spacing.md },
    optionButton: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 2, borderColor: colors.border.light, borderBottomWidth: 4, borderBottomColor: colors.border.medium },
    optionSelected: { borderColor: colors.primary[300], backgroundColor: `${colors.primary[300]}10` },
    optionCorrect: { borderColor: colors.accent.green, backgroundColor: `${colors.accent.green}15` },
    optionWrong: { borderColor: colors.accent.red, backgroundColor: `${colors.accent.red}15` },
    optionText: { ...typography.body, color: colors.text.primary, textAlign: 'center' },
    optionTextSelected: { color: colors.primary[300], fontWeight: '700' },

    matchingContainer: { flexDirection: 'row', gap: spacing.md },
    matchingColumn: { flex: 1, gap: spacing.sm },
    matchingLabel: { ...typography.caption, color: colors.text.tertiary, textAlign: 'center', marginBottom: spacing.xs },
    matchingItem: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 2,
        borderColor: colors.border.light,
        borderBottomWidth: 4,
        borderBottomColor: colors.border.medium,
        minHeight: 48,
        justifyContent: 'center',
    },
    matchingItemActive: {
        borderColor: colors.primary[300],
        backgroundColor: `${colors.primary[300]}15`,
        transform: [{ scale: 1.02 }],
    },
    matchingItemHighlight: {
        borderColor: colors.accent.amber,
        borderStyle: 'dashed',
    },
    matchingItemMatched: {
        borderColor: colors.accent.green,
        backgroundColor: `${colors.accent.green}15`,
        opacity: 0.7,
    },
    matchingItemSelected: { borderColor: colors.primary[300], backgroundColor: `${colors.primary[300]}10` },
    matchingItemText: { ...typography.body, color: colors.text.primary, textAlign: 'center' },
    matchingItemTextMatched: { color: colors.accent.green },

    resultCard: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: borderRadius.lg, gap: spacing.md },
    resultCorrect: { backgroundColor: `${colors.accent.green}20` },
    resultWrong: { backgroundColor: `${colors.accent.red}20` },
    resultEmoji: { fontSize: 28 },
    resultText: { ...typography.body, color: colors.text.primary, flex: 1 },

    bottomActions: { padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border.light },

    completeContainer: { flex: 1, justifyContent: 'center', padding: spacing.xl },
    completeCard: { alignItems: 'center', padding: spacing.xxxl },
    completeEmoji: { fontSize: 72, marginBottom: spacing.lg },
    completeTitle: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.sm },
    completeScore: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
    xpBadge: { backgroundColor: `${colors.accent.amber}20`, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, borderRadius: borderRadius.full, marginBottom: spacing.xxl },
    xpBadgeText: { ...typography.h3, color: colors.accent.amber, fontWeight: '800' },
    completeButtons: { width: '100%', gap: spacing.md },
});
