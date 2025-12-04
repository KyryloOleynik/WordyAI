// src/lib/nlp/filter.ts
// Word filtering using classification service

import { classifyWord, filterWordsByLevel as filterByLevel } from '@/services/wordClassificationService';

export type CEFRLevel = 'A1-A2' | 'B1-B2' | 'C1-C2';

/**
 * Extract and filter words from text by CEFR level
 */
export const filterWordsByLevel = async (
    text: string,
    targetLevel: CEFRLevel
): Promise<string[]> => {
    // Tokenize text
    const tokens = text.match(/\b[a-zA-Z]{3,}\b/g) || [];

    // Get unique words
    const uniqueWords = [...new Set(tokens.map(w => w.toLowerCase()))];

    // Filter by level using classification service
    return filterByLevel(uniqueWords, targetLevel);
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

    const results: string[] = [];
    const levelOrder = { 'A1-A2': 0, 'B1-B2': 1, 'C1-C2': 2 };
    const userLevelNum = levelOrder[userLevel];

    for (const word of uniqueWords) {
        const classification = await classifyWord(word);
        if (levelOrder[classification.level] > userLevelNum) {
            results.push(word);
        }
    }

    return results;
};
