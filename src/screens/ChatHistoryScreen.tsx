import { StyleSheet, Text, View, FlatList, Pressable, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { getChatHistory, deleteChatSession, ChatSession } from '@/services/storageService';

export default function ChatHistoryScreen() {
    const navigation = useNavigation();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const history = await getChatHistory();
            setSessions(history);
        } catch (error) {
            console.error('Error loading chat history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [])
    );

    const handleDelete = async (sessionId: string) => {
        Alert.alert(
            'Удалить чат?',
            'Это действие нельзя отменить',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteChatSession(sessionId);
                        setSessions(prev => prev.filter(s => s.id !== sessionId));
                    },
                },
            ]
        );
    };

    const handleContinue = (session: ChatSession) => {
        // Navigate to chat with session data
        (navigation as any).navigate('ChatMode', { sessionId: session.id });
    };

    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Сегодня';
        if (diffDays === 1) return 'Вчера';
        if (diffDays < 7) return `${diffDays} дней назад`;

        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
        });
    };

    const getPreviewText = (session: ChatSession): string => {
        const lastMessage = session.messages[session.messages.length - 1];
        if (!lastMessage) return 'Пустой чат';

        const text = lastMessage.content;
        return text.length > 60 ? text.substring(0, 60) + '...' : text;
    };

    const renderSession = ({ item }: { item: ChatSession }) => (
        <Pressable
            style={styles.sessionCard}
            onPress={() => handleContinue(item)}
            onLongPress={() => handleDelete(item.id)}
        >
            <View style={styles.sessionHeader}>
                <Text style={styles.sessionTopic}>
                    {item.customTopic || item.topic}
                </Text>
                <Text style={styles.sessionDate}>
                    {formatDate(item.updatedAt)}
                </Text>
            </View>
            <Text style={styles.sessionPreview} numberOfLines={2}>
                {getPreviewText(item)}
            </Text>
            <View style={styles.sessionFooter}>
                <Text style={styles.messageCount}>
                    💬 {item.messages.length} сообщений
                </Text>
            </View>
        </Pressable>
    );

    // Group sessions by date
    const groupedSessions = sessions.reduce((groups: { [key: string]: ChatSession[] }, session) => {
        const date = formatDate(session.updatedAt);
        if (!groups[date]) groups[date] = [];
        groups[date].push(session);
        return groups;
    }, {});

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>История чатов</Text>
                <Text style={styles.subtitle}>
                    Последние 10 дней
                </Text>
            </View>

            {sessions.length === 0 && !isLoading ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyEmoji}>💬</Text>
                    <Text style={styles.emptyText}>Нет сохранённых чатов</Text>
                    <Text style={styles.emptyHint}>
                        Начните разговор в режиме Чат, и он сохранится здесь
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={sessions}
                    renderItem={renderSession}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        padding: spacing.lg,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    title: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    listContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    sessionCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    sessionTopic: {
        ...typography.bodyBold,
        color: colors.text.primary,
        flex: 1,
    },
    sessionDate: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    sessionPreview: {
        ...typography.body,
        color: colors.text.secondary,
        marginBottom: spacing.md,
    },
    sessionFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    messageCount: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xxl,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    emptyText: {
        ...typography.h3,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    emptyHint: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
    },
});
