// src/services/translationService.ts
// Fast translation service with caching and optimized API calls

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TranslationResult {
    word: string;
    definition: string;      // English explanation
    translation: string;     // Russian translation
    phonetic?: string;
    partOfSpeech?: string;
    examples?: string[];
    cefrLevel: string;
}

// Free Dictionary API - fast, reliable
const DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// Translation cache key
const CACHE_KEY = '@wordy_translation_cache';
const CACHE_MAX_SIZE = 500; // Keep last 500 translations

// In-memory cache for instant lookups
let memoryCache: Map<string, TranslationResult> = new Map();
let cacheLoaded = false;

// Common English words (A1-A2 level)
const COMMON_WORDS = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
]);

/**
 * Load cache from AsyncStorage
 */
async function loadCache(): Promise<void> {
    if (cacheLoaded) return;

    try {
        const data = await AsyncStorage.getItem(CACHE_KEY);
        if (data) {
            const entries: [string, TranslationResult][] = JSON.parse(data);
            memoryCache = new Map(entries);
        }
        cacheLoaded = true;
    } catch (e) {
        console.warn('Failed to load translation cache:', e);
        cacheLoaded = true;
    }
}

/**
 * Save cache to AsyncStorage (debounced)
 */
let saveTimeout: NodeJS.Timeout | null = null;
function scheduleCache(): void {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            // Keep only last N entries
            const entries = Array.from(memoryCache.entries());
            const trimmed = entries.slice(-CACHE_MAX_SIZE);
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
        } catch (e) {
            console.warn('Failed to save translation cache:', e);
        }
    }, 2000);
}

/**
 * Estimate CEFR level
 */
function estimateCefrLevel(word: string, definition: string = ''): string {
    const w = word.toLowerCase();

    if (COMMON_WORDS.has(w)) return 'A1';
    if (w.length <= 4) return 'A2';

    // Word complexity indicators
    if (w.includes('ology') || w.includes('phobia') || w.includes('esque')) return 'C1';
    if (w.includes('tion') || w.includes('ment') || w.includes('ness')) return 'B2';

    const defWords = definition.split(/\s+/).length;
    if (defWords < 8) return 'B1';
    if (defWords < 15) return 'B2';

    return 'B1';
}

/**
 * Hardcoded translations for ultra-common words (instant, no API call)
 */
