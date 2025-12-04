import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import Card from '@/components/ui/Card';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { useLocalLLM } from '@/hooks/useLocalLLM';
import { classifyWordDetailed, WordClassification } from '@/lib/nlp/frequencyAdapter';
import { ModelDownloadIndicator } from '@/components/ui/ModelDownloadIndicator';

interface DictionaryEntry {
    definition: string;
    phonetic: string;
    partOfSpeech: string;
    examples: string[];
    synonyms: string[];
}

export default function DictionaryScreen() {
    const { isReady, downloadProgress, lookupWord } = useLocalLLM();

    const [searchQuery, setSearchQuery] = useState('');
    const [entry, setEntry] = useState<DictionaryEntry | null>(null);
    const [classification, setClassification] = useState<WordClassification | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

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

            // Get full definition from LLM
            const result = await lookupWord(query);
            if (result) {
                setEntry(result);

                // Add to recent searches
                setRecentSearches(prev => {
                    const filtered = prev.filter(w => w !== query);
                    return [query, ...filtered].slice(0, 10);
                });
            } else {
                setError('Could not find definition for this word');
            }
        } catch (err) {
            console.error('Dictionary lookup error:', err);
            setError('Failed to look up word');
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
                <ModelDownloadIndicator
                    visible={!!downloadProgress}
                    progress={downloadProgress?.progress || 0}
                    text={downloadProgress?.text || 'Initializing...'}
                />
                {!downloadProgress && (
                    <>
                        <ActivityIndicator size="large" color={colors.primary[500]} />
                        <Text style={styles.loadingText}>Loading AI Model...</Text>
                    </>
                )}
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
                        placeholder="Search for a word..."
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
                        <Text style={styles.recentLabel}>Recent Searches</Text>
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
                        <Text style={styles.emptyTitle}>Dictionary</Text>
                        <Text style={styles.emptyText}>
                            Search for any English word to get its definition, examples, and CEFR level.
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
    loadingText: {
        marginTop: spacing.md,
        color: colors.text.secondary,
        ...typography.body,
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
