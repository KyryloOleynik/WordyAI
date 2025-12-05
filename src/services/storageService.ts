import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as db from './database';

// Re-export DictionaryWord from database
export type { DictionaryWord } from './database';

// User settings
export interface UserSettings {
    showTranslation: boolean;  // true = Russian translation, false = English explanation
    dailyGoal: number;
    theme: 'dark' | 'light';
    cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    hasSeenOnboarding: boolean;
}

// User stats
export interface UserStats {
    xp: number;
    level: number;
    streak: number;
    lastActiveDate: string | null;
    wordsLearned: number;
    dailyXP: number;
}

// Chat message
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    corrections?: string | null;
    timestamp: number;
}

// Chat session for history
export interface ChatSession {
    id: string;
    topic: string;
    customTopic?: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
}

const STORAGE_KEYS = {
    WORDS: '@wordy_words', // Legacy key for migration
    SETTINGS: '@wordy_settings',
    STATS: '@wordy_stats',
    CHAT_HISTORY: '@wordy_chat_history',
};

const DEFAULT_SETTINGS: UserSettings = {
    showTranslation: true,
    dailyGoal: 50,
    theme: 'dark',
    cefrLevel: 'B1',
    hasSeenOnboarding: false,
};

const DEFAULT_STATS: UserStats = {
    xp: 0,
    level: 1,
    streak: 0,
    lastActiveDate: null,
    wordsLearned: 0,
    dailyXP: 0,
};

// Level titles for gamification
const LEVEL_TITLES = [
    'Beginner', 'Novice', 'Apprentice', 'Student', 'Learner',
    'Scholar', 'Enthusiast', 'Practitioner', 'Adept', 'Expert',
    'Master', 'Virtuoso', 'Sage', 'Guardian', 'Champion',
    'Legend', 'Mythic', 'Transcendent', 'Immortal', 'Supreme',
];

export function getLevelTitle(level: number): string {
    return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] || 'Supreme';
}

// XP rewards for different actions (reduced by 3x)
export const XP_REWARDS = {
    WORD_CORRECT: 2,
    WORD_CORRECT_STREAK: 3,
    WORD_EASY: 1,
    STORY_COMPLETE: 8,
    STORY_PERFECT: 17,
    TRANSLATION_CORRECT: 3,
    CHAT_MESSAGE: 1,
    DAILY_GOAL_COMPLETE: 5,
    STREAK_BONUS: 2,
    EXERCISE_COMPLETE: 3,
};

// Initialize database at app startup
let dbInitialized = false;
async function ensureDbInitialized(): Promise<void> {
    if (!dbInitialized && Platform.OS !== 'web') {
        await db.initDatabase();
        dbInitialized = true;
    }
}

// ============ WORDS (SQLite on native, AsyncStorage on web) ============

