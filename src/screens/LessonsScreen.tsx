// src/screens/LessonsScreen.tsx
// Auto-generated lessons - always generates content based on words, grammar, or user level

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, Pressable, ActivityIndicator, Animated, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { colors, spacing, borderRadius, typography } from '@/lib/design/theme';
import { VButton, VCard, VProgress, playSound, useShake, usePulse } from '@/components/ui/DesignSystem';
import { ExerciseHeader, WrongAnswerFlash, MatchingGame, MatchingWord, CompletionScreen } from '@/components/ui/SharedComponents';
import { addXP, XP_REWARDS, getSettings, updateWordMetrics, addWord } from '@/services/storageService';
import { unifiedAI } from '@/services/unifiedAIManager';
import {
    getWordsForPractice,
    DictionaryWord,
    getGrammarForPractice,
    GrammarConcept,
    updateGrammarMetrics,
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
    const [selectedOptionIndices, setSelectedOptionIndices] = useState<number[]>([]); // Track indices of selected options for sentence-build
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

            // Get words from dictionary (increased to 10)
            let words = await getWordsForPractice(10, false);
            const grammar = await getGrammarForPractice(3);

            const newExercises: Exercise[] = [];
            let exerciseId = 0;

            // Always generate at least 3 random AI words to expand vocabulary
            const aiWordsNeeded = Math.max(3, 10 - words.length);
            const aiWordPrompt = `Generate ${aiWordsNeeded} random English words appropriate for CEFR level ${level} learner.
Each word should have its Russian translation.
Output JSON array only: [{"word": "...", "translation": "..."}]`;

            try {
                const response = await unifiedAI.generateText(aiWordPrompt, { jsonMode: true });
                if (response.success) {
                    const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                    const aiWords = JSON.parse(cleaned);

                    // Create map for strict deduplication (text -> word)
                    const uniqueMap = new Map<string, DictionaryWord>();
                    words.forEach(w => uniqueMap.set(w.text.toLowerCase().trim(), w));

                    for (const w of aiWords.slice(0, aiWordsNeeded)) {
                        const normalizedText = w.word.toLowerCase().trim();

                        // Skip if we already have this word (from DB or previously added AI word)
                        if (uniqueMap.has(normalizedText)) continue;

                        const fakeWord: DictionaryWord = {
                            id: `temp_${exerciseId++}`,
                            text: w.word,
                            translation: w.translation,
                            definition: w.word,
                            cefrLevel: level,
                            status: 'new',
                            timesShown: 0,
                            timesCorrect: 0,
                            timesWrong: 0,
                            lastReviewedAt: null,
                            nextReviewAt: Date.now(),
                            createdAt: Date.now(),
                            source: 'lesson',
                            reviewCount: 0,
                            masteryScore: 0,
                        };

                        words.push(fakeWord);
                        uniqueMap.set(normalizedText, fakeWord);
                    }
                }
            } catch (e) {
                console.log('AI word generation failed:', e);
            }

            if (words.length === 0) {
                setError('Не удалось загрузить слова. Добавьте слова в словарь или проверьте AI.');
                setIsLoading(false);
                return;
            }

            // Generate exercises from words (up to 10 exercises)
            for (let i = 0; i < Math.min(words.length, 10); i++) {
                const word = words[i];
                const isNewWord = word.id.startsWith('temp_');
                const exerciseTypes: ExerciseType[] = ['fill-blank', 'translation', 'multiple-choice', 'listening'];
                const type = exerciseTypes[i % exerciseTypes.length];

                switch (type) {
                    case 'fill-blank':
                        try {
                            // Better prompt to ensure proper blank generation
                            const fillPrompt = `Create a simple English sentence for level ${word.cefrLevel || level} using the word "${word.text}".
The sentence must contain the word "${word.text}" replaced with _____.

Output JSON only:
{
  "sentence": "The _____ was very interesting.",
  "missingWord": "${word.text}",
  "russianTranslation": "Русский перевод предложения"
}

IMPORTANT: The sentence MUST contain _____ as a placeholder for the missing word.`;

                            const result = await unifiedAI.generateText(fillPrompt, { jsonMode: true });
                            if (result.success) {
                                const cleaned = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                                const data = JSON.parse(cleaned);

                                // Ensure the sentence has a blank
                                let sentence = data.sentence || '';
                                if (!sentence.includes('_____') && !sentence.includes('___')) {
                                    // Force add blank if AI didn't include it
                                    sentence = sentence.replace(new RegExp(word.text, 'gi'), '_____');
                                }

                                if (sentence.includes('_____') || sentence.includes('___')) {
                                    newExercises.push({
                                        id: `ex_${exerciseId++}`,
                                        type: 'fill-blank',
                                        question: sentence,
                                        correctAnswer: data.missingWord || word.text,
                                        hint: data.russianTranslation || word.translation,
                                        word,
                                        isNewWord,
                                    });
                                }
                            }
                        } catch {
                            console.log('AI failed to generate fill-blank for:', word.text);
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
                    pairs: words.slice(0, 10).map(w => ({ word: w.text, translation: w.translation })),
                });
            }

            // Add sentence-build - AI generated with Russian translation
            if (words.length > 0) {
                const word = words[0];
                try {
                    const sentencePrompt = `Create a simple English sentence using the word "${word.text}" for a ${level} level learner.
Also provide the Russian translation of the sentence.

Output JSON only:
{
  "englishSentence": "The book was very interesting.",
  "russianSentence": "Книга была очень интересной."
}`;
                    const response = await unifiedAI.generateText(sentencePrompt, { jsonMode: true });
                    if (response.success) {
                        const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                        const data = JSON.parse(cleaned);
                        if (data.englishSentence && data.russianSentence) {
                            // Scramble words for the exercise
                            const wordsArray = data.englishSentence.split(' ');
                            newExercises.push({
                                id: `ex_${exerciseId++}`,
                                type: 'sentence-build',
                                question: data.russianSentence, // Russian translation as the question
                                correctAnswer: data.englishSentence,
                                options: wordsArray.sort(() => Math.random() - 0.5),
                                hint: word.translation,
                                word,
                            });
                        }
                    }
                } catch {
                    console.log('AI failed to generate sentence-build');
                }
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

    const matchingWords = React.useMemo(() => {
        if (currentExercise?.type === 'matching' && currentExercise.pairs) {
            return currentExercise.pairs.map((p, i) => ({
                id: `match_${i}`,
                text: p.word,
                translation: p.translation
            }));
        }
        return [];
    }, [currentExercise?.id]);

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

        // Update word metrics - always update for existing dictionary words
        if (currentExercise.word) {
            const wordId = currentExercise.word.id;

            // For new words (AI-generated temp words), add to dictionary first if answer is wrong
            if (currentExercise.isNewWord && !correct) {
                try {
                    const addedWord = await addWord({
                        text: currentExercise.word.text,
                        translation: currentExercise.word.translation,
                        definition: currentExercise.word.text,
                        cefrLevel: userLevel,
                        status: 'learning',
                        timesShown: 1,
                        timesCorrect: 0,
                        timesWrong: 1,
                        lastReviewedAt: Date.now(),
                        nextReviewAt: Date.now(),
                        source: 'lesson',
                        reviewCount: 1,
                        masteryScore: 0,
                    });
                    console.log('[LessonsScreen] Added wrong word to dictionary:', currentExercise.word.text);
                } catch { /* Word may already exist */ }
            } else if (!currentExercise.isNewWord && !wordId.startsWith('temp_')) {
                // Update metrics for existing dictionary words
                console.log('[LessonsScreen] Updating metrics for:', currentExercise.word.text, 'correct:', correct);
                await updateWordMetrics(wordId, 'lesson', correct);
                console.log('[LessonsScreen] Metrics updated successfully');
            }
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
                    timesWrong: 0,
                    lastReviewedAt: Date.now(),
                    nextReviewAt: Date.now() + 24 * 60 * 60 * 1000,
                    source: 'lesson',
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
            setSelectedOptionIndices([]);
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
        return (
            <CompletionScreen
                score={progress.correct}
                total={progress.total}
                xpEarned={progress.xpEarned}
                onRestart={() => {
                    setLessonComplete(false);
                    setCurrentIndex(0);
                    setProgress({ current: 0, total: 0, correct: 0, xpEarned: 0 });
                    generateLesson();
                }}
                onHome={() => navigation.goBack()}
                title="Урок завершён!"
            />
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

                        {/* Sentence-build: Show Russian sentence as translation task */}
                        {currentExercise.type === 'sentence-build' ? (
                            <View>
                                <Text style={styles.translateLabel}>Переведите на английский:</Text>
                                <Text style={styles.russianSentence}>{currentExercise.question}</Text>
                            </View>
                        ) : (
                            /* Use TappableText for fill-blank (English sentences with blanks) */
                            currentExercise.type === 'fill-blank' ? (
                                <TappableText text={currentExercise.question} style={styles.questionText} />
                            ) : (
                                <Text style={styles.questionText}>{currentExercise.question}</Text>
                            )
                        )}

                        {currentExercise.hint && currentExercise.type !== 'matching' && currentExercise.type !== 'sentence-build' && (
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
                            {/* Instruction label */}
                            <Text style={styles.sentenceBuildInstruction}>Составьте предложение по-английски:</Text>

                            {/* Constructed sentence result */}
                            <View style={styles.sentenceResult}>
                                <Text style={styles.sentenceResultText}>{userAnswer || 'Нажимайте на слова ниже...'}</Text>
                            </View>
                            <View style={styles.wordChips}>
                                {currentExercise.options.map((word, i) => (
                                    <Pressable
                                        key={i}
                                        style={[styles.wordChip, selectedOptionIndices.includes(i) && styles.wordChipUsed]}
                                        onPress={() => {
                                            if (!showResult && !selectedOptionIndices.includes(i)) {
                                                const newIndices = [...selectedOptionIndices, i];
                                                setSelectedOptionIndices(newIndices);
                                                const newSentence = newIndices.map(idx => currentExercise.options![idx]).join(' ');
                                                setUserAnswer(newSentence);
                                            }
                                        }}
                                        disabled={showResult || selectedOptionIndices.includes(i)}
                                    >
                                        <Text style={styles.wordChipText}>{word}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            {userAnswer && !showResult && (
                                <Pressable
                                    onPress={() => {
                                        setUserAnswer('');
                                        setSelectedOptionIndices([]);
                                    }}
                                    style={styles.clearButton}
                                >
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

                    {/* Matching - using Shared MatchingGame */}
                    {currentExercise.type === 'matching' && currentExercise.pairs && (
                        <View style={{ flex: 1, minHeight: 400 }}>
                            <MatchingGame
                                showProgressBar={false}
                                words={matchingWords}
                                totalMatches={currentExercise.pairs.length} // For single exercise, match all pairs
                                visiblePairs={Math.min(4, currentExercise.pairs.length)}
                                onMatch={async (matchId, isCorrect) => {
                                    if (isCorrect) {
                                        playSound('correct');
                                        // Find matched word to update metrics
                                        // Implementation note: we map ID to index above
                                        const index = parseInt(matchId.split('_')[1]);
                                        const pair = currentExercise.pairs![index];
                                        if (pair) {
                                            // Find full dictionary word object if possible, or create stub
                                            // This assumes word text is unique in dictionary
                                            // Ideally we should pass IDs but pair structure is simple here
                                        }
                                    } else {
                                        playSound('wrong');
                                        shake();
                                    }
                                }}
                                onComplete={() => {
                                    // Auto-advance after small delay when all matched
                                    setTimeout(async () => {
                                        pulse();
                                        playSound('levelup');
                                        const xp = XP_REWARDS.EXERCISE_COMPLETE;
                                        await addXP(xp);
                                        setProgress(p => ({ ...p, correct: p.correct + 1, xpEarned: p.xpEarned + xp }));
                                        nextExercise();
                                    }, 1000);
                                }}
                                showTranslation={true}
                            />
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
    loadingText: { marginTop: spacing.md, color: colors.text.primary, ...typography.h3, textAlign: 'center' },
    loadingSubtext: { color: colors.text.secondary, ...typography.body },
    xpMini: { backgroundColor: `${colors.accent.amber}20`, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
    xpMiniText: { ...typography.caption, color: colors.accent.amber, fontWeight: '700' },

    exerciseContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xl, gap: spacing.lg },
    typeBadge: { alignSelf: 'flex-start', backgroundColor: colors.surfaceElevated, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginBottom: spacing.lg },
    typeBadgeText: { ...typography.caption, color: colors.text.secondary },

    questionCard: { padding: spacing.lg, marginHorizontal: 0 },
    questionText: { ...typography.h3, color: colors.text.primary, lineHeight: 30 },
    translateLabel: { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing.sm, textTransform: 'uppercase' },
    russianSentence: { ...typography.h2, color: colors.primary[300], lineHeight: 34, fontWeight: '600' },

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
    sentenceBuildInstruction: { ...typography.bodySmall, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.xs },
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
