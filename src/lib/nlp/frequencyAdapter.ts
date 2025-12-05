// src/lib/nlp/frequencyAdapter.ts

/**
 * Word frequency adapter using Datamuse API for CEFR level classification.
 * Datamuse: 100,000 free requests/day, no API key needed.
 */

// Cache for word classifications
const wordCache = new Map<string, WordClassification>();

export interface WordClassification {
    word: string;
    level: 'A1-A2' | 'B1-B2' | 'C1-C2';
    zipfScore: number;
    confidence: 'high' | 'medium' | 'low';
    source: 'datamuse' | 'cache' | 'fallback';
}

// Very common words (skip API for these)
const BASIC_WORDS = new Set([
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'the', 'a', 'an',
    'is', 'are', 'was', 'were', 'be', 'have', 'has', 'had', 'do', 'does',
    'can', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'and', 'or', 'but', 'if', 'so', 'to', 'of', 'in', 'on', 'at', 'for',
    'yes', 'no', 'not', 'this', 'that', 'what', 'who', 'how', 'when', 'where',
    'go', 'come', 'see', 'get', 'make', 'know', 'think', 'take', 'want',
]);

/**
 * Fetch word frequency from Datamuse API
 * Returns Zipf score (1-7, higher = more frequent)
 */
const fetchWordFrequency = async (word: string): Promise<number | null> => {
    try {
        const response = await fetch(
            `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=f&max=1`
        );

        if (!response.ok) return null;

        const data = await response.json();

        if (data.length > 0 && data[0].tags) {
            // Find frequency tag (format: "f:2.345678")
            const freqTag = data[0].tags.find((t: string) => t.startsWith('f:'));
            if (freqTag) {
                const freq = parseFloat(freqTag.substring(2));
                return freq;
            }
        }

        return null;
    } catch (e) {
        console.warn('Datamuse API error:', e);
        return null;
    }
};

/**
 * Convert Zipf frequency to CEFR level
 * Zipf 7+ = extremely common (A1)
 * Zipf 5-7 = very common (A1-A2)
 * Zipf 3-5 = common (B1-B2)
 * Zipf 1-3 = rare (C1-C2)
 */
const zipfToCEFR = (zipf: number): 'A1-A2' | 'B1-B2' | 'C1-C2' => {
    if (zipf >= 5) return 'A1-A2';
    if (zipf >= 3) return 'B1-B2';
    return 'C1-C2';
};

/**
 * Classify a single word using Datamuse API
 */
export const classifyWordWithAPI = async (word: string): Promise<WordClassification> => {
    const normalized = word.toLowerCase().trim();

    // Check cache
    if (wordCache.has(normalized)) {
        return { ...wordCache.get(normalized)!, source: 'cache' };
    }

    // Skip API for obvious basic words
    if (BASIC_WORDS.has(normalized) || normalized.length <= 2) {
        const result: WordClassification = {
            word: normalized,
            level: 'A1-A2',
            zipfScore: 7.0,
            confidence: 'high',
            source: 'fallback',
        };
        wordCache.set(normalized, result);
        return result;
    }

    // Fetch from Datamuse
    const zipf = await fetchWordFrequency(normalized);

    if (zipf !== null) {
        const result: WordClassification = {
            word: normalized,
            level: zipfToCEFR(zipf),
            zipfScore: zipf,
            confidence: 'high',
            source: 'datamuse',
        };
        wordCache.set(normalized, result);
        return result;
    }

    // Fallback to heuristic
    return classifyByHeuristic(normalized);
};

/**
 * Batch classify words (uses Promise.all for parallel requests)
 */
export const classifyWordsWithAPI = async (words: string[]): Promise<Map<string, WordClassification>> => {
    const results = new Map<string, WordClassification>();
    const uncached: string[] = [];

    // Check cache first
    for (const word of words) {
        const normalized = word.toLowerCase().trim();
        if (wordCache.has(normalized)) {
            results.set(normalized, { ...wordCache.get(normalized)!, source: 'cache' });
        } else {
            uncached.push(normalized);
        }
    }

    // Fetch uncached words in parallel (max 10 at a time)
    const batches = [];
    for (let i = 0; i < uncached.length; i += 10) {
        batches.push(uncached.slice(i, i + 10));
    }

    for (const batch of batches) {
        const promises = batch.map(word => classifyWordWithAPI(word));
        const batchResults = await Promise.all(promises);

        for (const result of batchResults) {
            results.set(result.word, result);
        }
    }

    return results;
};

/**
 * Heuristic-based fallback
 */
const classifyByHeuristic = (word: string): WordClassification => {
    const normalized = word.toLowerCase().trim();

    // Advanced suffixes suggest C1-C2
    const advancedSuffixes = ['ization', 'isation', 'ification', 'ousness', 'iveness'];
    const hasAdvancedSuffix = advancedSuffixes.some(s => normalized.endsWith(s));

    let level: 'A1-A2' | 'B1-B2' | 'C1-C2' = 'B1-B2';
    let zipf = 4.0;

    if (hasAdvancedSuffix || normalized.length > 12) {
        level = 'C1-C2';
        zipf = 2.5;
    } else if (normalized.length > 10) {
        level = 'C1-C2';
        zipf = 3.0;
    } else if (normalized.length <= 4) {
        level = 'A1-A2';
        zipf = 6.0;
    }

    const result: WordClassification = {
        word: normalized,
        level,
        zipfScore: zipf,
        confidence: 'low',
        source: 'fallback',
    };

    wordCache.set(normalized, result);
    return result;
};

// ========== SYNC EXPORTS (backward compatibility) ==========

export const estimateZipf = (word: string): number => {
    const cached = wordCache.get(word.toLowerCase().trim());
    if (cached) return cached.zipfScore;

    // Quick heuristic for sync call
    if (BASIC_WORDS.has(word.toLowerCase())) return 7.0;
    const len = word.length;
    if (len <= 4) return 6.0;
    if (len <= 6) return 5.0;
    if (len <= 8) return 4.0;
    if (len <= 10) return 3.0;
    return 2.5;
};

export const classifyWordDifficulty = (word: string): 'A1-A2' | 'B1-B2' | 'C1-C2' => {
    const cached = wordCache.get(word.toLowerCase().trim());
    if (cached) return cached.level;

    const zipf = estimateZipf(word);
    if (zipf >= 5) return 'A1-A2';
    if (zipf >= 3) return 'B1-B2';
    return 'C1-C2';
};

export const classifyWordDetailed = (word: string): WordClassification => {
    const cached = wordCache.get(word.toLowerCase().trim());
    if (cached) return cached;
    return classifyByHeuristic(word);
};

// Aliases for old AI-based functions
export const classifyWordWithAI = classifyWordWithAPI;
export const classifyWordsWithAI = classifyWordsWithAPI;

export const clearWordCache = () => wordCache.clear();
