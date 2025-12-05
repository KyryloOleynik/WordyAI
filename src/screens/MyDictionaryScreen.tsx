import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, FlatList, Alert } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { useLocalLLM } from '@/hooks/useLocalLLM';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import { unifiedAI } from '@/services/unifiedAIManager';
import {
    getAllWords,
    addWord,
    updateWord,
    deleteWord,
    getSettings,
    DictionaryWord,
    UserSettings
} from '@/services/storageService';
import { getGrammarConcepts, GrammarConcept } from '@/services/database';

type FilterType = 'all' | 'new' | 'learning' | 'known';
type MainTab = 'words' | 'grammar';

export default function MyDictionaryScreen() {
    const navigation = useNavigation<any>();
    const { isReady, lookupWord } = useLocalLLM();

    const [mainTab, setMainTab] = useState<MainTab>('words');
    const [words, setWords] = useState<DictionaryWord[]>([]);
    const [grammarConcepts, setGrammarConcepts] = useState<GrammarConcept[]>([]);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedWord, setSelectedWord] = useState<DictionaryWord | null>(null);
    const [newWord, setNewWord] = useState('');
    const [isAddingWord, setIsAddingWord] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const loadData = async () => {
        const [w, s, g] = await Promise.all([getAllWords(), getSettings(), getGrammarConcepts()]);
        setWords(w);
        setSettings(s);
        setGrammarConcepts(g);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const filteredWords = words.filter(word => {
        // Filter by status
        if (filter !== 'all' && word.status !== filter) return false;
        // Filter by search
        if (searchQuery && !word.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    // Fast word adding - adds immediately, AI enriches in background
    const handleAddWord = async () => {
        if (!newWord.trim()) return;
        setIsAddingWord(true);

        try {
            // Parse multiple words (comma, newline, or semicolon separated)
            const wordList = newWord
                .split(/[,;\n]+/)
                .map(w => w.trim().toLowerCase())
                .filter(w => w.length > 0 && w.length < 50);

            if (wordList.length === 0) {
                setIsAddingWord(false);
                return;
            }

            // Add all words immediately with basic data
            for (const wordText of wordList) {
                await addWord({
                    text: wordText,
                    definition: '',
                    translation: '',
                    cefrLevel: 'B1',
                    status: 'new',
                    timesShown: 0,
                    timesCorrect: 0,
                    lastReviewedAt: null,
                    nextReviewAt: Date.now(),
                    source: 'manual',
                    translationCorrect: 0,
                    translationWrong: 0,
                    matchingCorrect: 0,
                    matchingWrong: 0,
                    lessonCorrect: 0,
                    lessonWrong: 0,
                    reviewCount: 0,
                    masteryScore: 0,
                });
            }

            await loadData();
            setNewWord('');
            setShowAddModal(false);

            // Enrich words with AI in background (non-blocking)
            if (isReady) {
                for (const wordText of wordList) {
                    lookupWord(wordText).then(async (result) => {
                        if (result) {
                            const existingWord = words.find(w => w.text === wordText);
                            if (existingWord && !existingWord.translation) {
                                await updateWord(existingWord.id, {
                                    definition: result.definition || '',
                                    translation: result.translation || '',
                                    cefrLevel: result.cefrLevel || 'B1',
                                });
                                loadData(); // Refresh to show updated data
                            }
                        }
                    }).catch(() => { }); // Ignore AI errors
                }
            }
        } catch (error) {
            console.error('Error adding word:', error);
        } finally {
            setIsAddingWord(false);
        }
    };

    const handleDeleteWord = async (wordId: string) => {
        await deleteWord(wordId);
        await loadData();
        setShowDetailModal(false);
        setSelectedWord(null);
    };

    const openWordDetail = (word: DictionaryWord) => {
        setSelectedWord(word);
        setShowDetailModal(true);
    };

    const closeDetailModal = () => {
        Speech.stop();
        setIsSpeaking(false);
        setShowDetailModal(false);
        setSelectedWord(null);
    };

    const handleSpeak = async (word: string) => {
        if (isSpeaking) {
            await Speech.stop();
            setIsSpeaking(false);
        } else {
            setIsSpeaking(true);
            await Speech.speak(word, {
                language: 'en-US',
                rate: 0.8,
                onDone: () => setIsSpeaking(false),
                onError: () => setIsSpeaking(false),
            });
        }
    };

    // Start grammar test - navigate to lessons with specific grammar concept
    const startGrammarTest = (concept: GrammarConcept) => {
        navigation.navigate('GrammarTest', { concept });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return colors.accent.blue;
            case 'learning': return colors.accent.amber;
            case 'known': return colors.accent.green;
            default: return colors.text.tertiary;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'new': return 'Новое';
            case 'learning': return 'Изучается';
            case 'known': return 'Выучено';
            default: return status;
        }
    };

    const getCefrColor = (level: string) => {
        const lvl = level?.toUpperCase() || 'B1';
        if (lvl.startsWith('A')) return colors.cefr.A1;
        if (lvl === 'B1') return colors.cefr.B1;
        if (lvl === 'B2') return colors.cefr.B2;
        if (lvl === 'C1') return colors.cefr.C1;
        if (lvl === 'C2') return colors.cefr.C2;
        return colors.cefr.B1;
    };

    const renderWordItem = ({ item }: { item: DictionaryWord }) => (
        <Pressable style={styles.wordCard} onPress={() => openWordDetail(item)}>
            <View style={styles.wordHeader}>
                <Text style={styles.wordText}>{item.text}</Text>
                <View style={[styles.cefrBadge, { backgroundColor: getCefrColor(item.cefrLevel) }]}>
                    <Text style={styles.cefrText}>{item.cefrLevel}</Text>
                </View>
            </View>
            <Text style={styles.translationText} numberOfLines={1}>
                {settings?.showTranslation ? item.translation : item.definition}
            </Text>
            <View style={styles.wordFooter}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
                {/* Mastery Progress */}
                <View style={styles.masteryContainer}>
                    <View style={styles.masteryTrack}>
                        <View style={[styles.masteryBar, { width: `${(item.masteryScore || 0) * 100}%` }]} />
                    </View>
                    <Text style={styles.masteryText}>{Math.round((item.masteryScore || 0) * 100)}%</Text>
                </View>
            </View>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            {/* Main Tab Switcher - Words / Grammar */}
            <View style={styles.mainTabContainer}>
                <Pressable
                    style={[styles.mainTab, mainTab === 'words' && styles.mainTabActive]}
                    onPress={() => setMainTab('words')}
                >
                    <Text style={[styles.mainTabText, mainTab === 'words' && styles.mainTabTextActive]}>
                        📚 Слова ({words.length})
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.mainTab, mainTab === 'grammar' && styles.mainTabActive]}
                    onPress={() => setMainTab('grammar')}
                >
                    <Text style={[styles.mainTabText, mainTab === 'grammar' && styles.mainTabTextActive]}>
                        📖 Грамматика ({grammarConcepts.length})
                    </Text>
                </Pressable>
            </View>

            {mainTab === 'words' ? (
                <>
                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Поиск слов..."
                            placeholderTextColor={colors.text.tertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {/* Filter Tabs */}
                    <View style={styles.filterContainer}>
                        {(['all', 'new', 'learning', 'known'] as FilterType[]).map(f => (
                            <Pressable
                                key={f}
                                style={[styles.filterTab, filter === f && styles.filterTabActive]}
                                onPress={() => setFilter(f)}
                            >
                                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                                    {f === 'all' ? 'Все' :
                                        f === 'new' ? 'Новые' :
                                            f === 'learning' ? 'Учу' : 'Выучил'}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Words List */}
                    {filteredWords.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📚</Text>
                            <Text style={styles.emptyText}>
                                {words.length === 0
                                    ? 'Словарь пуст. Добавьте слова!'
                                    : 'Нет слов по фильтру'}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredWords}
                            keyExtractor={item => item.id}
                            renderItem={renderWordItem}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </>
            ) : (
                /* Grammar Concepts List */
                grammarConcepts.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📖</Text>
                        <Text style={styles.emptyTitle}>Нет грамматических тем</Text>
                        <Text style={styles.emptyText}>
                            Грамматика добавляется автоматически при изучении уроков
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={grammarConcepts}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <View style={styles.grammarCard}>
                                <View style={styles.grammarHeader}>
                                    <Text style={styles.grammarName}>{item.nameRu}</Text>
                                    {item.errorCount > 0 && (
                                        <View style={styles.errorBadge}>
                                            <Text style={styles.errorBadgeText}>{item.errorCount} ошибок</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.grammarEnglish}>{item.name}</Text>
                                <Text style={styles.grammarDesc} numberOfLines={2}>{item.description}</Text>
                                <View style={styles.grammarStats}>
                                    <Text style={styles.grammarStatText}>
                                        Практика: {item.practiceCount} | Усвоение: {Math.round(item.masteryScore * 100)}%
                                    </Text>
                                </View>
                                <Pressable
                                    style={styles.grammarTestButton}
                                    onPress={() => startGrammarTest(item)}
                                >
                                    <Text style={styles.grammarTestButtonText}>📝 Пройти тест</Text>
                                </Pressable>
                            </View>
                        )}
                    />
                )
            )}

            {/* Add Button */}
            <Pressable style={styles.addButton} onPress={() => setShowAddModal(true)}>
                <Text style={styles.addButtonText}>+</Text>
            </Pressable>

            {/* Add Word Modal */}
            <Modal visible={showAddModal} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        <Text style={styles.modalTitle}>Добавить слова</Text>
                        <TextInput
                            style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                            placeholder="apple, banana, orange&#10;или каждое с новой строки"
                            placeholderTextColor={colors.text.tertiary}
                            value={newWord}
                            onChangeText={setNewWord}
                            autoCapitalize="none"
                            multiline
                            numberOfLines={3}
                        />
                        <Text style={styles.modalHint}>
                            Введите слова через запятую или каждое с новой строки.{'\n'}AI автоматически найдёт переводы.
                        </Text>
                        <Pressable
                            style={[styles.modalButton, (!newWord.trim() || isAddingWord) && styles.disabledButton]}
                            onPress={handleAddWord}
                            disabled={!newWord.trim() || isAddingWord}
                        >
                            {isAddingWord ? (
                                <ActivityIndicator color={colors.text.inverse} />
                            ) : (
                                <Text style={styles.modalButtonText}>
                                    Добавить{newWord.split(/[,;\n]+/).filter(w => w.trim()).length > 1 ? ` (${newWord.split(/[,;\n]+/).filter(w => w.trim()).length})` : ''}
                                </Text>
                            )}
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Word Detail Modal */}
            <Modal visible={showDetailModal} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={closeDetailModal}>
                    <Pressable style={styles.detailModalContent} onPress={e => e.stopPropagation()}>
                        {selectedWord && (
                            <>
                                {/* Header with word, pronunciation, CEFR */}
                                <View style={styles.detailHeader}>
                                    <View style={styles.detailWordRow}>
                                        <Text style={styles.detailWord}>{selectedWord.text}</Text>
                                        <Pressable
                                            style={[styles.speakButton, isSpeaking && styles.speakButtonActive]}
                                            onPress={() => handleSpeak(selectedWord.text)}
                                        >
                                            <Text style={styles.speakIcon}>{isSpeaking ? '🔊' : '🔈'}</Text>
                                        </Pressable>
                                    </View>
                                    <View style={[styles.detailCefr, { backgroundColor: getCefrColor(selectedWord.cefrLevel) }]}>
                                        <Text style={styles.detailCefrText}>{selectedWord.cefrLevel}</Text>
                                    </View>
                                </View>

                                {/* Translation */}
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>Перевод</Text>
                                    <Text style={styles.detailTranslation}>{selectedWord.translation || 'Нет перевода'}</Text>
                                </View>

                                {/* Definition */}
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>Определение</Text>
                                    <Text style={styles.detailDefinition}>{selectedWord.definition || 'No definition'}</Text>
                                </View>

                                {/* Stats - Combined metrics from all exercises */}
                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>
                                            {selectedWord.reviewCount ||
                                                (selectedWord.translationCorrect + selectedWord.translationWrong +
                                                    selectedWord.matchingCorrect + selectedWord.matchingWrong +
                                                    selectedWord.lessonCorrect + selectedWord.lessonWrong) ||
                                                selectedWord.timesShown || 0}
                                        </Text>
                                        <Text style={styles.statLabel}>Повторений</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>
                                            {(selectedWord.translationCorrect || 0) +
                                                (selectedWord.matchingCorrect || 0) +
                                                (selectedWord.lessonCorrect || 0) ||
                                                selectedWord.timesCorrect || 0}
                                        </Text>
                                        <Text style={styles.statLabel}>Правильно</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>
                                            {(() => {
                                                const correct = (selectedWord.translationCorrect || 0) +
                                                    (selectedWord.matchingCorrect || 0) +
                                                    (selectedWord.lessonCorrect || 0);
                                                const wrong = (selectedWord.translationWrong || 0) +
                                                    (selectedWord.matchingWrong || 0) +
                                                    (selectedWord.lessonWrong || 0);
                                                const total = correct + wrong;
                                                if (total === 0 && selectedWord.timesShown > 0) {
                                                    return Math.round((selectedWord.timesCorrect / selectedWord.timesShown) * 100);
                                                }
                                                return total > 0 ? Math.round((correct / total) * 100) : 0;
                                            })()}%
                                        </Text>
                                        <Text style={styles.statLabel}>Точность</Text>
                                    </View>
                                </View>

                                {/* Mastery Progress */}
                                {selectedWord.masteryScore !== undefined && (
                                    <View style={styles.masteryRow}>
                                        <Text style={styles.masteryLabel}>Усвоение:</Text>
                                        <View style={styles.masteryBar}>
                                            <View style={[styles.masteryFill, { width: `${Math.round((selectedWord.masteryScore || 0) * 100)}%` }]} />
                                        </View>
                                        <Text style={styles.masteryPercent}>{Math.round((selectedWord.masteryScore || 0) * 100)}%</Text>
                                    </View>
                                )}

                                {/* Status */}
                                <View style={styles.statusRow}>
                                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(selectedWord.status)}20` }]}>
                                        <View style={[styles.statusDotLarge, { backgroundColor: getStatusColor(selectedWord.status) }]} />
                                        <Text style={[styles.statusBadgeText, { color: getStatusColor(selectedWord.status) }]}>
                                            {getStatusLabel(selectedWord.status)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Buttons */}
                                <View style={styles.modalButtons}>
                                    <Pressable style={styles.closeButton} onPress={closeDetailModal}>
                                        <Text style={styles.closeButtonText}>Закрыть</Text>
                                    </Pressable>
                                    <Pressable
                                        style={styles.deleteButton}
                                        onPress={() => handleDeleteWord(selectedWord.id)}
                                    >
                                        <Text style={styles.deleteButtonText}>🗑️</Text>
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    searchContainer: {
        padding: spacing.sm,
        backgroundColor: colors.surface,
    },
    searchInput: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        ...typography.body,
        color: colors.text.primary,
    },
    filterContainer: {
        flexDirection: 'row',
        padding: spacing.md,
        gap: spacing.sm,
        backgroundColor: colors.surface,
    },
    filterTab: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    filterTabActive: {
        backgroundColor: colors.primary[300],
    },
    filterText: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: colors.text.inverse,
        fontWeight: '600',
    },
    listContent: {
        padding: spacing.md,
        gap: spacing.sm,
    },
    wordCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
    },
    wordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    wordText: {
        ...typography.h3,
        color: colors.text.primary,
    },
    cefrBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    cefrText: {
        ...typography.caption,
        color: colors.text.inverse,
        fontWeight: '700',
    },
    translationText: {
        ...typography.body,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    wordFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xxxl,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: spacing.lg,
    },
    emptyText: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    addButton: {
        position: 'absolute',
        bottom: spacing.xl,
        right: spacing.xl,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary[300],
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    addButtonText: {
        fontSize: 32,
        color: colors.text.inverse,
        lineHeight: 36,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xxl,
        padding: spacing.xxl,
        width: '100%',
        maxWidth: 340,
    },
    modalTitle: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    modalInput: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        ...typography.body,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    modalHint: {
        ...typography.caption,
        color: colors.text.tertiary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    modalButton: {
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    modalButtonText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
    },
    disabledButton: {
        backgroundColor: colors.border.medium,
    },
    detailModalContent: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xxl,
        padding: spacing.xxl,
        width: '100%',
        maxWidth: 360,
    },
    detailHeader: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    detailWordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    detailWord: {
        ...typography.h1,
        color: colors.text.primary,
    },
    speakButton: {
        backgroundColor: colors.surfaceElevated,
        width: 44,
        height: 44,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    speakButtonActive: {
        backgroundColor: colors.primary[300],
    },
    speakIcon: {
        fontSize: 24,
    },
    detailCefr: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    detailCefrText: {
        ...typography.bodySmall,
        color: colors.text.inverse,
        fontWeight: '700',
    },
    detailSection: {
        marginBottom: spacing.lg,
    },
    detailLabel: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
    },
    detailTranslation: {
        ...typography.h3,
        color: colors.accent.amber,
    },
    detailDefinition: {
        ...typography.body,
        color: colors.text.secondary,
        lineHeight: 22,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: spacing.lg,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        ...typography.h3,
        color: colors.text.primary,
    },
    statLabel: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    statusRow: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        gap: spacing.sm,
    },
    statusDotLarge: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusBadgeText: {
        ...typography.bodyBold,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    closeButton: {
        flex: 1,
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    closeButtonText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
    },
    deleteButton: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteButtonText: {
        fontSize: 20,
    },
    // Main tabs
    mainTabContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        padding: spacing.sm,
        paddingTop: spacing.xl,
        gap: spacing.sm,
    },
    mainTab: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surfaceElevated,
    },
    mainTabActive: {
        backgroundColor: colors.primary[300],
    },
    mainTabText: {
        ...typography.bodyBold,
        color: colors.text.secondary,
    },
    mainTabTextActive: {
        color: colors.text.inverse,
    },
    emptyTitle: {
        ...typography.h3,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    // Grammar
    grammarCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.sm,
    },
    grammarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    grammarName: {
        ...typography.h3,
        color: colors.text.primary,
        flex: 1,
    },
    errorBadge: {
        backgroundColor: `${colors.accent.red}20`,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    errorBadgeText: {
        ...typography.caption,
        color: colors.accent.red,
    },
    grammarEnglish: {
        ...typography.bodySmall,
        color: colors.accent.blue,
        marginBottom: spacing.sm,
    },
    grammarDesc: {
        ...typography.body,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    grammarStats: {
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
    },
    grammarStatText: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    // Mastery progress
    masteryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    masteryLabel: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    masteryBar: {
        flex: 1,
        height: 8,
        backgroundColor: colors.border.light,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
    },
    masteryFill: {
        height: '100%',
        backgroundColor: colors.accent.green,
        borderRadius: borderRadius.sm,
    },
    masteryPercent: {
        ...typography.caption,
        color: colors.accent.green,
        fontWeight: '700',
        minWidth: 35,
        textAlign: 'right',
    },
    // Word card mastery display
    masteryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 'auto',
        gap: spacing.xs,
    },
    masteryTrack: {
        width: 40,
        height: 4,
        backgroundColor: colors.border.light,
        borderRadius: 2,
        overflow: 'hidden',
    },
    masteryText: {
        ...typography.caption,
        color: colors.accent.green,
        fontWeight: '600',
        fontSize: 10,
    },
    // Grammar test button
    grammarTestButton: {
        marginTop: spacing.md,
        backgroundColor: colors.primary[300],
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    grammarTestButtonText: {
        ...typography.bodySmall,
        color: colors.text.inverse,
        fontWeight: '600',
    },
});
