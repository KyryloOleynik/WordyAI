// src/lib/nlp/filter.ts
// Word filtering by CEFR level using frequency-based classification

import { classifyWordDifficulty } from './frequencyAdapter';

export type CEFRLevel = 'A1-A2' | 'B1-B2' | 'C1-C2';

/**
 * Extract and filter words from text by CEFR level
 */
export const filterWordsByLevel = async (
    text: string,
    targetLevel: CEFRLevel
): Promise<string[]> => {
    const tokens = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
    const uniqueWords = [...new Set(tokens.map(w => w.toLowerCase()))];

    return uniqueWords.filter(word => {
        const level = classifyWordDifficulty(word);
        return level === targetLevel;
    });
};

/**
 * Extract words above user's known level
 */
export const extractNewWords = async (
    text: string,
    userLevel: CEFRLevel
): Promise<string[]> => {
    const tokens = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
    const uniqueWords = [...new Set(tokens.map(w => w.toLowerCase()))];

    const levelOrder = { 'A1-A2': 0, 'B1-B2': 1, 'C1-C2': 2 };
    const userLevelNum = levelOrder[userLevel];

    return uniqueWords.filter(word => {
        const wordLevel = classifyWordDifficulty(word);
        return levelOrder[wordLevel] > userLevelNum;
    });
};
