// src/services/database.ts
// SQLite database service for unlimited word storage

import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Database instance (singleton)
let db: SQLite.SQLiteDatabase | null = null;

// Word interface (same as storageService)
export interface DictionaryWord {
    id: string;
    text: string;
    definition: string;
    translation: string;
    cefrLevel: string;
    status: 'new' | 'learning' | 'known';
    timesShown: number;
    timesCorrect: number;
    lastReviewedAt: number | null;
    nextReviewAt: number;
    source: 'manual' | 'lookup' | 'youtube';
    createdAt: number;
}

const MIGRATION_KEY = '@wordy_sqlite_migrated';
const OLD_WORDS_KEY = '@wordy_words';

/**
 * Initialize the database - call this at app startup
 */
export async function initDatabase(): Promise<void> {
    if (db) return; // Already initialized

    // On web, SQLite is not available - use AsyncStorage fallback
    if (Platform.OS === 'web') {
        console.log('Web platform: SQLite not available, using AsyncStorage');
        return;
    }

    try {
        db = await SQLite.openDatabaseAsync('wordy.db');

        // Create words table if not exists
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS words (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL UNIQUE,
                definition TEXT NOT NULL,
                translation TEXT NOT NULL,
                cefrLevel TEXT NOT NULL DEFAULT 'B1',
                status TEXT NOT NULL DEFAULT 'new',
                timesShown INTEGER NOT NULL DEFAULT 0,
                timesCorrect INTEGER NOT NULL DEFAULT 0,
                lastReviewedAt INTEGER,
                nextReviewAt INTEGER NOT NULL,
                source TEXT NOT NULL DEFAULT 'lookup',
                createdAt INTEGER NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_words_text ON words(text);
            CREATE INDEX IF NOT EXISTS idx_words_status ON words(status);
            CREATE INDEX IF NOT EXISTS idx_words_nextReview ON words(nextReviewAt);
        `);

        console.log('SQLite database initialized');

        // Migrate from AsyncStorage if needed
        await migrateFromAsyncStorage();
    } catch (error) {
        console.error('Failed to initialize SQLite:', error);
        db = null;
    }
}

/**
 * One-time migration from AsyncStorage to SQLite
 */
async function migrateFromAsyncStorage(): Promise<void> {
    if (!db) return;

    try {
        const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
        if (migrated === 'true') return;

        const oldData = await AsyncStorage.getItem(OLD_WORDS_KEY);
        if (!oldData) {
            await AsyncStorage.setItem(MIGRATION_KEY, 'true');
            return;
        }

        const words: DictionaryWord[] = JSON.parse(oldData);
        if (words.length === 0) {
            await AsyncStorage.setItem(MIGRATION_KEY, 'true');
            return;
        }

        console.log(`Migrating ${words.length} words from AsyncStorage to SQLite...`);

        // Insert in batches of 100
        for (let i = 0; i < words.length; i += 100) {
            const batch = words.slice(i, i + 100);

            for (const word of batch) {
                try {
                    await db.runAsync(
                        `INSERT OR IGNORE INTO words 
                        (id, text, definition, translation, cefrLevel, status, timesShown, timesCorrect, lastReviewedAt, nextReviewAt, source, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            word.id,
                            word.text.toLowerCase(),
                            word.definition,
                            word.translation,
                            word.cefrLevel,
                            word.status,
                            word.timesShown,
                            word.timesCorrect,
                            word.lastReviewedAt,
                            word.nextReviewAt,
                            word.source,
                            word.createdAt
                        ]
                    );
                } catch (e) {
                    // Skip duplicates
                }
            }
        }

        await AsyncStorage.setItem(MIGRATION_KEY, 'true');
        console.log('Migration complete!');
    } catch (error) {
        console.error('Migration error:', error);
    }
}

/**
 * Check if SQLite is available
 */
export function isDbAvailable(): boolean {
    return db !== null;
}

// ============ WORD CRUD OPERATIONS ============

