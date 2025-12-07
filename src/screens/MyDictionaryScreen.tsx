import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, FlatList, Animated, ActivityIndicator } from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import * as ImagePicker from 'expo-image-picker';
import { useSpeech } from '@/hooks/useSpeech';
import { unifiedAI, ApiKeyError } from '@/services/unifiedAIManager';
import { UnifiedFeedbackModal, InputModal, LoadingOverlay, EmptyState, WordInfoModal } from '@/components/ui/SharedComponents';
import {
    getAllWords,
    addWord,
    updateWord,
    deleteWord,
    getSettings,
    getWordById,
    DictionaryWord,
    UserSettings
} from '@/services/storageService';
import { getGrammarConcepts, GrammarConcept } from '@/services/database';
import { VButton } from '@/components/ui/DesignSystem';

type FilterType = 'all' | 'new' | 'learning' | 'known';
type MainTab = 'words' | 'grammar';

// Toast notification type
interface ToastNotification {
    message: string;
    type: 'success' | 'error' | 'info';
}

export default function MyDictionaryScreen() {
    const navigation = useNavigation<any>();

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
    // const [isSpeaking, setIsSpeaking] = useState(false); // Replaced by hook
    const { speak, stop, isSpeaking } = useSpeech();
    const [isScanning, setIsScanning] = useState(false);
    const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);

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

    // Toast notification
    const [toast, setToast] = useState<ToastNotification | null>(null);
    const toastAnim = useRef(new Animated.Value(-100)).current;

    // Show toast with slide-down animation
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
        toastAnim.setValue(-100);
        Animated.sequence([
            Animated.spring(toastAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }),
            Animated.delay(3000),
            Animated.timing(toastAnim, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => setToast(null));
    };

    // Manually load translation for selected word
    const loadTranslation = async () => {
        if (!selectedWord) return;
        setIsLoadingTranslation(true);

        try {
            const prompt = `Translate the English word "${selectedWord.text}" to Russian.
Provide a brief definition in English.
Output JSON only: {"translation": "русский перевод", "definition": "brief English definition", "cefrLevel": "A1/A2/B1/B2/C1/C2"}`;

            const response = await unifiedAI.generateText(prompt, { jsonMode: true });
            console.log('[loadTranslation] AI response:', response.success, response.text?.substring(0, 100));

            if (response.success) {
                const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                const data = JSON.parse(cleaned);
                console.log('[loadTranslation] Parsed data:', data);
                console.log('[loadTranslation] Updating word id:', selectedWord.id);

                await updateWord(selectedWord.id, {
                    definition: data.definition || '',
                    translation: data.translation || '',
                    cefrLevel: data.cefrLevel || selectedWord.cefrLevel,
                });
                console.log('[loadTranslation] updateWord completed');

                // Update selected word and reload data
                setSelectedWord({
                    ...selectedWord,
                    definition: data.definition || '',
                    translation: data.translation || '',
                    cefrLevel: data.cefrLevel || selectedWord.cefrLevel,
                });
                await loadData();
                console.log('[loadTranslation] loadData completed');
            }
        } catch (e: any) {
            console.error('Failed to load translation:', e);
            if (e.name === 'ApiKeyError') {
                setFeedbackModal({
                    visible: true,
                    type: 'warning',
                    title: 'Ошибка ключа API',
                    message: 'Для перевода нужен API ключ.',
                    primaryAction: {
                        label: 'Настройки',
                        onPress: () => {
                            setFeedbackModal(prev => ({ ...prev, visible: false }));
                            navigation.navigate('Settings' as never);
                        }
                    }
                });
            } else {
                showToast('Не удалось загрузить перевод', 'error');
            }
        } finally {
            setIsLoadingTranslation(false);
        }
    };

    // Photo scanning for word extraction
    const handlePhotoScan = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                showToast('Нужно разрешение на доступ к камере', 'error');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                base64: true,
                quality: 0.7,
            });

            if (result.canceled || !result.assets?.[0]?.base64) return;

            setIsScanning(true);
            const extracted = await unifiedAI.extractWordsFromImage(result.assets[0].base64);

            if (!extracted || extracted.length === 0) {
                showToast('Не удалось распознать слова на фото', 'info');
                setIsScanning(false);
                return;
            }

            // Add all extracted words
            for (const item of extracted) {
                await addWord({
                    text: item.word.toLowerCase(),
                    definition: '',
                    translation: item.translation,
                    cefrLevel: 'B1',
                    status: 'new',
                    timesShown: 0,
                    timesCorrect: 0,
                    timesWrong: 0,
                    lastReviewedAt: null,
                    nextReviewAt: Date.now(),
                    source: 'manual',
                    reviewCount: 0,
                    masteryScore: 0,
                });
            }

            await loadData();
            showToast(`✅ Добавлено ${extracted.length} слов из фото`, 'success');
            await loadData();
            showToast(`✅ Добавлено ${extracted.length} слов из фото`, 'success');
        } catch (error: any) {
            console.error('Photo scan error:', error);
            if (error.name === 'ApiKeyError') {
                setFeedbackModal({
                    visible: true,
                    type: 'warning',
                    title: 'Ошибка ключа API',
                    message: 'Для распознавания фото нужен API ключ.',
                    primaryAction: {
                        label: 'Настройки',
                        onPress: () => {
                            setFeedbackModal(prev => ({ ...prev, visible: false }));
                            navigation.navigate('Settings' as never);
                        }
                    }
                });
            } else {
                showToast('Не удалось обработать фото', 'error');
            }
        } finally {
            setIsScanning(false);
        }
    };

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
                    timesWrong: 0,
                    lastReviewedAt: null,
                    nextReviewAt: Date.now(),
                    source: 'manual',
                    reviewCount: 0,
                    masteryScore: 0,
                });
            }

            await loadData();
            setNewWord('');
            setShowAddModal(false);

            // Enrich words with AI in background (non-blocking but sequential)
            // Run as a single async task to process all words one by one
            (async () => {
                for (const wordText of wordList) {
                    try {
                        // Get fresh word list from DB for each word
                        const freshWords = await getAllWords();
                        const existingWord = freshWords.find(w => w.text === wordText);

                        if (existingWord && !existingWord.translation) {
                            // Use unifiedAI to get translation
                            const prompt = `Translate the English word "${wordText}" to Russian. 
Provide a brief definition in English.
Output JSON only: {"translation": "русский перевод", "definition": "brief English definition", "cefrLevel": "A1/A2/B1/B2/C1/C2"}`;

                            const response = await unifiedAI.generateText(prompt, { jsonMode: true });
                            if (response.success) {
                                const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                                const data = JSON.parse(cleaned);

                                await updateWord(existingWord.id, {
                                    definition: data.definition || '',
                                    translation: data.translation || '',
                                    cefrLevel: data.cefrLevel || 'B1',
                                });
                                loadData(); // Refresh to show updated data
                            }
                        }
                    } catch (e) {
                        console.log('Background enrichment failed for:', wordText);
                    }
                }
            })();
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

    const openWordDetail = async (word: DictionaryWord) => {
        // Fetch fresh data from database to ensure metrics are up-to-date
        const freshWord = await getWordById(word.id);
        setSelectedWord(freshWord || word);
        setShowDetailModal(true);
    };

    const closeDetailModal = () => {
        stop();
        setShowDetailModal(false);
        setSelectedWord(null);
    };

    const handleSpeak = (word: string) => {
        if (isSpeaking) {
            stop();
        } else {
            speak(word);
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
                            style={[styles.searchInput, { flex: 1 }]}
                            placeholder="Поиск слов..."
                            placeholderTextColor={colors.text.tertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <Pressable
                            style={styles.cameraButton}
                            onPress={handlePhotoScan}
                            disabled={isScanning}
                        >
                            <Text style={styles.cameraButtonText}>{isScanning ? '⏳' : '📷'}</Text>
                        </Pressable>
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
                        <EmptyState
                            icon="📚"
                            message={words.length === 0
                                ? 'Словарь пуст. Добавьте слова!'
                                : 'Нет слов по фильтру'}
                        />
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
                    <EmptyState
                        icon="📖"
                        title="Нет грамматических тем"
                        message="Грамматика добавляется автоматически при изучении уроков"
                    />
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

                                {item.examples && item.examples !== '[]' && (
                                    <View style={styles.grammarExamplesContainer}>
                                        <Text style={styles.grammarExamplesLabel}>Примеры ошибок:</Text>
                                        {(() => {
                                            try {
                                                const parsed = JSON.parse(item.examples);
                                                return parsed.slice(0, 2).map((ex: string, i: number) => (
                                                    <Text key={i} style={styles.grammarExampleText}>• {ex}</Text>
                                                ));
                                            } catch (e) {
                                                return null;
                                            }
                                        })()}
                                    </View>
                                )}

                                <View style={styles.grammarStats}>
                                    <Text style={styles.grammarStatText}>
                                        Практика: {item.practiceCount} | Усвоение: {Math.round(item.masteryScore * 100)}%
                                    </Text>
                                </View>
                                <VButton style={styles.grammarTestButton} onPress={() => startGrammarTest(item)} title="📝 Пройти тест" />
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
            <InputModal
                visible={showAddModal}
                title="Добавить слова"
                value={newWord}
                onChangeText={setNewWord}
                placeholder={"apple, banana, orange\nили каждое с новой строки"}
                confirmLabel={isAddingWord ? "Добавляю..." : `Добавить${newWord.split(/[,;\n]+/).filter(w => w.trim()).length > 1 ? ` (${newWord.split(/[,;\n]+/).filter(w => w.trim()).length})` : ''}`}
                onConfirm={handleAddWord}
                onCancel={() => setShowAddModal(false)}
                loading={isAddingWord}
                multiline
                numberOfLines={3}
            />

            {/* Word Detail Modal */}
            {selectedWord && (
                <WordInfoModal
                    visible={showDetailModal}
                    word={selectedWord.text}
                    translation={selectedWord.translation}
                    definition={selectedWord.definition}
                    cefrLevel={selectedWord.cefrLevel}
                    onClose={closeDetailModal}
                >
                    {/* Load Translation Button - only if missing */}
                    {(!selectedWord.translation || !selectedWord.definition) && (
                        <Pressable
                            style={[styles.loadTranslationButton, isLoadingTranslation && styles.disabledButton]}
                            onPress={loadTranslation}
                            disabled={isLoadingTranslation}
                        >
                            {isLoadingTranslation ? (
                                <ActivityIndicator size="small" color={colors.text.inverse} />
                            ) : (
                                <Text style={styles.loadTranslationText}>✨ Подгрузить перевод</Text>
                            )}
                        </Pressable>
                    )}

                    {/* Stats - Simplified correct/wrong metrics */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {selectedWord.timesShown || 0}
                            </Text>
                            <Text style={styles.statLabel}>Повторений</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {selectedWord.timesCorrect || 0}
                            </Text>
                            <Text style={styles.statLabel}>Правильно</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {selectedWord.timesWrong || 0}
                            </Text>
                            <Text style={styles.statLabel}>Неправильно</Text>
                        </View>
                    </View>

                    {/* Mastery Progress */}
                    {selectedWord.masteryScore !== undefined && (
                        <View style={styles.masteryRow}>
                            <Text style={styles.masteryLabel}>Усвоение:</Text>
                            <View style={styles.masteryTrackBig}>
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
                </WordInfoModal>
            )}

            {/* Loading Overlay when scanning */}
            <LoadingOverlay visible={isScanning} text="Распознавание слов..." />

            {/* Toast Notification */}
            {toast && (
                <Animated.View
                    style={[
                        styles.toastContainer,
                        { transform: [{ translateY: toastAnim }] },
                        toast.type === 'success' && styles.toastSuccess,
                        toast.type === 'error' && styles.toastError,
                        toast.type === 'info' && styles.toastInfo,
                    ]}
                >
                    <Text style={styles.toastText}>{toast.message}</Text>
                </Animated.View>
            )}
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
        gap: spacing.sm,
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
    cameraButton: {
        backgroundColor: colors.primary[300],
        width: 44,
        height: 44,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraButtonText: {
        fontSize: 20,
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
    disabledButton: {
        backgroundColor: colors.border.medium,
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
        marginTop: spacing.xs,
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
    masteryTrackBig: {
        flex: 1,
        height: 8,
        backgroundColor: colors.border.light,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
    },
    masteryBar: {
        flex: 1,
        height: 8,
        backgroundColor: colors.accent.green,
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
    // Load translation button
    loadTranslationButton: {
        backgroundColor: colors.accent.blue,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    loadTranslationText: {
        ...typography.bodySmall,
        color: colors.text.inverse,
        fontWeight: '600',
    },
    grammarExamplesContainer: {
        marginTop: spacing.sm,
        padding: spacing.sm,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.sm,
    },
    grammarExamplesLabel: {
        ...typography.caption,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
        fontWeight: '600',
    },
    grammarExampleText: {
        ...typography.caption,
        color: colors.text.primary,
        fontStyle: 'italic',
    },
    // Scanning overlay styles
    scanningOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    scanningContent: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xxl,
        padding: spacing.xxxl,
        alignItems: 'center',
        gap: spacing.md,
    },
    scanningText: {
        ...typography.h3,
        color: colors.text.primary,
        marginTop: spacing.lg,
    },
    scanningSubtext: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    // Toast notification styles
    toastContainer: {
        position: 'absolute',
        top: 50,
        left: spacing.lg,
        right: spacing.lg,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        zIndex: 1001,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    toastSuccess: {
        backgroundColor: colors.accent.green,
    },
    toastError: {
        backgroundColor: colors.accent.red,
    },
    toastInfo: {
        backgroundColor: colors.accent.blue,
    },
    toastText: {
        ...typography.bodyBold,
        color: colors.text.inverse,
        textAlign: 'center',
    },
});