export async function getAllWords(): Promise<db.DictionaryWord[]> {
    await ensureDbInitialized();

    if (Platform.OS === 'web') {
        // Fallback to AsyncStorage on web
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.WORDS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    return db.getAllWords();
}

export async function addWord(word: Omit<db.DictionaryWord, 'id' | 'createdAt'>): Promise<db.DictionaryWord> {
    await ensureDbInitialized();

    if (Platform.OS === 'web') {
        // Fallback to AsyncStorage on web
        const words = await getAllWords();
        const existing = words.find(w => w.text.toLowerCase() === word.text.toLowerCase());
        if (existing) return existing;

        const newWord: db.DictionaryWord = {
            ...word,
            id: Date.now().toString(),
            createdAt: Date.now(),
        };
        words.unshift(newWord);
        await AsyncStorage.setItem(STORAGE_KEYS.WORDS, JSON.stringify(words));
        return newWord;
    }

    const result = await db.addWord(word);
    return result || { ...word, id: Date.now().toString(), createdAt: Date.now() };
}

export async function updateWord(id: string, updates: Partial<db.DictionaryWord>): Promise<void> {
    await ensureDbInitialized();

    if (Platform.OS === 'web') {
        const words = await getAllWords();
        const index = words.findIndex(w => w.id === id);
        if (index !== -1) {
            words[index] = { ...words[index], ...updates };
            await AsyncStorage.setItem(STORAGE_KEYS.WORDS, JSON.stringify(words));
        }
        return;
    }

    await db.updateWord(id, updates);
}

export async function deleteWord(id: string): Promise<void> {
    await ensureDbInitialized();

    if (Platform.OS === 'web') {
        const words = await getAllWords();
        const filtered = words.filter(w => w.id !== id);
        await AsyncStorage.setItem(STORAGE_KEYS.WORDS, JSON.stringify(filtered));
        return;
    }

    await db.deleteWord(id);
}

export async function getWordsForReview(limit: number = 20): Promise<db.DictionaryWord[]> {
    await ensureDbInitialized();

    if (Platform.OS === 'web') {
        const words = await getAllWords();
        const now = Date.now();
        return words
            .filter(w => w.status !== 'known' || w.nextReviewAt <= now)
            .sort((a, b) => {
                if (a.status === 'new' && b.status !== 'new') return -1;
                if (b.status === 'new' && a.status !== 'new') return 1;
                return a.nextReviewAt - b.nextReviewAt;
            })
            .slice(0, limit);
    }

    return db.getWordsForReview(limit);
}

export async function getWordById(wordId: string): Promise<db.DictionaryWord | null> {
    await ensureDbInitialized();

    if (Platform.OS === 'web') {
        const words = await getAllWords();
        return words.find(w => w.id === wordId) || null;
    }

    return db.getWordById(wordId);
}

/**
 * Update word metrics - works on both web and native platforms
 */
export async function updateWordMetrics(
    wordId: string,
    _exerciseType: string,
    isCorrect: boolean
): Promise<void> {
    await ensureDbInitialized();

    if (Platform.OS === 'web') {
        // Web fallback - update via AsyncStorage
        const words = await getAllWords();
        const index = words.findIndex(w => w.id === wordId);
        if (index !== -1) {
            const word = words[index];
            const now = Date.now();

            if (isCorrect) {
                words[index] = {
                    ...word,
                    timesCorrect: (word.timesCorrect || 0) + 1,
                    timesShown: (word.timesShown || 0) + 1,
                    reviewCount: (word.reviewCount || 0) + 1,
                    lastReviewedAt: now,
                };
            } else {
                words[index] = {
                    ...word,
                    timesWrong: (word.timesWrong || 0) + 1,
                    timesShown: (word.timesShown || 0) + 1,
                    reviewCount: (word.reviewCount || 0) + 1,
                    lastReviewedAt: now,
                };
            }

            // Recalculate mastery score
            const totalCorrect = words[index].timesCorrect || 0;
            const totalWrong = words[index].timesWrong || 0;
            const totalAttempts = totalCorrect + totalWrong;
            const accuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
            const repetitionFactor = Math.min((words[index].reviewCount || 0) / 10, 1);
            words[index].masteryScore = accuracy * 0.7 + repetitionFactor * 0.3;

            // Update status
            if (words[index].status === 'new' && words[index].reviewCount > 0) {
                words[index].status = 'learning';
            } else if (words[index].status === 'learning' &&
                words[index].masteryScore >= 0.8 &&
                (words[index].reviewCount || 0) >= 5) {
                words[index].status = 'known';
            }

            await AsyncStorage.setItem(STORAGE_KEYS.WORDS, JSON.stringify(words));
            console.log('[StorageService] Web: Updated metrics for', wordId, isCorrect ? 'correct' : 'wrong');
        }
        return;
    }

    // Native - use SQLite
    await db.updateWordMetrics(wordId, _exerciseType, isCorrect);
}

// SM-2 Algorithm
export async function processReview(wordId: string, grade: 1 | 2 | 3 | 4): Promise<number> {
    const words = await getAllWords();
    const word = words.find(w => w.id === wordId);
    if (!word) return 0;

    const now = Date.now();
    let intervalDays = 1;

    // Calculate next review interval based on grade
    if (grade === 1) {
        intervalDays = 1; // Again - repeat soon
    } else if (grade === 2) {
        intervalDays = 3; // Hard
    } else if (grade === 3) {
        intervalDays = 7; // Good
    } else {
        intervalDays = 14; // Easy
    }

    // Adjust based on history
    if (word.timesCorrect > 5) {
        intervalDays *= 2;
    }

    const updates: Partial<db.DictionaryWord> = {
        timesShown: word.timesShown + 1,
        timesCorrect: grade >= 3 ? word.timesCorrect + 1 : word.timesCorrect,
        lastReviewedAt: now,
        nextReviewAt: now + intervalDays * 24 * 60 * 60 * 1000,
        status: word.timesCorrect >= 10 ? 'known' : 'learning',
    };

    await updateWord(wordId, updates);

    // Return XP earned
    return grade >= 3 ? (grade === 4 ? 5 : 10) : 0;
}

// ============ SETTINGS ============

export async function getSettings(): Promise<UserSettings> {
    try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
        return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (e) {
        return DEFAULT_SETTINGS;
    }
}

export async function updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
    const current = await getSettings();
    const updated = { ...current, ...updates };
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
}

