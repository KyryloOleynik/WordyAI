/**
 * Spaced Repetition System (SRS) Service
 * SM-2 algorithm implementation for optimal word review scheduling
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WordSRS {
    wordId: string;
    word: string;
    translation: string;
    interval: number;      // Days until next review
    easeFactor: number;    // Difficulty multiplier (2.5 default)
    repetitions: number;   // Successful repetitions count
    nextReviewAt: number;  // Timestamp of next review
    lastReviewAt: number;  // Timestamp of last review
    status: 'new' | 'learning' | 'known';
}

const SRS_KEY = 'srs_words';
const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

/**
 * SM-2 Algorithm grade:
 * 0 - Complete blackout
 * 1 - Incorrect, but recalled upon seeing answer
 * 2 - Incorrect, but easy to recall
 * 3 - Correct with difficulty
 * 4 - Correct with some hesitation
 * 5 - Perfect response
 */
export type SRSGrade = 0 | 1 | 2 | 3 | 4 | 5;

// Calculate new interval based on SM-2
export function calculateNextReview(
    grade: SRSGrade,
    repetitions: number,
    interval: number,
    easeFactor: number
): { interval: number; easeFactor: number; repetitions: number } {
    let newEF = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (newEF < MIN_EASE_FACTOR) newEF = MIN_EASE_FACTOR;

    let newInterval: number;
    let newReps: number;

    if (grade < 3) {
        // Failed - reset
        newReps = 0;
        newInterval = 1;
    } else {
        // Passed
        newReps = repetitions + 1;
        if (newReps === 1) {
            newInterval = 1;
        } else if (newReps === 2) {
            newInterval = 6;
        } else {
            newInterval = Math.round(interval * newEF);
        }
    }

    return {
        interval: newInterval,
        easeFactor: newEF,
        repetitions: newReps,
    };
}

// Get all SRS words
export async function getSRSWords(): Promise<WordSRS[]> {
    try {
        const data = await AsyncStorage.getItem(SRS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

// Save SRS words
export async function saveSRSWords(words: WordSRS[]): Promise<void> {
    await AsyncStorage.setItem(SRS_KEY, JSON.stringify(words));
}

// Add or update word in SRS
export async function addWordToSRS(
    word: string,
    translation: string,
    wordId?: string
): Promise<void> {
    const words = await getSRSWords();
    const existing = words.find(w => w.word.toLowerCase() === word.toLowerCase());

    if (existing) return; // Already exists

    const newWord: WordSRS = {
        wordId: wordId || Date.now().toString(),
        word: word.toLowerCase(),
        translation,
        interval: 0,
        easeFactor: DEFAULT_EASE_FACTOR,
        repetitions: 0,
        nextReviewAt: Date.now(),
        lastReviewAt: 0,
        status: 'new',
    };

    words.push(newWord);
    await saveSRSWords(words);
}

// Update word after review
export async function updateWordReview(
    wordId: string,
    grade: SRSGrade
): Promise<void> {
    const words = await getSRSWords();
    const wordIndex = words.findIndex(w => w.wordId === wordId);

    if (wordIndex === -1) return;

    const word = words[wordIndex];
    const result = calculateNextReview(
        grade,
        word.repetitions,
        word.interval,
        word.easeFactor
    );

    words[wordIndex] = {
        ...word,
        interval: result.interval,
        easeFactor: result.easeFactor,
        repetitions: result.repetitions,
        nextReviewAt: Date.now() + result.interval * 24 * 60 * 60 * 1000,
        lastReviewAt: Date.now(),
        status: result.repetitions >= 3 ? 'known' : result.repetitions >= 1 ? 'learning' : 'new',
    };

    await saveSRSWords(words);
}

// Get words due for review
export async function getWordsDueForReview(limit = 20): Promise<WordSRS[]> {
    const words = await getSRSWords();
    const now = Date.now();

    return words
        .filter(w => w.nextReviewAt <= now)
        .sort((a, b) => {
            // Priority: new words first, then by overdue time
            if (a.status === 'new' && b.status !== 'new') return -1;
            if (b.status === 'new' && a.status !== 'new') return 1;
            return a.nextReviewAt - b.nextReviewAt;
        })
        .slice(0, limit);
}

// Get words by priority score (for exercises)
export async function getWordsByPriority(limit = 10): Promise<WordSRS[]> {
    const words = await getSRSWords();
    const now = Date.now();

    // Calculate priority score
    const scored = words.map(w => {
        const overdueDays = Math.max(0, (now - w.nextReviewAt) / (24 * 60 * 60 * 1000));
        const easeWeight = (3 - w.easeFactor) / 2; // Lower ease = higher priority
        const repWeight = 1 / (w.repetitions + 1);

        return {
            ...w,
            score: overdueDays * 2 + easeWeight + repWeight,
        };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

// Get word count by status
export async function getSRSStats(): Promise<{
    total: number;
    new: number;
    learning: number;
    known: number;
    dueToday: number;
}> {
    const words = await getSRSWords();
    const now = Date.now();

    return {
        total: words.length,
        new: words.filter(w => w.status === 'new').length,
        learning: words.filter(w => w.status === 'learning').length,
        known: words.filter(w => w.status === 'known').length,
        dueToday: words.filter(w => w.nextReviewAt <= now).length,
    };
}