const INSTANT_TRANSLATIONS: Record<string, { translation: string; definition: string }> = {
    'hello': { translation: 'привет', definition: 'a greeting' },
    'hi': { translation: 'привет', definition: 'informal greeting' },
    'yes': { translation: 'да', definition: 'affirmative response' },
    'no': { translation: 'нет', definition: 'negative response' },
    'please': { translation: 'пожалуйста', definition: 'polite request word' },
    'thanks': { translation: 'спасибо', definition: 'expression of gratitude' },
    'thank': { translation: 'благодарить', definition: 'to express gratitude' },
    'good': { translation: 'хороший', definition: 'of high quality' },
    'bad': { translation: 'плохой', definition: 'of poor quality' },
    'big': { translation: 'большой', definition: 'of considerable size' },
    'small': { translation: 'маленький', definition: 'of less than normal size' },
    'new': { translation: 'новый', definition: 'recently made or discovered' },
    'old': { translation: 'старый', definition: 'having lived for many years' },
    'time': { translation: 'время', definition: 'the indefinite continued progress of existence' },
    'day': { translation: 'день', definition: 'a period of 24 hours' },
    'night': { translation: 'ночь', definition: 'the dark period between sunset and sunrise' },
    'year': { translation: 'год', definition: 'a period of 365 days' },
    'today': { translation: 'сегодня', definition: 'on this present day' },
    'tomorrow': { translation: 'завтра', definition: 'the day after today' },
    'yesterday': { translation: 'вчера', definition: 'the day before today' },
    'now': { translation: 'сейчас', definition: 'at the present time' },
    'here': { translation: 'здесь', definition: 'in this place' },
    'there': { translation: 'там', definition: 'in that place' },
    'what': { translation: 'что', definition: 'asking for information' },
    'when': { translation: 'когда', definition: 'at what time' },
    'where': { translation: 'где', definition: 'in what place' },
    'why': { translation: 'почему', definition: 'for what reason' },
    'how': { translation: 'как', definition: 'in what way' },
    'who': { translation: 'кто', definition: 'what person' },
    'man': { translation: 'мужчина / человек', definition: 'an adult male human' },
    'woman': { translation: 'женщина', definition: 'an adult female human' },
    'child': { translation: 'ребёнок', definition: 'a young human being' },
    'friend': { translation: 'друг', definition: 'a person with whom one has a bond of mutual affection' },
    'family': { translation: 'семья', definition: 'a group of related people' },
    'house': { translation: 'дом', definition: 'a building for human habitation' },
    'home': { translation: 'дом', definition: 'the place where one lives' },
    'work': { translation: 'работа', definition: 'activity involving effort' },
    'school': { translation: 'школа', definition: 'an institution for education' },
    'book': { translation: 'книга', definition: 'a written or printed work' },
    'word': { translation: 'слово', definition: 'a unit of language' },
    'life': { translation: 'жизнь', definition: 'the condition of being alive' },
    'world': { translation: 'мир', definition: 'the earth and all its inhabitants' },
    'love': { translation: 'любовь', definition: 'intense feeling of deep affection' },
    'want': { translation: 'хотеть', definition: 'to desire something' },
    'need': { translation: 'нуждаться', definition: 'to require something' },
    'know': { translation: 'знать', definition: 'to be aware of' },
    'think': { translation: 'думать', definition: 'to have a belief or opinion' },
    'see': { translation: 'видеть', definition: 'to perceive with the eyes' },
    'come': { translation: 'приходить', definition: 'to move toward' },
    'go': { translation: 'идти', definition: 'to move from one place to another' },
    'get': { translation: 'получать', definition: 'to obtain or receive' },
    'make': { translation: 'делать', definition: 'to form or create' },
    'take': { translation: 'брать', definition: 'to get hold of' },
    'give': { translation: 'давать', definition: 'to transfer possession' },
    'find': { translation: 'находить', definition: 'to discover' },
    'tell': { translation: 'говорить', definition: 'to communicate information' },
    'say': { translation: 'сказать', definition: 'to utter words' },
    'ask': { translation: 'спрашивать', definition: 'to request information' },
    'use': { translation: 'использовать', definition: 'to employ for a purpose' },
    'try': { translation: 'пытаться', definition: 'to make an attempt' },
    'help': { translation: 'помогать', definition: 'to assist' },
    'start': { translation: 'начинать', definition: 'to begin' },
    'stop': { translation: 'останавливать', definition: 'to cease movement' },
    'run': { translation: 'бегать', definition: 'to move rapidly on foot' },
    'walk': { translation: 'ходить', definition: 'to move on foot' },
    'eat': { translation: 'есть', definition: 'to consume food' },
    'drink': { translation: 'пить', definition: 'to consume liquid' },
    'sleep': { translation: 'спать', definition: 'to rest with eyes closed' },
    'read': { translation: 'читать', definition: 'to look at and understand written text' },
    'write': { translation: 'писать', definition: 'to form letters or words' },
    'learn': { translation: 'учить', definition: 'to acquire knowledge' },
    'speak': { translation: 'говорить', definition: 'to utter words' },
    'listen': { translation: 'слушать', definition: 'to pay attention to sound' },
    'look': { translation: 'смотреть', definition: 'to direct eyes toward' },
    'watch': { translation: 'смотреть', definition: 'to observe attentively' },
    'wait': { translation: 'ждать', definition: 'to stay in place until something happens' },
    'play': { translation: 'играть', definition: 'to engage in activity for enjoyment' },
    'open': { translation: 'открывать', definition: 'to move from closed position' },
    'close': { translation: 'закрывать', definition: 'to move to closed position' },
    'buy': { translation: 'покупать', definition: 'to acquire by paying' },
    'pay': { translation: 'платить', definition: 'to give money for goods/services' },
    'money': { translation: 'деньги', definition: 'medium of exchange' },
    'food': { translation: 'еда', definition: 'substances eaten for nutrition' },
    'water': { translation: 'вода', definition: 'clear liquid essential for life' },
    'car': { translation: 'машина', definition: 'a road vehicle' },
    'phone': { translation: 'телефон', definition: 'a device for communication' },
    'computer': { translation: 'компьютер', definition: 'an electronic device for processing data' },
    'city': { translation: 'город', definition: 'a large town' },
    'country': { translation: 'страна', definition: 'a nation with its own government' },
    'way': { translation: 'путь / способ', definition: 'a method or manner' },
    'thing': { translation: 'вещь', definition: 'an object' },
    'place': { translation: 'место', definition: 'a particular position' },
    'part': { translation: 'часть', definition: 'a piece of something' },
    'hand': { translation: 'рука', definition: 'the end part of the arm' },
    'eye': { translation: 'глаз', definition: 'the organ of sight' },
    'face': { translation: 'лицо', definition: 'the front of the head' },
    'head': { translation: 'голова', definition: 'the upper part of the body' },
    'heart': { translation: 'сердце', definition: 'the organ that pumps blood' },
};

