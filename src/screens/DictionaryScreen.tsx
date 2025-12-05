import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { unifiedAI } from '@/services/unifiedAIManager';
import { classifyWordDetailed, WordClassification } from '@/lib/nlp/frequencyAdapter';

interface DictionaryEntry {
    definition: string;
    phonetic: string;
    partOfSpeech: string;
    examples: string[];
    synonyms: string[];
    translation?: string;
}

export default function DictionaryScreen() {
    const [isReady, setIsReady] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [entry, setEntry] = useState<DictionaryEntry | null>(null);
    const [classification, setClassification] = useState<WordClassification | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Check AI availability on mount
    useEffect(() => {
        checkAIStatus();
    }, []);

    const checkAIStatus = async () => {
        const status = await unifiedAI.getStatus();
        setIsReady(status.activeBackend !== 'none');
    };

    const lookupWord = async (word: string): Promise<DictionaryEntry | null> => {
        const prompt = `Provide a dictionary entry for the English word "${word}".
Include a Russian translation.

Output strictly JSON:
{
    "phonetic": "/phonetic transcription/",
    "definition": "clear, concise definition in English",
    "translation": "перевод на русский язык",
    "partOfSpeech": "noun/verb/adjective/etc",
    "examples": ["example sentence 1", "example sentence 2"],
    "synonyms": ["synonym1", "synonym2"]
}`;

        const response = await unifiedAI.generateText(prompt, { jsonMode: true });
        if (!response.success) return null;

        try {
            const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    };

    const searchWord = async (word?: string) => {
        const query = (word || searchQuery).trim().toLowerCase();
        if (!query) return;

        setIsLoading(true);
        setError(null);
        setEntry(null);

        try {
            // Get word classification (fast, local)
            const wordClass = classifyWordDetailed(query);
            setClassification(wordClass);

            // Get full definition from AI
            const result = await lookupWord(query);
            if (result) {
                setEntry(result);

                // Add to recent searches
                setRecentSearches(prev => {
                    const filtered = prev.filter(w => w !== query);
                    return [query, ...filtered].slice(0, 10);
                });
            } else {
                setError('Не удалось найти определение слова. Проверьте API ключ в настройках.');
            }
        } catch (err) {
            console.error('Dictionary lookup error:', err);
            setError('Ошибка при поиске слова');
        } finally {
            setIsLoading(false);
        }
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'A1-A2': return colors.accent.green;
            case 'B1-B2': return colors.accent.blue;
            case 'C1-C2': return colors.accent.amber;
            default: return colors.text.secondary;
        }
    };

    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.noAIEmoji}>🔑</Text>
                <Text style={styles.noAITitle}>Требуется API ключ</Text>
                <Text style={styles.noAIText}>
                    Добавьте Google или Perplexity API ключ в настройках для использования словаря.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Search Header */}
            <View style={styles.searchHeader}>
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Введите слово..."
                        placeholderTextColor={colors.text.tertiary}
                        onSubmitEditing={() => searchWord()}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <Pressable
                        style={[styles.searchButton, !searchQuery.trim() && styles.searchButtonDisabled]}
                        onPress={() => searchWord()}
                        disabled={!searchQuery.trim() || isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color={colors.text.inverse} />
                        ) : (
                            <Text style={styles.searchButtonText}>🔍</Text>
                        )}
                    </Pressable>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Result */}
                {entry && classification && (
                    <Card elevated style={styles.entryCard}>
                        {/* Word Header */}
                        <View style={styles.wordHeader}>
                            <View>
                                <Text style={styles.word}>{searchQuery}</Text>
                                {entry.phonetic && (
                                    <Text style={styles.phonetic}>{entry.phonetic}</Text>
                                )}
                            </View>
                            <View style={[styles.levelBadge, { backgroundColor: getLevelColor(classification.level) + '20' }]}>
                                <Text style={[styles.levelText, { color: getLevelColor(classification.level) }]}>
                                    {classification.level}
                                </Text>
                            </View>
                        </View>

                        {/* Part of Speech */}
                        <Text style={styles.partOfSpeech}>{entry.partOfSpeech}</Text>

                        {/* Translation */}
                        {entry.translation && (
                            <View style={styles.translationSection}>
                                <Text style={styles.sectionLabel}>Перевод</Text>
                                <Text style={styles.translation}>{entry.translation}</Text>
                            </View>
                        )}

                        {/* Definition */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>Definition</Text>
                            <Text style={styles.definition}>{entry.definition}</Text>
                        </View>

                        {/* Examples */}
                        {entry.examples && entry.examples.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Examples</Text>
                                {entry.examples.map((example, index) => (
                                    <View key={index} style={styles.exampleItem}>
                                        <Text style={styles.exampleText}>"{example}"</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Synonyms */}
                        {entry.synonyms && entry.synonyms.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Synonyms</Text>
                                <View style={styles.synonymsContainer}>
                                    {entry.synonyms.map((synonym, index) => (
                                        <Pressable
                                            key={index}
                                            style={styles.synonymChip}
                                            onPress={() => {
                                                setSearchQuery(synonym);
                                                searchWord(synonym);
                                            }}
                                        >
                                            <Text style={styles.synonymText}>{synonym}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Classification Info */}
                        <View style={styles.classificationInfo}>
                            <Text style={styles.classificationLabel}>
                                Confidence: {classification.confidence} ({classification.source})
                            </Text>
                        </View>
                    </Card>
                )}

                {/* Error */}
                {error && (
                    <Card style={styles.errorCard}>
                        <Text style={styles.errorText}>{error}</Text>
                    </Card>
                )}

                {/* Recent Searches */}
                {!entry && !isLoading && recentSearches.length > 0 && (
                    <View style={styles.recentSection}>
                        <Text style={styles.recentLabel}>Недавние запросы</Text>
                        <View style={styles.recentContainer}>
                            {recentSearches.map((word, index) => (
                                <Pressable
                                    key={index}
                                    style={styles.recentChip}
                                    onPress={() => {
                                        setSearchQuery(word);
                                        searchWord(word);
                                    }}
                                >
                                    <Text style={styles.recentText}>{word}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}

                {/* Empty State */}
                {!entry && !isLoading && !error && recentSearches.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>📖</Text>
                        <Text style={styles.emptyTitle}>Словарь</Text>
                        <Text style={styles.emptyText}>
                            Введите любое английское слово, чтобы получить определение, перевод и уровень CEFR.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
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
    noAIEmoji: {
        fontSize: 60,
        marginBottom: spacing.lg,
    },
    noAITitle: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    noAIText: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    searchHeader: {
        padding: spacing.lg,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    searchContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        ...typography.body,
        color: colors.text.primary,
    },
    searchButton: {
        backgroundColor: colors.primary[600],
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchButtonDisabled: {
        backgroundColor: colors.border.medium,
    },
    searchButtonText: {
        fontSize: 20,
    },
    content: {
        padding: spacing.lg,
    },
    entryCard: {
        padding: spacing.xl,
    },
    wordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    word: {
        ...typography.h1,
        color: colors.text.primary,
    },
    phonetic: {
        ...typography.body,
        color: colors.text.secondary,
        marginTop: spacing.xs,
    },
    levelBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    levelText: {
        ...typography.bodySmall,
        fontWeight: 'bold',
    },
    partOfSpeech: {
        ...typography.bodySmall,
        color: colors.primary[600],
        fontStyle: 'italic',
        marginBottom: spacing.lg,
    },
    translationSection: {
        marginBottom: spacing.lg,
        backgroundColor: `${colors.primary[300]}15`,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary[300],
    },
    translation: {
        ...typography.h3,
        color: colors.primary[300],
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionLabel: {
        ...typography.caption,
        color: colors.text.secondary,
        fontWeight: 'bold',
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
    },
    definition: {
        ...typography.body,
        color: colors.text.primary,
        lineHeight: 24,
    },
    exampleItem: {
        backgroundColor: colors.background,
        padding: spacing.md,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary[300],
    },
    exampleText: {
        ...typography.body,
        color: colors.text.primary,
        fontStyle: 'italic',
    },
    synonymsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    synonymChip: {
        backgroundColor: colors.primary[50],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    synonymText: {
        ...typography.bodySmall,
        color: colors.primary[700],
    },
    classificationInfo: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
    },
    classificationLabel: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    errorCard: {
        padding: spacing.xl,
        backgroundColor: colors.accent.red + '10',
        borderWidth: 1,
        borderColor: colors.accent.red,
    },
    errorText: {
        ...typography.body,
        color: colors.accent.red,
        textAlign: 'center',
    },
    recentSection: {
        marginTop: spacing.lg,
    },
    recentLabel: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        marginBottom: spacing.md,
    },
    recentContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    recentChip: {
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border.light,
    },
    recentText: {
        ...typography.bodySmall,
        color: colors.text.primary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl * 2,
    },
    emptyEmoji: {
        fontSize: 60,
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    emptyText: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
    },
});
