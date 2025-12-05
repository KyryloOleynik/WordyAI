// src/services/database.ts
// SQLite database service for unlimited word storage

import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Database instance (singleton)
let db: SQLite.SQLiteDatabase | null = null;

// Word interface with extended metrics for learning tracking
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
    source: 'manual' | 'lookup' | 'youtube' | 'lesson';
    createdAt: number;
    // Extended metrics
    translationCorrect: number;
    translationWrong: number;
    matchingCorrect: number;
    matchingWrong: number;
    lessonCorrect: number;
    lessonWrong: number;
    reviewCount: number;
    masteryScore: number; // 0.0 - 1.0
}

// Grammar concept interface for tracking grammar patterns
export interface GrammarConcept {
    id: string;
    name: string;           // e.g., "Present Perfect"
    nameRu: string;         // Russian name
    description: string;    // Russian explanation
    examples: string;       // JSON array of example sentences
    rule: string;           // Grammar rule explanation
    errorCount: number;     // Times user made this error
    practiceCount: number;  // Times practiced
    masteryScore: number;   // 0.0 - 1.0
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
                createdAt INTEGER NOT NULL,
                translationCorrect INTEGER NOT NULL DEFAULT 0,
                translationWrong INTEGER NOT NULL DEFAULT 0,
                matchingCorrect INTEGER NOT NULL DEFAULT 0,
                matchingWrong INTEGER NOT NULL DEFAULT 0,
                lessonCorrect INTEGER NOT NULL DEFAULT 0,
                lessonWrong INTEGER NOT NULL DEFAULT 0,
                reviewCount INTEGER NOT NULL DEFAULT 0,
                masteryScore REAL NOT NULL DEFAULT 0.0
            );
            
            CREATE INDEX IF NOT EXISTS idx_words_text ON words(text);
            CREATE INDEX IF NOT EXISTS idx_words_status ON words(status);
            CREATE INDEX IF NOT EXISTS idx_words_nextReview ON words(nextReviewAt);
            CREATE INDEX IF NOT EXISTS idx_words_mastery ON words(masteryScore);
        `);

        // Create grammar concepts table
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS grammar_concepts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                nameRu TEXT NOT NULL,
                description TEXT NOT NULL,
                examples TEXT NOT NULL DEFAULT '[]',
                rule TEXT NOT NULL,
                errorCount INTEGER NOT NULL DEFAULT 0,
                practiceCount INTEGER NOT NULL DEFAULT 0,
                masteryScore REAL NOT NULL DEFAULT 0.0,
                createdAt INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_grammar_name ON grammar_concepts(name);
            CREATE INDEX IF NOT EXISTS idx_grammar_errors ON grammar_concepts(errorCount DESC);
        `);

        // Add new columns if they don't exist (for existing databases)
        try {
            await db.execAsync(`
                ALTER TABLE words ADD COLUMN translationCorrect INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE words ADD COLUMN translationWrong INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE words ADD COLUMN matchingCorrect INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE words ADD COLUMN matchingWrong INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE words ADD COLUMN lessonCorrect INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE words ADD COLUMN lessonWrong INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE words ADD COLUMN reviewCount INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE words ADD COLUMN masteryScore REAL NOT NULL DEFAULT 0.0;
        `);
        } catch {
            // Columns already exist, ignore error
        }

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
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            `UPDATE words SET ${fields.join(', ')} WHERE id = ? `,
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
        LIMIT ? `,
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
            [`${query.toLowerCase()}% `, limit]
        );
        return result;
    } catch (error) {
        console.error('Error searching words:', error);
        return [];
    }
}

// ============ WORD METRICS OPERATIONS ============

export type ExerciseType = 'translation' | 'matching' | 'lesson' | 'flashcard';

/**
 * Update word metrics after an exercise
 */
export async function updateWordMetrics(
    wordId: string,
    exerciseType: ExerciseType,
    isCorrect: boolean
): Promise<void> {
    if (!db) return;

    try {
        const now = Date.now();

        // Build update query based on exercise type
        let correctField = 'timesCorrect';
        let wrongField = 'timesShown'; // timesShown acts as total attempts for flashcards

        if (exerciseType === 'translation') {
            correctField = isCorrect ? 'translationCorrect' : 'translationCorrect';
            wrongField = isCorrect ? 'translationWrong' : 'translationWrong';
        } else if (exerciseType === 'matching') {
            correctField = 'matchingCorrect';
            wrongField = 'matchingWrong';
        } else if (exerciseType === 'lesson') {
            correctField = 'lessonCorrect';
            wrongField = 'lessonWrong';
        }

        if (exerciseType === 'translation') {
            if (isCorrect) {
                await db.runAsync(
                    `UPDATE words SET translationCorrect = translationCorrect + 1,
            reviewCount = reviewCount + 1, lastReviewedAt = ? WHERE id = ? `,
                    [now, wordId]
                );
            } else {
                await db.runAsync(
                    `UPDATE words SET translationWrong = translationWrong + 1,
            reviewCount = reviewCount + 1, lastReviewedAt = ? WHERE id = ? `,
                    [now, wordId]
                );
            }
        } else if (exerciseType === 'matching') {
            if (isCorrect) {
                await db.runAsync(
                    `UPDATE words SET matchingCorrect = matchingCorrect + 1,
            reviewCount = reviewCount + 1, lastReviewedAt = ? WHERE id = ? `,
                    [now, wordId]
                );
            } else {
                await db.runAsync(
                    `UPDATE words SET matchingWrong = matchingWrong + 1,
            reviewCount = reviewCount + 1, lastReviewedAt = ? WHERE id = ? `,
                    [now, wordId]
                );
            }
        } else if (exerciseType === 'lesson') {
            if (isCorrect) {
                await db.runAsync(
                    `UPDATE words SET lessonCorrect = lessonCorrect + 1,
            reviewCount = reviewCount + 1, lastReviewedAt = ? WHERE id = ? `,
                    [now, wordId]
                );
            } else {
                await db.runAsync(
                    `UPDATE words SET lessonWrong = lessonWrong + 1,
            reviewCount = reviewCount + 1, lastReviewedAt = ? WHERE id = ? `,
                    [now, wordId]
                );
            }
        } else {
            // flashcard
            await db.runAsync(
                `UPDATE words SET
        timesShown = timesShown + 1,
            timesCorrect = timesCorrect + ?,
            reviewCount = reviewCount + 1,
            lastReviewedAt = ? WHERE id = ? `,
                [isCorrect ? 1 : 0, now, wordId]
            );
        }

        // Recalculate mastery score and update status
        await recalculateMasteryScore(wordId);
        await updateWordStatus(wordId);
    } catch (error) {
        console.error('Error updating word metrics:', error);
    }
}

/**
 * Calculate and update mastery score for a word
 * Formula: 70% accuracy + 30% repetition factor
 */
export async function recalculateMasteryScore(wordId: string): Promise<number> {
    if (!db) return 0;

    try {
        const word = await db.getFirstAsync<DictionaryWord>(
            'SELECT * FROM words WHERE id = ?',
            [wordId]
        );

        if (!word) return 0;

        // Calculate total correct and attempts across all exercise types
        const totalCorrect = (word.translationCorrect || 0) +
            (word.matchingCorrect || 0) +
            (word.lessonCorrect || 0) +
            (word.timesCorrect || 0);

        const totalWrong = (word.translationWrong || 0) +
            (word.matchingWrong || 0) +
            (word.lessonWrong || 0);

        const totalAttempts = totalCorrect + totalWrong + (word.timesShown || 0);

        // Accuracy component (0-1)
        const accuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

        // Repetition factor: caps at 10 reviews for full bonus
        const repetitionFactor = Math.min((word.reviewCount || 0) / 10, 1);

        // Final score: 70% accuracy + 30% repetition
        const masteryScore = accuracy * 0.7 + repetitionFactor * 0.3;

        await db.runAsync(
            'UPDATE words SET masteryScore = ? WHERE id = ?',
            [masteryScore, wordId]
        );

        return masteryScore;
    } catch (error) {
        console.error('Error calculating mastery score:', error);
        return 0;
    }
}

/**
 * Update word status based on mastery score and review count
 * new -> learning: After first successful exercise
 * learning -> known: masteryScore >= 0.8 AND reviewCount >= 5
 */
export async function updateWordStatus(wordId: string): Promise<void> {
    if (!db) return;

    try {
        const word = await db.getFirstAsync<DictionaryWord>(
            'SELECT * FROM words WHERE id = ?',
            [wordId]
        );

        if (!word) return;

        let newStatus = word.status;

        if (word.status === 'new') {
            // Move to learning after any review
            if ((word.reviewCount || 0) > 0) {
                newStatus = 'learning';
            }
        } else if (word.status === 'learning') {
            // Move to known if high mastery and enough reviews
            if ((word.masteryScore || 0) >= 0.8 && (word.reviewCount || 0) >= 5) {
                newStatus = 'known';
            }
        }

        if (newStatus !== word.status) {
            await db.runAsync(
                'UPDATE words SET status = ? WHERE id = ?',
                [newStatus, wordId]
            );
            console.log(`Word "${word.text}" status changed: ${word.status} -> ${newStatus} `);
        }
    } catch (error) {
        console.error('Error updating word status:', error);
    }
}

/**
 * Get words for practice with priority selection
 * Prioritizes: low mastery score + longer time since review
 */
export async function getWordsForPractice(
    limit: number = 10,
    excludeKnown: boolean = true
): Promise<DictionaryWord[]> {
    if (!db) return [];

    try {
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;

        // Calculate priority: (1 - masteryScore) * 0.6 + daysSinceReview * 0.4
        // Words with low mastery and long time since review get highest priority
        const query = excludeKnown
            ? `SELECT *,
            ((1 - COALESCE(masteryScore, 0)) * 0.6 +
                COALESCE((? - lastReviewedAt) / ?, 1) * 0.4) as priority
               FROM words 
               WHERE status != 'known'
               ORDER BY priority DESC, RANDOM()
        LIMIT ? `
            : `SELECT *,
            ((1 - COALESCE(masteryScore, 0)) * 0.6 +
                COALESCE((? - lastReviewedAt) / ?, 1) * 0.4) as priority
               FROM words 
               ORDER BY priority DESC, RANDOM()
        LIMIT ? `;

        const result = await db.getAllAsync<DictionaryWord>(
            query,
            [now, dayInMs, limit]
        );

        return result;
    } catch (error) {
        console.error('Error getting words for practice:', error);
        return [];
    }
}

/**
 * Get random words for vocabulary exercises
 */
export async function getRandomWords(limit: number = 5): Promise<DictionaryWord[]> {
    if (!db) return [];

    try {
        const result = await db.getAllAsync<DictionaryWord>(
            'SELECT * FROM words ORDER BY RANDOM() LIMIT ?',
            [limit]
        );
        return result;
    } catch (error) {
        console.error('Error getting random words:', error);
        return [];
    }
}

// ============ GRAMMAR CONCEPTS ============

/**
 * Add or update a grammar concept (used when detecting errors)
 */
export async function addOrUpdateGrammarConcept(concept: Omit<GrammarConcept, 'id' | 'createdAt' | 'errorCount' | 'practiceCount' | 'masteryScore'>): Promise<void> {
    if (!db) return;

    try {
        const existing = await db.getFirstAsync<GrammarConcept>(
            'SELECT * FROM grammar_concepts WHERE name = ?',
            [concept.name]
        );

        if (existing) {
            // Increment error count
            await db.runAsync(
                'UPDATE grammar_concepts SET errorCount = errorCount + 1 WHERE id = ?',
                [existing.id]
            );
        } else {
            // Insert new concept
            const id = `gc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.runAsync(
                `INSERT INTO grammar_concepts (id, name, nameRu, description, examples, rule, errorCount, practiceCount, masteryScore, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0.0, ?)`,
                [id, concept.name, concept.nameRu, concept.description, concept.examples, concept.rule, Date.now()]
            );
        }
    } catch (error) {
        console.error('Error adding grammar concept:', error);
    }
}

