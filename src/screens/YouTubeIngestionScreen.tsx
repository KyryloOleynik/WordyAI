import { StyleSheet, Text, View, TextInput, ActivityIndicator, ScrollView, Alert, Platform, Pressable } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { fetchYouTubeSubtitles } from '@/features/ingestion/youtubeService';
import { extractNewWords, CEFRLevel } from '@/lib/nlp/filter';
import { getSettings, addWord } from '@/services/storageService';
import { translateWords } from '@/services/translationService';

export default function YouTubeIngestionScreen() {
    const navigation = useNavigation();
    const [url, setUrl] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [extractedWords, setExtractedWords] = useState<string[]>([]);

    const handleExtract = async () => {
        if (!url) {
            Alert.alert('Error', 'Please enter a YouTube URL');
            return;
        }

        // Check if running in web browser
        if (Platform.OS === 'web') {
            Alert.alert(
                '⚠️ Веб-версия не поддерживается',
                'YouTube парсинг работает только на реальном устройстве или эмуляторе из-за ограничений CORS.\n\nИспользуйте:\n- iOS симулятор\n- Android эмулятор\n- Реальное устройство (Expo Go)',
                [{ text: 'Понятно' }]
            );
            return;
        }

        setIsProcessing(true);
        setExtractedWords([]);

        try {
            // Fetch real subtitles from YouTube
            const videoInfo = await fetchYouTubeSubtitles(url, 'en');

            // Get user's CEFR level from settings
            const settings = await getSettings();
            const userLevel = settings.cefrLevel;

            // Map user level to CEFR range
            const levelMap: Record<string, CEFRLevel> = {
                'A1': 'A1-A2',
                'A2': 'A1-A2',
                'B1': 'B1-B2',
                'B2': 'B1-B2',
                'C1': 'C1-C2',
                'C2': 'C1-C2',
            };
            const cefrLevel = levelMap[userLevel] || 'B1-B2';

            // Extract words above user's level using classification service
            const words = await extractNewWords(videoInfo.fullText, cefrLevel);

            setExtractedWords(words.slice(0, 50)); // Limit to 50 words
        } catch (error) {
            Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to extract subtitles'
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const removeWord = (word: string) => {
        setExtractedWords(prev => prev.filter(w => w !== word));
    };

    const saveWords = async () => {
        setIsSaving(true);
        try {
            // Translate all words
            const translations = await translateWords(extractedWords);

            // Add each word to dictionary
            for (const word of extractedWords) {
                const translation = translations.get(word.toLowerCase());
                await addWord({
                    text: word,
                    definition: translation?.definition || 'No definition available',
                    translation: translation?.translation || 'Перевод недоступен',
                    cefrLevel: translation?.cefrLevel || 'B1',
                    status: 'new',
                    timesShown: 0,
                    timesCorrect: 0,
                    lastReviewedAt: null,
                    nextReviewAt: Date.now(),
                    source: 'youtube',
                });
            }

            Alert.alert(
                '✅ Успешно!',
                `${extractedWords.length} слов добавлено в словарь`,
                [{ text: 'Отлично', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            Alert.alert('Ошибка', 'Не удалось сохранить слова');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Platform Warning */}
            {Platform.OS === 'web' && (
                <View style={styles.warningContainer}>
                    <Card style={styles.warningCard}>
                        <Text style={styles.warningIcon}>⚠️</Text>
                        <Text style={styles.warningTitle}>Только для мобильных устройств</Text>
                        <Text style={styles.warningText}>
                            YouTube парсинг не работает в браузере из-за CORS.
                            Откройте на iOS/Android эмуляторе или реальном устройстве.
                        </Text>
                    </Card>
                </View>
            )}

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerIcon}>
                    <Text style={styles.headerIconText}>📹</Text>
                </View>
                <Text style={styles.headerTitle}>Добавить YouTube видео</Text>
                <Text style={styles.headerSubtitle}>Извлеки новые слова из любимого контента</Text>
            </View>

            {/* URL Input */}
            <Card style={styles.inputCard}>
                <Text style={styles.label}>YouTube URL</Text>
                <TextInput
                    style={styles.input}
                    placeholder="https://youtube.com/watch?v=..."
                    placeholderTextColor={colors.text.tertiary}
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isProcessing && !isSaving}
                />
                <Button
                    title="Извлечь слова"
                    onPress={handleExtract}
                    disabled={!url || Platform.OS === 'web'}
                    loading={isProcessing}
                />
            </Card>

            {/* Results with Delete Option */}
            {extractedWords.length > 0 && (
                <View style={styles.resultsContainer}>
                    <View style={styles.resultsHeader}>
                        <Text style={styles.resultsTitle}>Найдено {extractedWords.length} слов</Text>
                        <Text style={styles.resultsSubtitle}>Удалите ненужные слова</Text>
                    </View>

                    <View style={styles.wordsList}>
                        {extractedWords.map((word, index) => (
                            <View key={index} style={styles.wordCard}>
                                <Text style={styles.wordText}>{word}</Text>
                                <Pressable
                                    style={styles.deleteButton}
                                    onPress={() => removeWord(word)}
                                >
                                    <Text style={styles.deleteButtonText}>✕</Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>

                    <View style={styles.actionButtons}>
                        <Button
                            title="Очистить всё"
                            onPress={() => setExtractedWords([])}
                            variant="outline"
                            size="medium"
                        />
                        <Button
                            title={`Сохранить ${extractedWords.length} слов`}
                            onPress={saveWords}
                            variant="primary"
                            size="medium"
                            loading={isSaving}
                            disabled={extractedWords.length === 0}
                        />
                    </View>
                </View>
            )}

            {/* Instructions */}
            {extractedWords.length === 0 && !isProcessing && (
                <View style={styles.instructionsContainer}>
                    <Card style={styles.instructionCard}>
                        <View style={styles.instructionHeader}>
                            <Text style={styles.instructionNumber}>1</Text>
                        </View>
                        <Text style={styles.instructionText}>Найди YouTube видео на английском</Text>
                    </Card>
                    <Card style={styles.instructionCard}>
                        <View style={styles.instructionHeader}>
                            <Text style={styles.instructionNumber}>2</Text>
                        </View>
                        <Text style={styles.instructionText}>Скопируй ссылку на видео</Text>
                    </Card>
                    <Card style={styles.instructionCard}>
                        <View style={styles.instructionHeader}>
                            <Text style={styles.instructionNumber}>3</Text>
                        </View>
                        <Text style={styles.instructionText}>Вставь сюда и извлеки слова</Text>
                    </Card>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingBottom: 40,
    },
    warningContainer: {
        padding: spacing.xl,
        paddingBottom: 0,
    },
    warningCard: {
        backgroundColor: '#FFF9E6',
        borderColor: '#F59E0B',
        borderWidth: 2,
    },
    warningIcon: {
        fontSize: 40,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    warningTitle: {
        ...typography.h3,
        color: '#92400E',
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    warningText: {
        ...typography.bodySmall,
        color: '#78350F',
        textAlign: 'center',
    },
    header: {
        padding: spacing.xxxl,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    headerIcon: {
        width: 64,
        height: 64,
        borderRadius: borderRadius.lg,
        backgroundColor: `${colors.primary[600]}15`,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    headerIconText: {
        fontSize: 32,
    },
    headerTitle: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    headerSubtitle: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    inputCard: {
        margin: spacing.xl,
    },
    label: {
        ...typography.body,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        ...typography.body,
        color: colors.text.primary,
        borderWidth: 1,
        borderColor: colors.border.medium,
        marginBottom: spacing.lg,
    },
    extractButton: {
        marginTop: spacing.sm,
    },
    resultsContainer: {
        padding: spacing.xl,
    },
    resultsTitle: {
        ...typography.h3,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    resultsSubtitle: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        marginBottom: spacing.lg,
    },
    wordsList: {
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    wordCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.md,
    },
    wordCardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    wordText: {
        ...typography.body,
        fontWeight: '600',
        color: colors.text.primary,
        flex: 1,
    },
    wordBadge: {
        backgroundColor: colors.primary[100],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    wordBadgeText: {
        ...typography.caption,
        color: colors.primary[700],
        fontWeight: '600',
    },
    resultsHeader: {
        marginBottom: spacing.lg,
    },
    deleteButton: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.full,
        backgroundColor: `${colors.accent.red}20`,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.md,
    },
    deleteButtonText: {
        color: colors.accent.red,
        fontSize: 16,
        fontWeight: '600',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    instructionsContainer: {
        padding: spacing.xl,
        gap: spacing.md,
    },
    instructionCard: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    instructionHeader: {
        marginRight: spacing.lg,
    },
    instructionNumber: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary[600],
        color: colors.text.inverse,
        ...typography.body,
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 32,
    },
    instructionText: {
        ...typography.body,
        color: colors.text.primary,
        flex: 1,
    },
});