/**
 * Fetch English definition from Free Dictionary API
 */
async function fetchEnglishDefinition(word: string): Promise<{
    definition: string;
    phonetic?: string;
    partOfSpeech?: string;
    examples?: string[];
} | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${DICTIONARY_API}${encodeURIComponent(word)}`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) return null;

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        const entry = data[0];
        const meaning = entry.meanings?.[0];
        const def = meaning?.definitions?.[0];

        return {
            definition: def?.definition || 'No definition found',
            phonetic: entry.phonetic || entry.phonetics?.[0]?.text,
            partOfSpeech: meaning?.partOfSpeech,
            examples: def?.example ? [def.example] : [],
        };
    } catch (error) {
        console.warn('Dictionary API error:', error);
        return null;
    }
}

/**
 * Fetch Russian translation using Google Translate (free endpoint)
 */
async function fetchRussianTranslation(word: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        // Using Google Translate's free endpoint
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(word)}`;

        const response = await fetch(url, {
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) return null;

        const data = await response.json();
        // Response format: [[["перевод","word",null,null,10]],...]
        const translation = data?.[0]?.[0]?.[0];

        if (translation && translation.toLowerCase() !== word.toLowerCase()) {
            return translation;
        }
        return null;
    } catch (error) {
        console.warn('Translation API error:', error);
        return null;
    }
}

/**
 * Main translation function - fast with caching
 */
export async function translateWord(word: string, context?: string): Promise<TranslationResult | null> {
    const cleanWord = word.toLowerCase().trim().replace(/[^a-zA-Z'-]/g, '');
    if (!cleanWord || cleanWord.length < 2) return null;

    // Load cache if not loaded
    await loadCache();

    // Check in-memory cache first (instant)
    const cached = memoryCache.get(cleanWord);
    if (cached) {
        console.log(`Cache hit: ${cleanWord}`);
        return cached;
    }

    // Check hardcoded translations (instant, most common words)
    const instant = INSTANT_TRANSLATIONS[cleanWord];
    if (instant) {
        const result: TranslationResult = {
            word: cleanWord,
            definition: instant.definition,
            translation: instant.translation,
            cefrLevel: 'A1',
        };
        memoryCache.set(cleanWord, result);
        scheduleCache();
        return result;
    }

    // Fetch from APIs in parallel
    const [englishResult, russianTranslation] = await Promise.all([
        fetchEnglishDefinition(cleanWord),
        fetchRussianTranslation(cleanWord),
    ]);

    // Need at least one result
    if (!englishResult && !russianTranslation) {
        return null;
    }

    const definition = englishResult?.definition || `The word "${cleanWord}"`;

    const result: TranslationResult = {
        word: cleanWord,
        definition,
        translation: russianTranslation || 'Перевод недоступен',
        phonetic: englishResult?.phonetic,
        partOfSpeech: englishResult?.partOfSpeech,
        examples: englishResult?.examples,
        cefrLevel: estimateCefrLevel(cleanWord, definition),
    };

    // Cache the result
    memoryCache.set(cleanWord, result);
    scheduleCache();

    return result;
}

/**
 * Batch translate multiple words
 */
export async function translateWords(words: string[]): Promise<Map<string, TranslationResult>> {
    const results = new Map<string, TranslationResult>();
    const uniqueWords = [...new Set(words.map(w => w.toLowerCase().trim()))];

    // Process in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < uniqueWords.length; i += batchSize) {
        const batch = uniqueWords.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(w => translateWord(w)));

        batchResults.forEach((result, index) => {
            if (result) {
                results.set(batch[index], result);
            }
        });
    }

    return results;
}

/**
 * Check if word is above user's CEFR level
 */
export function isWordAboveLevel(wordCefr: string, userCefr: string): boolean {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return levels.indexOf(wordCefr) > levels.indexOf(userCefr);
}

/**
 * Clear translation cache
 */
export async function clearTranslationCache(): Promise<void> {
    memoryCache.clear();
    await AsyncStorage.removeItem(CACHE_KEY);
}
