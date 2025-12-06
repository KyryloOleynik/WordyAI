import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { getStats, getAllWords, getSettings, UserStats, UserSettings, getLevelTitle, calculateLevel } from '@/services/storageService';
import { VCard } from '@/components/ui/DesignSystem';

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [wordsToReview, setWordsToReview] = useState(0);
    const [totalWords, setTotalWords] = useState(0);

    const loadData = async () => {
        const [s, set, words] = await Promise.all([
            getStats(),
            getSettings(),
            getAllWords(),
        ]);
        setStats(s);
        setSettings(set);
        setTotalWords(words.length);

        // Count words to review
        const now = Date.now();
        const reviewCount = words.filter(w =>
            w.status !== 'known' || w.nextReviewAt <= now
        ).length;
        setWordsToReview(reviewCount);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    if (!stats || !settings) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
        );
    }

    const levelData = calculateLevel(stats.xp);
    const levelProgress = levelData.progressPercent;
    const xpToNext = levelData.xpForNext - levelData.currentLevelXP;
    const levelTitle = getLevelTitle(stats.level);
    const dailyProgress = Math.min((stats.dailyXP / settings.dailyGoal) * 100, 100);

    const menuItems = [
        {
            id: '1',
            title: 'Уроки',
            subtitle: wordsToReview > 0 ? `${wordsToReview} слов к повторению` : 'Начать урок',
            icon: '🎓',
            color: colors.primary[300],
            screen: 'Lessons',
            highlight: wordsToReview > 0,
        },
        {
            id: '2',
            title: 'Мой словарь',
            subtitle: `${totalWords} слов`,
            icon: '📚',
            color: colors.accent.blue,
            screen: 'MyDictionary',
        },
        {
            id: '3',
            title: 'Перевод',
            subtitle: 'С русского на английский',
            icon: '🔄',
            color: colors.accent.amber,
            screen: 'TranslationMode',
        },
        {
            id: '4',
            title: 'Соединение',
            subtitle: settings.showTranslation ? 'Слово + перевод' : 'Слово + определение',
            icon: '🔗',
            color: colors.accent.purple,
            screen: 'MatchingMode',
        },
        {
            id: '5',
            title: 'Чат',
            subtitle: 'Практика разговора',
            icon: '💬',
            color: colors.cefr.B1,
            screen: 'ChatMode',
        },
        {
            id: '6',
            title: 'Истории',
            subtitle: 'Читай и учи слова',
            icon: '📖',
            color: colors.cefr.C1,
            screen: 'StoryMode',
        },
    ];

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Header with XP & Streak */}
                <View style={styles.header}>
                    <Pressable style={styles.streakBadge} onPress={() => navigation.navigate('Settings')}>
                        <Text style={styles.streakIcon}>🔥</Text>
                        <Text style={styles.streakText}>{stats.streak}</Text>
                    </Pressable>
                    <Pressable style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
                        <Text style={styles.settingsIcon}>⚙️</Text>
                    </Pressable>
                </View>

                {/* Level Progress Card */}
                <View style={styles.levelCard}>
                    <View style={styles.levelHeader}>
                        <View style={styles.levelBadge}>
                            <Text style={styles.levelNumber}>{stats.level}</Text>
                        </View>
                        <View style={styles.levelInfo}>
                            <Text style={styles.levelTitle}>{levelTitle}</Text>
                            <Text style={styles.levelSubtitle}>{xpToNext} XP до уровня {stats.level + 1}</Text>
                        </View>
                        <View style={styles.xpDisplay}>
                            <Text style={styles.xpText}>{stats.xp}</Text>
                            <Text style={styles.xpLabel}>XP</Text>
                        </View>
                    </View>
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${levelProgress}%` }]} />
                    </View>
                </View>

                {/* Daily Goal */}
                <View style={styles.dailyCard}>
                    <View style={styles.dailyHeader}>
                        <Text style={styles.dailyTitle}>Ежедневная цель</Text>
                        <Text style={styles.dailyProgress}>
                            {stats.dailyXP}/{settings.dailyGoal} XP
                        </Text>
                    </View>
                    <View style={styles.dailyProgressContainer}>
                        <View style={[styles.dailyProgressBar, { width: `${dailyProgress}%` }]} />
                    </View>
                    {stats.dailyXP >= settings.dailyGoal && (
                        <Text style={styles.goalComplete}>✓ Цель выполнена!</Text>
                    )}
                </View>

                {/* Menu Grid */}
                <View style={styles.menuGrid}>
                    {/* Using Map to ensure unique keys and easier management */}
                    {/* Note: VCard doesn't support width styling directly as efficiently as flex basis for grid.
                        We will wrap VCard or style it directly.
                        Let's update styles.menuCard to be compatible or wrap it.
                     */}
                    {menuItems.map((item) => (
                        <View key={item.id} style={styles.menuCardContainer}>
                            <VCard
                                style={[
                                    styles.menuCard,
                                    item.highlight && styles.menuCardHighlight
                                ]}
                                onPress={() => navigation.navigate(item.screen)}
                                variant={item.highlight ? 'elevated' : 'default'}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
                                    <Text style={styles.menuIcon}>{item.icon}</Text>
                                </View>
                                <Text style={styles.menuTitle}>{item.title}</Text>
                                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                                {item.highlight && <View style={styles.highlightDot} />}
                            </VCard>
                        </View>
                    ))}
                </View>

                {/* Add Content */}
                <Pressable
                    style={styles.addContentButton}
                    onPress={() => navigation.navigate('YouTubeIngestion')}
                >
                    <Text style={styles.addContentIcon}>➕</Text>
                    <Text style={styles.addContentText}>Добавить контент (YouTube)</Text>
                </Pressable>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
    },
    streakIcon: {
        fontSize: 20,
        marginRight: spacing.xs,
    },
    streakText: {
        ...typography.bodyBold,
        color: colors.accent.amber,
    },
    settingsButton: {
        backgroundColor: colors.surface,
        padding: spacing.sm,
        borderRadius: borderRadius.full,
    },
    settingsIcon: {
        fontSize: 24,
    },
    levelCard: {
        backgroundColor: colors.surface,
        padding: spacing.xl,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.lg,
    },
    levelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    levelBadge: {
        width: 56,
        height: 56,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary[300],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.lg,
    },
    levelNumber: {
        ...typography.h2,
        color: colors.text.inverse,
    },
    levelInfo: {
        flex: 1,
    },
    levelTitle: {
        ...typography.h3,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    levelSubtitle: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    xpDisplay: {
        alignItems: 'center',
    },
    xpText: {
        ...typography.h2,
        color: colors.accent.amber,
    },
    xpLabel: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    progressBarContainer: {
        height: 12,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.full,
    },
    dailyCard: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
    },
    dailyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    dailyTitle: {
        ...typography.bodyBold,
        color: colors.text.primary,
    },
    dailyProgress: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    dailyProgressContainer: {
        height: 8,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    dailyProgressBar: {
        height: '100%',
        backgroundColor: colors.accent.amber,
        borderRadius: borderRadius.full,
    },
    goalComplete: {
        ...typography.caption,
        color: colors.accent.green,
        marginTop: spacing.sm,
        textAlign: 'center',
    },
    menuGrid: {
        marginBottom: spacing.sm,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    menuCardContainer: {
        width: '50%',
        padding: spacing.sm,
    },
    menuCard: {
        minHeight: 140,
        flex: 1, // Allow card to fill the container height (determined by row tallest)
        width: '100%',
    },
    menuCardHighlight: {
        borderRadius: 22,
        borderColor: colors.primary[300],
        borderWidth: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    menuIcon: {
        fontSize: 24,
    },
    menuTitle: {
        ...typography.bodyBold,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    menuSubtitle: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    highlightDot: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.accent.green,
    },
    addContentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        gap: spacing.md,
    },
    addContentIcon: {
        fontSize: 20,
    },
    addContentText: {
        ...typography.body,
        color: colors.text.secondary,
    },
});