export async function getAllWords(): Promise<DictionaryWord[]> {
    if (!db) return [];

    try {
        const result = await db.getAllAsync<DictionaryWord>(
            'SELECT * FROM words ORDER BY createdAt DESC'
        );
        return result;
    } catch (error) {
        console.error('Error getting all words:', error);
        return [];
    }
}

export async function getWordByText(text: string): Promise<DictionaryWord | null> {
    if (!db) return null;

    try {
        const result = await db.getFirstAsync<DictionaryWord>(
            'SELECT * FROM words WHERE text = ?',
            [text.toLowerCase()]
        );
        return result || null;
    } catch (error) {
        console.error('Error getting word:', error);
        return null;
    }
}

export async function addWord(word: Omit<DictionaryWord, 'id' | 'createdAt'>): Promise<DictionaryWord | null> {
    if (!db) return null;

    try {
        // Check if exists
        const existing = await getWordByText(word.text);
        if (existing) return existing;

        const id = Date.now().toString();
        const createdAt = Date.now();

        await db.runAsync(
            `INSERT INTO words 
            (id, text, definition, translation, cefrLevel, status, timesShown, timesCorrect, lastReviewedAt, nextReviewAt, source, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                word.text.toLowerCase(),
                word.definition,
                word.translation,
                word.cefrLevel,
                word.status,
                word.timesShown,
                word.timesCorrect,
                word.lastReviewedAt,
                word.nextReviewAt,
                word.source,
                createdAt
            ]
        );

        return { ...word, id, createdAt };
    } catch (error) {
        console.error('Error adding word:', error);
        return null;
    }
}

export async function updateWord(id: string, updates: Partial<DictionaryWord>): Promise<void> {
    if (!db) return;

    try {
        const fields: string[] = [];
        const values: any[] = [];

        Object.entries(updates).forEach(([key, value]) => {
            if (key !== 'id' && value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (fields.length === 0) return;

        values.push(id);
        await db.runAsync(
            `UPDATE words SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    } catch (error) {
        console.error('Error updating word:', error);
    }
}

export async function deleteWord(id: string): Promise<void> {
    if (!db) return;

    try {
        await db.runAsync('DELETE FROM words WHERE id = ?', [id]);
    } catch (error) {
        console.error('Error deleting word:', error);
    }
}

export async function getWordsForReview(limit: number = 20): Promise<DictionaryWord[]> {
    if (!db) return [];

    try {
        const now = Date.now();
        const result = await db.getAllAsync<DictionaryWord>(
            `SELECT * FROM words 
             WHERE status != 'known' OR nextReviewAt <= ?
             ORDER BY 
                CASE WHEN status = 'new' THEN 0 ELSE 1 END,
                nextReviewAt ASC
             LIMIT ?`,
            [now, limit]
        );
        return result;
    } catch (error) {
        console.error('Error getting words for review:', error);
        return [];
    }
}

export async function getWordCount(): Promise<number> {
    if (!db) return 0;

    try {
        const result = await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM words'
        );
        return result?.count || 0;
    } catch (error) {
        return 0;
    }
}

export async function getWordCountByStatus(): Promise<{ new: number; learning: number; known: number }> {
    if (!db) return { new: 0, learning: 0, known: 0 };

    try {
        const result = await db.getAllAsync<{ status: string; count: number }>(
            'SELECT status, COUNT(*) as count FROM words GROUP BY status'
        );

        const counts = { new: 0, learning: 0, known: 0 };
        result.forEach(row => {
            if (row.status === 'new') counts.new = row.count;
            if (row.status === 'learning') counts.learning = row.count;
            if (row.status === 'known') counts.known = row.count;
        });
        return counts;
    } catch (error) {
        return { new: 0, learning: 0, known: 0 };
    }
}

/**
 * Search words by text (prefix match)
 */
export async function searchWords(query: string, limit: number = 20): Promise<DictionaryWord[]> {
    if (!db || !query) return [];

    try {
        const result = await db.getAllAsync<DictionaryWord>(
            'SELECT * FROM words WHERE text LIKE ? ORDER BY text LIMIT ?',
            [`${query.toLowerCase()}%`, limit]
        );
        return result;
    } catch (error) {
        console.error('Error searching words:', error);
        return [];
    }
}
