import { StyleSheet, Text, View, ScrollView, Pressable, Switch, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import {
    getSettings, updateSettings, getStats, UserSettings, UserStats, calculateLevel, getLevelTitle,
    getChatHistory, deleteChatSession, ChatSession
} from '@/services/storageService';
import {
    getAllAPIKeys,
    addAPIKey,
    removeAPIKey,
    enableKey,
    disableKey,
    APIKey,
    isKeyInTimeout,
    getTimeoutRemaining
} from '@/services/apiKeyService';

export default function SettingsScreen() {
    const navigation = useNavigation<any>();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
    const [savedSessions, setSavedSessions] = useState<ChatSession[]>([]);
    const [showAddKey, setShowAddKey] = useState(false);
    const [newKeyType, setNewKeyType] = useState<'google' | 'perplexity'>('google');
    const [newKeyValue, setNewKeyValue] = useState('');

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        const [s, st, keys, sessions] = await Promise.all([
            getSettings(),
            getStats(),
            getAllAPIKeys(),
            getChatHistory()
        ]);
        setSettings(s);
        setStats(st);
        setApiKeys(keys);
        setSavedSessions(sessions);
    };

    const handleToggleTranslation = async (value: boolean) => {
        if (!settings) return;
        const updated = await updateSettings({ showTranslation: value });
        setSettings(updated);
    };

    const handleSetDailyGoal = async (goal: number) => {
        if (!settings) return;
        const updated = await updateSettings({ dailyGoal: goal });
        setSettings(updated);
    };

    // Session Management
    const handleDeleteSession = async (id: string) => {
        Alert.alert(
            'Удалить чат?',
            'К сожалению, если удалить чат, его нельзя будет восстановить.',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteChatSession(id);
                        setSavedSessions(prev => prev.filter(s => s.id !== id));
                    },
                },
            ]
        );
    };

    // API Key Management
    const handleAddKey = async () => {
        if (!newKeyValue.trim()) return;

        const key = await addAPIKey(newKeyType, newKeyValue.trim());
        setApiKeys(prev => [...prev, key]);
        setNewKeyValue('');
        setShowAddKey(false);
    };

    const handleRemoveKey = async (id: string) => {
        Alert.alert(
            'Удалить ключ?',
            'Это действие нельзя отменить',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        await removeAPIKey(id);
                        setApiKeys(prev => prev.filter(k => k.id !== id));
                    },
                },
            ]
        );
    };

    const handleToggleKey = async (key: APIKey) => {
        if (key.isEnabled) {
            await disableKey(key.id);
        } else {
            await enableKey(key.id);
        }
        await loadData();
    };

    const handleReenableKey = async (id: string) => {
        await enableKey(id);
        await loadData();
    };

    if (!settings || !stats) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
        );
    }

    const dailyGoalOptions = [30, 50, 100, 150];
    const levelInfo = calculateLevel(stats.xp);

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.levelBadge}>
                        <Text style={styles.levelNumber}>{stats.level}</Text>
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileTitle}>{getLevelTitle(stats.level)}</Text>
                        <Text style={styles.profileSubtitle}>{stats.xp} XP • {stats.wordsLearned} слов</Text>
                    </View>
                </View>

                {/* Streak */}
                <View style={styles.streakCard}>
                    <Text style={styles.streakIcon}>🔥</Text>
                    <View>
                        <Text style={styles.streakNumber}>{stats.streak}</Text>
                        <Text style={styles.streakLabel}>дней подряд</Text>
                    </View>
                </View>

                {/* Settings Section */}
                <Text style={styles.sectionTitle}>Настройки обучения</Text>

                {/* Translation Mode Toggle */}
                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Показывать перевод</Text>
                        <Text style={styles.settingDescription}>
                            {settings.showTranslation
                                ? 'Показывать русский перевод слов'
                                : 'Показывать объяснение на английском'}
                        </Text>
                    </View>
                    <Switch
                        value={settings.showTranslation}
                        onValueChange={handleToggleTranslation}
                        trackColor={{ false: colors.border.medium, true: colors.primary[300] }}
                        thumbColor={colors.text.primary}
                    />
                </View>

                {/* CEFR Level Selection */}
                <Text style={styles.settingLabel}>Ваш уровень английского</Text>
                <View style={styles.levelOptions}>
                    {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map(level => (
                        <Pressable
                            key={level}
                            style={[
                                styles.levelOption,
                                settings.cefrLevel === level && styles.levelOptionActive
                            ]}
                            onPress={async () => {
                                const updated = await updateSettings({ cefrLevel: level });
                                setSettings(updated);
                            }}
                        >
                            <Text style={[
                                styles.levelText,
                                settings.cefrLevel === level && styles.levelTextActive
                            ]}>
                                {level}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <Text style={styles.levelHint}>
                    {settings.cefrLevel === 'A1' && '🌱 Начинающий - базовые фразы'}
                    {settings.cefrLevel === 'A2' && '🌿 Элементарный - простые предложения'}
                    {settings.cefrLevel === 'B1' && '🌳 Средний - повседневные темы'}
                    {settings.cefrLevel === 'B2' && '🌲 Выше среднего - сложные тексты'}
                    {settings.cefrLevel === 'C1' && '🏔️ Продвинутый - свободное общение'}
                    {settings.cefrLevel === 'C2' && '🏆 Профессиональный - носитель'}
                </Text>

                {/* Daily Goal */}
                <Text style={styles.settingLabel}>Ежедневная цель XP</Text>
                <View style={styles.goalOptions}>
                    {dailyGoalOptions.map(goal => (
                        <Pressable
                            key={goal}
                            style={[
                                styles.goalOption,
                                settings.dailyGoal === goal && styles.goalOptionActive
                            ]}
                            onPress={() => handleSetDailyGoal(goal)}
                        >
                            <Text style={[
                                styles.goalText,
                                settings.dailyGoal === goal && styles.goalTextActive
                            ]}>
                                {goal} XP
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {/* API Timeout Setting */}
                <Text style={styles.settingLabel}>Таймаут API ключа</Text>
                <View style={styles.goalOptions}>
                    {[5, 10, 30, 60, 360].map(mins => (
                        <Pressable
                            key={mins}
                            style={[
                                styles.goalOption,
                                (settings.apiTimeoutMinutes || 5) === mins && styles.goalOptionActive
                            ]}
                            onPress={async () => {
                                const updated = await updateSettings({ apiTimeoutMinutes: mins });
                                setSettings(updated);
                            }}
                        >
                            <Text style={[
                                styles.goalText,
                                (settings.apiTimeoutMinutes || 5) === mins && styles.goalTextActive
                            ]}>
                                {mins === 360 ? '6ч' : `${mins}м`}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {/* Saved Chat Sessions */}
                <Text style={styles.sectionTitle}>Сохраненные чаты</Text>
                {savedSessions.length === 0 ? (
                    <Text style={styles.emptyText}>Нет сохраненных сессий чата.</Text>
                ) : (
                    <View style={styles.sessionsList}>
                        {savedSessions.map(session => (
                            <View key={session.id} style={styles.sessionCard}>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.sessionInfo,
                                        pressed && { opacity: 0.7 }
                                    ]}
                                    onPress={() => navigation.navigate('ChatMode', { initialSession: session })}
                                >
                                    <Text style={styles.sessionTopic} numberOfLines={1}>
                                        {session.customTopic || session.topic}
                                    </Text>
                                    <Text style={styles.sessionDate}>
                                        {new Date(session.updatedAt).toLocaleDateString()} • {session.messages.length} сообщений
                                    </Text>
                                </Pressable>
                                <TouchableOpacity
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSession(session.id);
                                    }}
                                    style={styles.deleteButton}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.deleteButtonText}>Удалить</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* API Keys Section */}
                <Text style={styles.sectionTitle}>API Ключи</Text>
                <Text style={styles.settingDescription}>
                    Добавьте свои API ключи для более качественных переводов.
                </Text>

                {apiKeys.length > 0 && (
                    <View style={styles.apiKeyList}>
                        {apiKeys.map(key => {
                            const inTimeout = isKeyInTimeout(key);
                            const remainingMins = getTimeoutRemaining(key);

                            return (
                                <View key={key.id} style={styles.apiKeyCard}>
                                    <View style={styles.apiKeyHeader}>
                                        <View style={styles.apiKeyInfo}>
                                            <Text style={styles.apiKeyType}>
                                                {key.type === 'google' ? '🔵 Google AI' : '🟣 Perplexity'}
                                            </Text>
                                            <Text style={styles.apiKeyName}>{key.name}</Text>
                                        </View>
                                        <Switch
                                            value={key.isEnabled && !inTimeout}
                                            onValueChange={() => handleToggleKey(key)}
                                            trackColor={{ false: colors.border.medium, true: colors.primary[300] }}
                                            thumbColor={colors.text.primary}
                                        />
                                    </View>

                                    {inTimeout && (
                                        <View style={styles.timeoutBanner}>
                                            <Text style={styles.timeoutText}>
                                                ⏳ Таймаут: {remainingMins} мин осталось
                                            </Text>
                                            <Pressable
                                                style={styles.reenableButton}
                                                onPress={() => handleReenableKey(key.id)}
                                            >
                                                <Text style={styles.reenableButtonText}>Включить</Text>
                                            </Pressable>
                                        </View>
                                    )}

                                    <Pressable
                                        style={styles.removeKeyButton}
                                        onPress={() => handleRemoveKey(key.id)}
                                    >
                                        <Text style={styles.removeKeyText}>Удалить</Text>
                                    </Pressable>
                                </View>
                            );
                        })}
                    </View>
                )}

                {showAddKey ? (
                    <View style={styles.addKeyForm}>
                        <View style={styles.keyTypeSelector}>
                            <Pressable
                                style={[styles.keyTypeOption, newKeyType === 'google' && styles.keyTypeActive]}
                                onPress={() => setNewKeyType('google')}
                            >
                                <Text style={[styles.keyTypeText, newKeyType === 'google' && styles.keyTypeTextActive]}>
                                    🔵 Google AI
                                </Text>
                            </Pressable>
                            <Pressable
                                style={[styles.keyTypeOption, newKeyType === 'perplexity' && styles.keyTypeActive]}
                                onPress={() => setNewKeyType('perplexity')}
                            >
                                <Text style={[styles.keyTypeText, newKeyType === 'perplexity' && styles.keyTypeTextActive]}>
                                    🟣 Perplexity
                                </Text>
                            </Pressable>
                        </View>
                        <TextInput
                            style={styles.keyInput}
                            placeholder="Введите API ключ..."
                            placeholderTextColor={colors.text.tertiary}
                            value={newKeyValue}
                            onChangeText={setNewKeyValue}
                            secureTextEntry
                            autoCapitalize="none"
                        />
                        <View style={styles.addKeyButtons}>
                            <Pressable style={styles.cancelButton} onPress={() => setShowAddKey(false)}>
                                <Text style={styles.cancelButtonText}>Отмена</Text>
                            </Pressable>
                            <Pressable style={styles.saveKeyButton} onPress={handleAddKey}>
                                <Text style={styles.saveKeyButtonText}>Сохранить</Text>
                            </Pressable>
                        </View>
                    </View>
                ) : (
                    <Pressable style={styles.addKeyButton} onPress={() => setShowAddKey(true)}>
                        <Text style={styles.addKeyButtonText}>+ Добавить API ключ</Text>
                    </Pressable>
                )}

                {/* Info Section */}
                <Text style={styles.sectionTitle}>О режимах</Text>

                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>📚 Мой словарь</Text>
                    <Text style={styles.infoText}>
                        Все слова, которые вы ищете или добавляете, сохраняются здесь с русским переводом и английским объяснением.
                    </Text>
                </View>

                {/* Other info cards kept but omitted for brevity in thought process, including here */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>📖 Режим историй</Text>
                    <Text style={styles.infoText}>
                        Нажимайте на любое слово в тексте, чтобы увидеть перевод. Слово автоматически добавится в ваш словарь.
                    </Text>
                </View>

                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>🎯 Практика</Text>
                    <Text style={styles.infoText}>
                        Карточки со словами из вашего словаря. Показывается перевод или объяснение в зависимости от настроек выше.
                    </Text>
                </View>

                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>🔗 Соединение карточек</Text>
                    <Text style={styles.infoText}>
                        Соедините английские слова с их переводами или объяснениями. Режим зависит от ваших настроек.
                    </Text>
                </View>

                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>🔄 Перевод</Text>
                    <Text style={styles.infoText}>
                        Переводите предложения с русского на английский. AI проверит вашу грамматику и даст обратную связь.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    loadingText: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginTop: spacing.xxxl,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    levelBadge: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary[300],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.lg,
    },
    levelNumber: {
        ...typography.h2,
        color: colors.text.inverse,
    },
    profileInfo: {
        flex: 1,
    },
    profileTitle: {
        ...typography.h3,
        color: colors.text.primary,
    },
    profileSubtitle: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    streakCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        gap: spacing.md,
    },
    streakIcon: {
        fontSize: 40,
    },
    streakNumber: {
        ...typography.h2,
        color: colors.accent.amber,
    },
    streakLabel: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    sectionTitle: {
        ...typography.h3,
        color: colors.text.primary,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    settingInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    settingLabel: {
        ...typography.bodyBold,
        color: colors.text.primary,
        marginBottom: spacing.lg,
    },
    settingDescription: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    goalOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    goalOption: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    goalOptionActive: {
        backgroundColor: colors.primary[300],
    },
    goalText: {
        ...typography.bodyBold,
        color: colors.text.secondary,
    },
    goalTextActive: {
        color: colors.text.inverse,
    },
    levelOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    levelOption: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    levelOptionActive: {
        backgroundColor: `${colors.primary[300]}20`,
        borderColor: colors.primary[300],
    },
    levelText: {
        ...typography.bodyBold,
        color: colors.text.secondary,
    },
    levelTextActive: {
        color: colors.primary[300],
    },
    levelHint: {
        ...typography.bodySmall,
        color: colors.text.tertiary,
        marginBottom: spacing.xl,
    },
    // Sessions
    sessionsList: {
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    sessionCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sessionInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    sessionTopic: {
        ...typography.bodyBold,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    sessionDate: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    deleteButton: {
        padding: spacing.sm,
    },
    deleteButtonText: {
        ...typography.bodySmall,
        color: colors.accent.red,
        fontWeight: 'bold',
    },
    emptyText: {
        ...typography.body,
        color: colors.text.tertiary,
        textAlign: 'center',
        marginVertical: spacing.lg,
        fontStyle: 'italic',
    },
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    infoTitle: {
        ...typography.bodyBold,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    infoText: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    // API Key styles
    apiKeyList: {
        marginTop: spacing.md,
    },
    apiKeyCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    apiKeyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    apiKeyInfo: {
        flex: 1,
    },
    apiKeyType: {
        ...typography.bodyBold,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    apiKeyName: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    timeoutBanner: {
        backgroundColor: `${colors.accent.amber}20`,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginTop: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    timeoutText: {
        ...typography.bodySmall,
        color: colors.accent.amber,
    },
    reenableButton: {
        backgroundColor: colors.primary[300],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    reenableButtonText: {
        ...typography.caption,
        color: colors.text.inverse,
        fontWeight: '600',
    },
    removeKeyButton: {
        marginTop: spacing.md,
        alignItems: 'center',
    },
    removeKeyText: {
        ...typography.bodySmall,
        color: colors.accent.red,
    },
    addKeyForm: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginTop: spacing.md,
    },
    keyTypeSelector: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    keyTypeOption: {
        flex: 1,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    keyTypeActive: {
        borderColor: colors.primary[300],
        backgroundColor: `${colors.primary[300]}20`,
    },
    keyTypeText: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    keyTypeTextActive: {
        color: colors.primary[300],
        fontWeight: '600',
    },
    keyInput: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        ...typography.body,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    addKeyButtons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    cancelButtonText: {
        ...typography.body,
        color: colors.text.secondary,
    },
    saveKeyButton: {
        flex: 1,
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    saveKeyButtonText: {
        ...typography.body,
        color: colors.text.inverse,
        fontWeight: '600',
    },
    addKeyButton: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
        marginTop: spacing.md,
        borderWidth: 2,
        borderColor: colors.border.light,
        borderStyle: 'dashed',
    },
    addKeyButtonText: {
        ...typography.body,
        color: colors.primary[300],
        fontWeight: '600',
    },
});
