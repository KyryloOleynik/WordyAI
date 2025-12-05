import { StyleSheet, Text, View, Modal, Pressable, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import * as Speech from 'expo-speech';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { translateWord, TranslationResult } from '@/services/translationService';
import { addWord, getSettings } from '@/services/storageService';
import Button from './Button';

interface TappableTextProps {
    text: string;
    style?: any;
    onWordAdded?: (word: string) => void;
}

/**
 * TappableText - renders text with clickable words
 * Words are shown with subtle dotted underline, preserving original text color
 * Tapping a word shows translation popup with option to add to dictionary
 */
export default function TappableText({ text, style, onWordAdded }: TappableTextProps) {
    const [selectedWord, setSelectedWord] = useState<TranslationResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showTranslation, setShowTranslation] = useState(true);
    const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Load user preference
    const loadSettings = useCallback(async () => {
        const settings = await getSettings();
        setShowTranslation(settings.showTranslation);
    }, []);

    // Split text into words while preserving spaces and punctuation
    // Filter out empty strings that can appear at start/end
    const tokens = text.split(/(\s+)/).filter(token => token !== '');

    // Get sentence context for the word (5 words before and after)
    const getSentenceContext = (tokenIndex: number): string => {
        const wordTokens = tokens.filter(t => /[a-zA-Z]/.test(t));
        const currentWordIndex = wordTokens.indexOf(tokens[tokenIndex]);
        const start = Math.max(0, currentWordIndex - 5);
        const end = Math.min(wordTokens.length, currentWordIndex + 6);
        return wordTokens.slice(start, end).join(' ');
    };

    const handleWordTap = async (word: string, tokenIndex: number) => {
        const cleanWord = word.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
        if (!cleanWord || cleanWord.length < 2) return;

        setIsLoading(true);
        setShowModal(true);
        await loadSettings();

        try {
            // Get context for better translation
            const context = getSentenceContext(tokenIndex);
            const result = await translateWord(cleanWord, context);
            setSelectedWord(result);
        } catch (error) {
            console.error('Translation error:', error);
            setSelectedWord(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSpeak = async () => {
        if (!selectedWord || isSpeaking) return;

        setIsSpeaking(true);
        try {
            await Speech.speak(selectedWord.word, {
                language: 'en-US',
                rate: 0.8,
                onDone: () => setIsSpeaking(false),
                onError: () => setIsSpeaking(false),
            });
        } catch (error) {
            console.error('Speech error:', error);
            setIsSpeaking(false);
        }
    };

    const handleAddToDictionary = async () => {
        if (!selectedWord) return;

        await addWord({
            text: selectedWord.word,
            definition: selectedWord.definition,
            translation: selectedWord.translation,
            cefrLevel: selectedWord.cefrLevel,
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

        setAddedWords(prev => new Set([...prev, selectedWord.word]));
        onWordAdded?.(selectedWord.word);
        setShowModal(false);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedWord(null);
        Speech.stop();
        setIsSpeaking(false);
    };

    return (
        <>
            <Text style={[styles.container, style]}>
                {tokens.map((token, index) => {
                    const isSpace = /^\s+$/.test(token);
                    if (isSpace) {
                        return <Text key={index}>{token}</Text>;
                    }

                    // Check if this is a word (has letters)
                    const hasLetters = /[a-zA-Z]/.test(token);
                    if (!hasLetters) {
                        return <Text key={index} style={style}>{token}</Text>;
                    }

                    const cleanWord = token.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
                    const isAdded = addedWords.has(cleanWord);
                    const punctuation = token.match(/[^a-zA-Z'-]+$/)?.[0] || '';
                    const wordOnly = token.replace(/[^a-zA-Z'-]+$/, '');

                    return (
                        <Text key={index}>
                            <Text
                                style={[
                                    style,
                                    styles.tappableWord,
                                    isAdded && styles.addedWord,
                                ]}
                                onPress={() => handleWordTap(wordOnly, index)}
                            >
                                {wordOnly}
                            </Text>
                            <Text style={style}>{punctuation}</Text>
                        </Text>
                    );
                })}
            </Text>

            {/* Translation Modal */}
            <Modal visible={showModal} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={closeModal}>
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary[300]} />
                                <Text style={styles.loadingText}>Загрузка...</Text>
                            </View>
                        ) : selectedWord ? (
                            <>
                                {/* Word Header with Pronunciation */}
                                <View style={styles.wordHeader}>
                                    <View style={styles.wordInfo}>
                                        <Text style={styles.wordTitle}>{selectedWord.word}</Text>
                                        {selectedWord.phonetic && (
                                            <Text style={styles.phonetic}>{selectedWord.phonetic}</Text>
                                        )}
                                    </View>
                                    <Pressable
                                        style={[styles.speakButton, isSpeaking && styles.speakButtonActive]}
                                        onPress={handleSpeak}
                                    >
                                        <Text style={styles.speakButtonText}>
                                            {isSpeaking ? '🔊' : '🔈'}
                                        </Text>
                                    </Pressable>
                                </View>
                                {selectedWord.partOfSpeech && (
                                    <Text style={styles.partOfSpeech}>{selectedWord.partOfSpeech}</Text>
                                )}

                                {/* Translation (based on settings) */}
                                <View style={styles.mainContent}>
                                    {showTranslation ? (
                                        // Russian translation
                                        <View style={styles.translationBox}>
                                            <Text style={styles.label}>Перевод:</Text>
                                            <Text style={styles.translation}>{selectedWord.translation}</Text>
                                        </View>
                                    ) : (
                                        // English definition
                                        <View style={styles.definitionBox}>
                                            <Text style={styles.label}>Definition:</Text>
                                            <Text style={styles.definition}>{selectedWord.definition}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Secondary content (the other one) */}
                                <View style={styles.secondaryContent}>
                                    {showTranslation ? (
                                        <View style={styles.definitionBoxSmall}>
                                            <Text style={styles.labelSmall}>Definition:</Text>
                                            <Text style={styles.definitionSmall}>{selectedWord.definition}</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.translationBoxSmall}>
                                            <Text style={styles.labelSmall}>Перевод:</Text>
                                            <Text style={styles.translationSmall}>{selectedWord.translation}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* CEFR Level */}
                                <View style={styles.levelBadge}>
                                    <Text style={styles.levelText}>Уровень: {selectedWord.cefrLevel}</Text>
                                </View>

                                {/* Add to Dictionary button */}
                                {!addedWords.has(selectedWord.word) ? (
                                    <Button
                                        title="+ Добавить в словарь"
                                        onPress={handleAddToDictionary}
                                        variant="primary"
                                        size="medium"
                                    />
                                ) : (
                                    <Text style={styles.addedText}>✓ Добавлено в словарь</Text>
                                )}
                            </>
                        ) : (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorEmoji}>😕</Text>
                                <Text style={styles.errorText}>Не удалось найти перевод</Text>
                                <Button
                                    title="Закрыть"
                                    onPress={closeModal}
                                    variant="secondary"
                                    size="small"
                                />
                            </View>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tappableWord: {
        // Subtle dotted underline - preserves text color
        textDecorationLine: 'underline',
        textDecorationStyle: 'dotted',
        textDecorationColor: 'rgba(255, 255, 255, 0.3)',
    },
    addedWord: {
        textDecorationColor: colors.primary[300],
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xxl,
        padding: spacing.xxl,
        width: '100%',
        maxWidth: 360,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    loadingText: {
        ...typography.body,
        color: colors.text.secondary,
        marginTop: spacing.md,
    },

    // Word Header
    wordHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    wordInfo: {
        flex: 1,
        alignItems: 'center',
    },
    wordTitle: {
        ...typography.h1,
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    phonetic: {
        ...typography.body,
        color: colors.text.tertiary,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    speakButton: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.md,
    },
    speakButtonActive: {
        backgroundColor: colors.primary[300],
    },
    speakButtonText: {
        fontSize: 24,
    },
    partOfSpeech: {
        ...typography.caption,
        color: colors.accent.blue,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.lg,
    },

    // Main content
    mainContent: {
        marginBottom: spacing.md,
    },
    translationBox: {
        backgroundColor: `${colors.primary[300]}15`,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary[300],
    },
    definitionBox: {
        backgroundColor: `${colors.accent.blue}15`,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderLeftWidth: 4,
        borderLeftColor: colors.accent.blue,
    },
    label: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
    },
    translation: {
        ...typography.h3,
        color: colors.primary[300],
    },
    definition: {
        ...typography.body,
        color: colors.text.primary,
        lineHeight: 24,
    },

    // Secondary content
    secondaryContent: {
        marginBottom: spacing.lg,
    },
    translationBoxSmall: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.md,
        padding: spacing.md,
    },
    definitionBoxSmall: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.md,
        padding: spacing.md,
    },
    labelSmall: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginBottom: spacing.xs,
    },
    translationSmall: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    definitionSmall: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },

    // Level badge
    levelBadge: {
        alignSelf: 'center',
        backgroundColor: colors.surfaceElevated,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        marginBottom: spacing.lg,
    },
    levelText: {
        ...typography.bodySmall,
        color: colors.accent.blue,
        fontWeight: '600',
    },

    // Added state
    addedText: {
        ...typography.body,
        color: colors.accent.green,
        textAlign: 'center',
        fontWeight: '600',
    },

    // Error state
    errorContainer: {
        alignItems: 'center',
        padding: spacing.lg,
    },
    errorEmoji: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    errorText: {
        ...typography.body,
        color: colors.text.secondary,
        marginBottom: spacing.lg,
    },
});