/**
 * Get all grammar concepts sorted by error count
 */
export async function getGrammarConcepts(): Promise<GrammarConcept[]> {
    if (!db) return [];

    try {
        return await db.getAllAsync<GrammarConcept>(
            'SELECT * FROM grammar_concepts ORDER BY errorCount DESC, practiceCount ASC'
        );
    } catch (error) {
        console.error('Error getting grammar concepts:', error);
        return [];
    }
}

/**
 * Get grammar concepts for practice (prioritize high error, low mastery)
 */
export async function getGrammarForPractice(limit: number = 3): Promise<GrammarConcept[]> {
    if (!db) return [];

    try {
        return await db.getAllAsync<GrammarConcept>(
            `SELECT * FROM grammar_concepts 
             WHERE masteryScore < 0.8
             ORDER BY (errorCount - practiceCount) DESC, masteryScore ASC
             LIMIT ?`,
            [limit]
        );
    } catch (error) {
        console.error('Error getting grammar for practice:', error);
        return [];
    }
}

/**
 * Update grammar concept after practice
 */
export async function updateGrammarMetrics(conceptId: string, isCorrect: boolean): Promise<void> {
    if (!db) return;

    try {
        await db.runAsync(
            `UPDATE grammar_concepts SET
             practiceCount = practiceCount + 1,
             masteryScore = CASE 
                WHEN ? = 1 THEN MIN(1.0, masteryScore + 0.15)
                ELSE MAX(0.0, masteryScore - 0.1)
             END
             WHERE id = ?`,
            [isCorrect ? 1 : 0, conceptId]
        );
    } catch (error) {
        console.error('Error updating grammar metrics:', error);
    }
}

