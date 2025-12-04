/**
 * Word Classification Service
 * Uses Datamuse API + AI fallback for accurate CEFR level classification
 * Caches results for performance
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { llmManager } from './llmManager';
import { classifyWordDifficulty, classifyWordDetailed, WordClassification } from '@/lib/nlp/frequencyAdapter';

const CACHE_KEY = 'word_classification_cache';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
    level: 'A1-A2' | 'B1-B2' | 'C1-C2';
    confidence: 'high' | 'medium' | 'low';
    timestamp: number;
}

interface ClassificationCache {
    [word: string]: CacheEntry;
}

let memoryCache: ClassificationCache = {};
let cacheLoaded = false;

// Load cache from storage
async function loadCache(): Promise<void> {
    if (cacheLoaded) return;
    try {
        const data = await AsyncStorage.getItem(CACHE_KEY);
        if (data) {
            memoryCache = JSON.parse(data);
            // Clean expired entries
            const now = Date.now();
            for (const word of Object.keys(memoryCache)) {
                if (now - memoryCache[word].timestamp > CACHE_EXPIRY) {
                    delete memoryCache[word];
                }
            }
        }
        cacheLoaded = true;
    } catch (e) {
        console.log('Cache load failed');
    }
}

// Save cache to storage
async function saveCache(): Promise<void> {
    try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
    } catch (e) {
        console.log('Cache save failed');
    }
}

/**
 * Get word frequency from Datamuse API
 * Higher frequency = more common = lower CEFR level
 */
async function getWordFrequency(word: string): Promise<number | null> {
    try {
        const response = await fetch(
            `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=f&max=1`,
            { headers: { Accept: 'application/json' } }
        );

        if (!response.ok) return null;

        const data = await response.json();
        if (data.length > 0 && data[0].tags) {
            const freqTag = data[0].tags.find((t: string) => t.startsWith('f:'));
            if (freqTag) {
                return parseFloat(freqTag.substring(2));
            }
        }
        return null;
    } catch (e) {
        console.log('Datamuse API failed');
        return null;
    }
}

/**
 * Convert frequency score to CEFR level
 */
function frequencyToLevel(freq: number): 'A1-A2' | 'B1-B2' | 'C1-C2' {
    // freq is on logarithmic scale (similar to Zipf)
    // Higher freq = more common word
    if (freq >= 5.0) return 'A1-A2';
    if (freq >= 3.0) return 'B1-B2';
    return 'C1-C2';
}

/**
 * Use AI to classify word when API fails
 */
async function classifyWithAI(word: string): Promise<{
    level: 'A1-A2' | 'B1-B2' | 'C1-C2';
    confidence: 'high' | 'medium' | 'low';
} | null> {
    if (!llmManager.ready) return null;

    try {
        const prompt = `Classify the English word "${word}" into CEFR level.
A1-A2: Very common everyday words (cat, house, eat, go, happy)
B1-B2: Intermediate vocabulary (achieve, environment, opportunity)
C1-C2: Advanced/academic words (ubiquitous, paradigm, ameliorate)

Output JSON only: {"level": "A1-A2" or "B1-B2" or "C1-C2"}`;

        const result = await llmManager.complete(prompt, true);
        const json = result.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(json);

        if (data.level && ['A1-A2', 'B1-B2', 'C1-C2'].includes(data.level)) {
            return { level: data.level, confidence: 'medium' };
        }
    } catch (e) {
        console.log('AI classification failed');
    }

    return null;
}

/**
 * Main classification function - uses cached data, API, or AI
 */
export async function classifyWord(word: string): Promise<WordClassification> {
    const normalized = word.toLowerCase().trim();

    // 1. Check memory cache first
    await loadCache();
    if (memoryCache[normalized]) {
        return {
            word: normalized,
            level: memoryCache[normalized].level,
            zipfScore: 0,
            confidence: memoryCache[normalized].confidence,
            source: 'wordlist',
        };
    }

    // 2. Check static word lists (fast, high confidence)
    const staticResult = classifyWordDetailed(normalized);
    if (staticResult.confidence === 'high') {
        // Cache it
        memoryCache[normalized] = {
            level: staticResult.level,
            confidence: 'high',
            timestamp: Date.now(),
        };
        saveCache();
        return staticResult;
    }

    // 3. Try Datamuse API for frequency data
    const freq = await getWordFrequency(normalized);
    if (freq !== null) {
        const level = frequencyToLevel(freq);
        memoryCache[normalized] = {
            level,
            confidence: 'high',
            timestamp: Date.now(),
        };
        saveCache();
        return {
            word: normalized,
            level,
            zipfScore: freq,
            confidence: 'high',
            source: 'wordlist',
        };
    }

    // 4. Try AI classification
    const aiResult = await classifyWithAI(normalized);
    if (aiResult) {
        memoryCache[normalized] = {
            level: aiResult.level,
            confidence: aiResult.confidence,
            timestamp: Date.now(),
        };
        saveCache();
        return {
            word: normalized,
            level: aiResult.level,
            zipfScore: 0,
            confidence: aiResult.confidence,
            source: 'morphology',
        };
    }

    // 5. Fallback to heuristic
    return staticResult;
}

/**
 * Batch classify words efficiently
 */
export async function classifyWords(words: string[]): Promise<Map<string, WordClassification>> {
    const results = new Map<string, WordClassification>();

    // Process in parallel for speed
    await Promise.all(
        words.map(async (word) => {
            const result = await classifyWord(word);
            results.set(word.toLowerCase(), result);
        })
    );

    return results;
}

/**
 * Filter words by CEFR level
 */
export async function filterWordsByLevel(
    words: string[],
    level: 'A1-A2' | 'B1-B2' | 'C1-C2'
): Promise<string[]> {
    const classifications = await classifyWords(words);
    return words.filter(word => classifications.get(word.toLowerCase())?.level === level);
}

/**
 * Get level statistics for a list of words
 */
export async function getWordLevelStats(words: string[]): Promise<{
    'A1-A2': number;
    'B1-B2': number;
    'C1-C2': number;
}> {
    const classifications = await classifyWords(words);
    const stats = { 'A1-A2': 0, 'B1-B2': 0, 'C1-C2': 0 };

    classifications.forEach(c => {
        stats[c.level]++;
    });

    return stats;
}