// ============ STATS ============

export async function getStats(): Promise<UserStats> {
    try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.STATS);
        const stats = data ? { ...DEFAULT_STATS, ...JSON.parse(data) } : DEFAULT_STATS;

        // Check if new day - reset daily XP
        const today = new Date().toDateString();
        if (stats.lastActiveDate !== today) {
            // Check streak
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (stats.lastActiveDate === yesterday.toDateString()) {
                stats.streak += 1;
            } else if (stats.lastActiveDate !== today) {
                stats.streak = 1;
            }

            stats.dailyXP = 0;
            stats.lastActiveDate = today;
            await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
        }

        return stats;
    } catch (e) {
        return DEFAULT_STATS;
    }
}

export async function addXP(amount: number): Promise<UserStats> {
    const stats = await getStats();
    stats.xp += amount;
    stats.dailyXP += amount;

    // Calculate level with progressive XP requirement (+20% each level)
    stats.level = calculateLevel(stats.xp).level;

    await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    return stats;
}

// Progressive leveling: each level requires 20% more XP than previous
// Level 1: 100 XP, Level 2: 120 XP, Level 3: 144 XP, etc.
export function calculateLevel(totalXP: number): {
    level: number;
    xpForNext: number;
    currentLevelXP: number;
    progressPercent: number;
} {
    let level = 1;
    let xpNeeded = 100; // Base XP for level 1
    let totalNeeded = 0;

    while (totalXP >= totalNeeded + xpNeeded) {
        totalNeeded += xpNeeded;
        level++;
        xpNeeded = Math.floor(xpNeeded * 1.2); // 20% increase
    }

    const currentLevelXP = totalXP - totalNeeded;
    const progressPercent = Math.round((currentLevelXP / xpNeeded) * 100);

    return {
        level,
        xpForNext: xpNeeded,
        currentLevelXP,
        progressPercent,
    };
}

export async function incrementWordsLearned(): Promise<void> {
    const stats = await getStats();
    stats.wordsLearned += 1;
    await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

// ============ CHAT HISTORY ============

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

export async function getChatHistory(): Promise<ChatSession[]> {
    try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
        const sessions: ChatSession[] = data ? JSON.parse(data) : [];

        // Filter to last 10 days
        const cutoff = Date.now() - TEN_DAYS_MS;
        return sessions.filter(s => s.updatedAt > cutoff);
    } catch (e) {
        console.error('Error getting chat history:', e);
        return [];
    }
}

export async function saveChatSession(session: ChatSession): Promise<void> {
    const sessions = await getChatHistory();
    const existingIndex = sessions.findIndex(s => s.id === session.id);

    if (existingIndex !== -1) {
        sessions[existingIndex] = session;
    } else {
        sessions.unshift(session);
    }

    // Cleanup old sessions (older than 10 days)
    const cutoff = Date.now() - TEN_DAYS_MS;
    const filtered = sessions.filter(s => s.updatedAt > cutoff);

    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(filtered));
}

export async function deleteChatSession(sessionId: string): Promise<void> {
    const sessions = await getChatHistory();
    const filtered = sessions.filter(s => s.id !== sessionId);
    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(filtered));
}

export async function cleanupOldChats(): Promise<void> {
    const sessions = await getChatHistory();
    const cutoff = Date.now() - TEN_DAYS_MS;
    const filtered = sessions.filter(s => s.updatedAt > cutoff);
    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(filtered));
}

