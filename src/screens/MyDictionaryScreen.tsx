import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, FlatList } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { useLocalLLM } from '@/hooks/useLocalLLM';
import * as Speech from 'expo-speech';
import {
    getAllWords,
    addWord,
    deleteWord,
    getSettings,
    DictionaryWord,
    UserSettings
} from '@/services/storageService';

type FilterType = 'all' | 'new' | 'learning' | 'known';

export default function MyDictionaryScreen() {
    const { isReady, lookupWord } = useLocalLLM();

    const [words, setWords] = useState<DictionaryWord[]>([]);
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
        const [w, s] = await Promise.all([getAllWords(), getSettings()]);
        setWords(w);
        setSettings(s);
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

    const handleAddWord = async () => {
        if (!newWord.trim() || !isReady) return;
        setIsAddingWord(true);

        try {
            const lookupResult = await lookupWord(newWord.trim());
            if (lookupResult) {
                await addWord({
                    text: newWord.trim().toLowerCase(),
                    definition: lookupResult.definition || '',
                    translation: lookupResult.translation || '',
                    cefrLevel: lookupResult.cefrLevel || 'B1',
                    status: 'new',
                    timesShown: 0,
                    timesCorrect: 0,
                    lastReviewedAt: null,
                    nextReviewAt: Date.now(),
                    source: 'manual',
                });
                await loadData();
                setNewWord('');
                setShowAddModal(false);
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
            </View>
        </Pressable>
    );

    return (
        <View style={styles.container}>
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

            {/* Add Button */}
            <Pressable style={styles.addButton} onPress={() => setShowAddModal(true)}>
                <Text style={styles.addButtonText}>+</Text>
            </Pressable>

            {/* Add Word Modal */}
            <Modal visible={showAddModal} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        <Text style={styles.modalTitle}>Добавить слово</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Введите английское слово"
                            placeholderTextColor={colors.text.tertiary}
                            value={newWord}
                            onChangeText={setNewWord}
                            autoCapitalize="none"
                        />
                        <Text style={styles.modalHint}>
                            AI автоматически найдёт перевод и определение
                        </Text>
                        <Pressable
                            style={[styles.modalButton, (!newWord.trim() || isAddingWord) && styles.disabledButton]}
                            onPress={handleAddWord}
                            disabled={!newWord.trim() || isAddingWord}
                        >
                            {isAddingWord ? (
                                <ActivityIndicator color={colors.text.inverse} />
                            ) : (
                                <Text style={styles.modalButtonText}>Добавить</Text>
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

                                {/* Stats */}
                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{selectedWord.timesShown}</Text>
                                        <Text style={styles.statLabel}>Показано</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{selectedWord.timesCorrect}</Text>
                                        <Text style={styles.statLabel}>Правильно</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>
                                            {selectedWord.timesShown > 0
                                                ? Math.round((selectedWord.timesCorrect / selectedWord.timesShown) * 100)
                                                : 0}%
                                        </Text>
                                        <Text style={styles.statLabel}>Точность</Text>
                                    </View>
                                </View>

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
        padding: spacing.md,
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
});
