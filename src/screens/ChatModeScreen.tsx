import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Modal, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { unifiedAI } from '@/services/unifiedAIManager';
import TappableText from '@/components/ui/TappableText';
import { LoadingIndicator } from '@/components/ui/SharedComponents';
import { saveChatSession, ChatSession, ChatMessage as StoredMessage, getAllWords } from '@/services/storageService';
import { getGrammarConcepts, GrammarConcept, DictionaryWord } from '@/services/database';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    corrections?: string | null;
    timestamp?: number;
    isStreaming?: boolean;
}

const TOPICS = [
    { id: 'ai_suggested', label: '🤖 AI предлагает', value: 'ai_suggested' },
    { id: 'travel', label: '✈️ Путешествия', value: 'traveling and vacation' },
    { id: 'work', label: '💼 Работа', value: 'work and career' },
    { id: 'hobbies', label: '🎨 Хобби', value: 'hobbies and free time' },
    { id: 'food', label: '🍕 Еда', value: 'food and cooking' },
    { id: 'movies', label: '🎬 Кино', value: 'movies and TV shows' },
    { id: 'daily', label: '🏠 Быт', value: 'daily routines and life' },
    { id: 'custom', label: '✏️ Своя тема', value: 'custom' },
];

export default function ChatModeScreen() {
    const navigation = useNavigation<any>();

    // No more waiting for model - unifiedAI handles backend selection
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [customTopic, setCustomTopic] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [streamingText, setStreamingText] = useState('');
    const [aiTopicLoading, setAiTopicLoading] = useState(false);
    const [aiSuggestedTopic, setAiSuggestedTopic] = useState<string | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    // Save chat session after each assistant message
    const saveSession = async (msgs: ChatMessage[], topic: string, custom?: string) => {
        // Only save if bot has responded (at least 2 messages: bot greeting + user + bot response)
        const hasUserMessage = msgs.some(m => m.role === 'user');
        const hasBotResponse = msgs.filter(m => m.role === 'assistant').length >= 1;
        if (!hasUserMessage || !hasBotResponse) return;

        const id = sessionId || Date.now().toString();
        if (!sessionId) setSessionId(id);

        const session: ChatSession = {
            id,
            topic,
            customTopic: custom,
            messages: msgs.filter(m => !m.isStreaming).map(m => ({
                ...m,
                timestamp: m.timestamp || Date.now(),
            })) as StoredMessage[],
            createdAt: parseInt(id),
            updatedAt: Date.now(),
        };

        await saveChatSession(session);
    };

    // Generate AI topic based on user's dictionary and grammar
    const startAITopic = async () => {
        setAiTopicLoading(true);
        try {
            // Get user's words and grammar concepts
            const words = await getAllWords();
            const grammar = await getGrammarConcepts();

            // Select random words to incorporate
            const recentWords = words.slice(0, 10).map(w => w.text);
            const grammarToReview = grammar.filter(g => g.errorCount > 0 || g.masteryScore < 0.5);

            // Generate topic suggestion
            let topicSuggestion = '';
            if (recentWords.length > 0 || grammarToReview.length > 0) {
                const wordsToUse = recentWords.slice(0, 3).join(', ') || 'everyday topics';
                const grammarToUse = grammarToReview.slice(0, 2).map(g => g.name).join(', ') || '';

                // Create a contextual topic
                if (grammarToUse) {
                    topicSuggestion = `Practice using ${wordsToUse} with ${grammarToUse} structures`;
                } else if (wordsToUse) {
                    topicSuggestion = `Conversation about ${wordsToUse}`;
                } else {
                    topicSuggestion = 'General English conversation practice';
                }
            } else {
                topicSuggestion = 'Getting to know each other - introductions and basic questions';
            }

            setAiSuggestedTopic(topicSuggestion);
            setSelectedTopic(topicSuggestion);

            // Create initial message with words to practice
            const wordsNote = recentWords.length > 0
                ? `\n\nСлова для практики: ${recentWords.slice(0, 5).join(', ')}`
                : '';
            const grammarNote = grammarToReview.length > 0
                ? `\nГрамматика: ${grammarToReview.slice(0, 2).map(g => g.nameRu).join(', ')}`
                : '';

            const initialMessage: ChatMessage = {
                id: '0',
                role: 'assistant',
                content: `🤖 AI выбрал тему для тебя: "${topicSuggestion}"${wordsNote}${grammarNote}\n\nПиши мне на английском, а я буду исправлять ошибки. Попробуй использовать слова из своего словаря!`,
                timestamp: Date.now(),
            };
            setMessages([initialMessage]);
        } catch (error) {
            console.error('Error generating AI topic:', error);
            // Fallback to general topic
            setSelectedTopic('general conversation');
            setMessages([{
                id: '0',
                role: 'assistant',
                content: 'Давай просто поболтаем на английском! Я буду исправлять ошибки. О чём хочешь поговорить?',
                timestamp: Date.now(),
            }]);
        } finally {
            setAiTopicLoading(false);
        }
    };

    const startChat = (topic: typeof TOPICS[0]) => {
        if (topic.id === 'custom') {
            setShowCustomInput(true);
            return;
        }

        if (topic.id === 'ai_suggested') {
            startAITopic();
            return;
        }

        setSelectedTopic(topic.value);
        const initialMessage: ChatMessage = {
            id: '0',
            role: 'assistant',
            content: `Отлично! Давай поговорим о ${topic.label.split(' ').slice(1).join(' ').toLowerCase()}. Пиши мне на английском, а я буду исправлять ошибки и помогать улучшить твой уровень. О чём хочешь поговорить?`,
            timestamp: Date.now(),
        };
        setMessages([initialMessage]);
    };

    const startCustomChat = () => {
        if (!customTopic.trim()) return;

        setSelectedTopic(customTopic);
        setShowCustomInput(false);
        const initialMessage: ChatMessage = {
            id: '0',
            role: 'assistant',
            content: `Отличный выбор - "${customTopic}"! Пиши мне на английском, я буду исправлять ошибки и помогать улучшить твой уровень. Начинай!`,
            timestamp: Date.now(),
        };
        setMessages([initialMessage]);
    };

    const sendMessage = async () => {
        if (!inputText.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputText.trim(),
            timestamp: Date.now(),
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInputText('');
        setIsLoading(true);
        setStreamingText('');

        try {
            // Build prompt for the conversation
            const conversationHistory = newMessages
                .slice(-6)
                .map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.content}`)
                .join('\n');

            const prompt = `You are an English conversation partner helping a Russian speaker practice English.
Topic: ${selectedTopic || 'general conversation'}

Conversation so far:
${conversationHistory}

If the student made grammar or vocabulary mistakes, start with a BRIEF correction in this format:
"❌ [mistake] → ✅ [correction]"

Then continue the conversation naturally. Keep your response SHORT (2-3 sentences max). Be encouraging. Respond in English.`;

            const assistantId = (Date.now() + 1).toString();
            let fullText = '';

            // Add assistant message placeholder
            setMessages(prev => [...prev, {
                id: assistantId,
                role: 'assistant',
                content: '...',
                timestamp: Date.now(),
                isStreaming: true,
            }]);

            // Try streaming first with timeout
            let streamSucceeded = false;
            const streamTimeout = setTimeout(() => {
                if (!streamSucceeded && fullText === '') {
                    // Streaming didn't work, fallback to non-streaming
                    console.log('[Chat] Stream timeout, using non-streaming fallback');
                }
            }, 5000);

            try {
                for await (const { text, source, done } of unifiedAI.generateTextStream(prompt)) {
                    if (done) break;
                    fullText += text;
                    streamSucceeded = true;
                    setStreamingText(fullText);

                    setMessages(prev => prev.map(m =>
                        m.id === assistantId
                            ? { ...m, content: fullText }
                            : m
                    ));
                }
                clearTimeout(streamTimeout);
            } catch (streamError) {
                console.warn('[Chat] Streaming failed, using fallback:', streamError);
                clearTimeout(streamTimeout);
            }

            // If stream didn't produce any text, try non-streaming
            if (!fullText) {
                console.log('[Chat] Using non-streaming fallback');
                const response = await unifiedAI.generateText(prompt);
                fullText = response.success ? response.text : 'AI временно недоступен. Попробуйте позже.';
            }

            // Finalize message
            setMessages(prev => {
                const updated = prev.map(m =>
                    m.id === assistantId
                        ? { ...m, content: fullText, isStreaming: false }
                        : m
                );
                saveSession(updated, selectedTopic || 'general', customTopic || undefined);
                return updated;
            });

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Произошла ошибка. Попробуй ещё раз.',
                    timestamp: Date.now(),
                },
            ]);
        } finally {
            setIsLoading(false);
            setStreamingText('');
        }
    };

    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [messages, streamingText]);

    // unifiedAI is always ready - no model loading needed

    // Custom topic modal
    if (showCustomInput) {
        return (
            <View style={styles.container}>
                <View style={styles.customTopicContainer}>
                    <Text style={styles.title}>Своя тема</Text>
                    <Text style={styles.subtitle}>
                        Напиши тему, о которой хочешь поговорить
                    </Text>
                    <TextInput
                        style={styles.customInput}
                        value={customTopic}
                        onChangeText={setCustomTopic}
                        placeholder="Например: путешествие в Японию..."
                        placeholderTextColor={colors.text.tertiary}
                        autoFocus
                    />
                    <View style={styles.customButtons}>
                        <Pressable
                            style={styles.cancelButton}
                            onPress={() => {
                                setShowCustomInput(false);
                                setCustomTopic('');
                            }}
                        >
                            <Text style={styles.cancelButtonText}>Отмена</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.startButton, !customTopic.trim() && styles.startButtonDisabled]}
                            onPress={startCustomChat}
                            disabled={!customTopic.trim()}
                        >
                            <Text style={styles.startButtonText}>Начать</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }

    // Topic selection
    if (!selectedTopic) {
        return (
            <View style={styles.container}>
                <View style={styles.topicHeader}>
                    <Text style={styles.title}>Практика чата</Text>
                    <Text style={styles.subtitle}>
                        Выбери тему для разговора. Я буду исправлять ошибки.
                    </Text>
                </View>
                <ScrollView contentContainerStyle={styles.topicsGrid}>
                    {TOPICS.map(topic => (
                        <Pressable
                            key={topic.id}
                            style={({ pressed }) => [
                                styles.topicCard,
                                pressed && styles.topicCardPressed,
                            ]}
                            onPress={() => startChat(topic)}
                        >
                            <Text style={styles.topicEmoji}>{topic.label.split(' ')[0]}</Text>
                            <Text style={styles.topicLabel}>{topic.label.split(' ').slice(1).join(' ')}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
        );
    }

    // Chat interface
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={100}
        >
            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
            >
                {messages.map(message => (
                    <View
                        key={message.id}
                        style={[
                            styles.messageBubble,
                            message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                        ]}
                    >
                        {/* Corrections box for user errors */}
                        {message.corrections && (
                            <View style={styles.correctionsBox}>
                                <Text style={styles.correctionsLabel}>⚠️ Исправления:</Text>
                                <Text style={styles.correctionsText}>{message.corrections}</Text>
                            </View>
                        )}
                        {message.role === 'assistant' ? (
                            <TappableText
                                text={message.content}
                                style={styles.assistantText}
                            />
                        ) : (
                            <Text style={styles.userText}>
                                {message.content}
                            </Text>
                        )}
                        {message.isStreaming && (
                            <Text style={styles.streamingCursor}>▌</Text>
                        )}
                    </View>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <View style={[styles.messageBubble, styles.assistantBubble]}>
                        <LoadingIndicator text="" />
                    </View>
                )}
            </ScrollView>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Напиши на английском..."
                    placeholderTextColor={colors.text.tertiary}
                    multiline
                    maxLength={500}
                />
                <Pressable
                    style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
                    onPress={sendMessage}
                    disabled={!inputText.trim() || isLoading}
                >
                    <Text style={styles.sendButtonText}>➤</Text>
                </Pressable>
            </View>
        </KeyboardAvoidingView>
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
        padding: spacing.xl,
    },
    topicHeader: {
        padding: spacing.xl,
        backgroundColor: colors.surface,
    },
    title: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.text.secondary,
    },
    topicsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: spacing.lg,
        gap: spacing.md,
    },
    topicCard: {
        width: '47%',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        alignItems: 'center',
    },
    topicCardPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    topicEmoji: {
        fontSize: 36,
        marginBottom: spacing.md,
    },
    topicLabel: {
        ...typography.bodyBold,
        color: colors.text.primary,
        textAlign: 'center',
    },
    // Custom topic input
    customTopicContainer: {
        flex: 1,
        padding: spacing.xl,
        justifyContent: 'center',
    },
    customInput: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        ...typography.body,
        color: colors.text.primary,
        marginTop: spacing.xl,
        marginBottom: spacing.lg,
    },
    customButtons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
    },
    cancelButtonText: {
        ...typography.body,
        color: colors.text.secondary,
    },
    startButton: {
        flex: 1,
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
    },
    startButtonDisabled: {
        opacity: 0.5,
    },
    startButtonText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
    },
    // Messages
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    messageBubble: {
        maxWidth: '85%',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: colors.primary[300],
        borderBottomRightRadius: borderRadius.sm,
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: colors.surface,
        borderBottomLeftRadius: borderRadius.sm,
    },
    userText: {
        ...typography.body,
        color: colors.text.inverse,
    },
    assistantText: {
        color: colors.text.primary,
    },
    // Input
    inputContainer: {
        flexDirection: 'row',
        padding: spacing.lg,
        backgroundColor: colors.surface,
        gap: spacing.sm,
        alignItems: 'flex-end',
    },
    textInput: {
        flex: 1,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        ...typography.body,
        color: colors.text.primary,
        maxHeight: 100,
    } as any,
    sendButton: {
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.lg,
        width: 48,
        height: '100%',
        maxHeight: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.border.medium,
    },
    sendButtonText: {
        color: colors.text.inverse,
        fontSize: 20,
    },
    // Corrections styling
    correctionsBox: {
        backgroundColor: `${colors.accent.amber}20`,
        borderWidth: 1,
        borderColor: colors.accent.amber,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    correctionsLabel: {
        ...typography.caption,
        color: colors.accent.amber,
        fontWeight: '700',
        marginBottom: spacing.xs,
    },
    correctionsText: {
        ...typography.bodySmall,
        color: colors.text.primary,
    },
    streamingCursor: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '400',
    },
});
