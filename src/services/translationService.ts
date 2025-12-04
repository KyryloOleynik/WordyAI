// src/services/translationService.ts
// Fast translation service using free APIs (no AI needed for basic lookups)

export interface TranslationResult {
    word: string;
    definition: string;      // English explanation
    translation: string;     // Russian translation
    phonetic?: string;
    partOfSpeech?: string;
    examples?: string[];
    cefrLevel: string;
}

// Free Dictionary API - no key needed
const DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
// MyMemory Translation API - free tier (1000 words/day)
const TRANSLATE_API = 'https://api.mymemory.translated.net/get';

// CEFR level estimation based on word frequency (simplified)
const CEFR_FREQUENCY_MAP: Record<string, number> = {
    'A1': 500,
    'A2': 1500,
    'B1': 3500,
    'B2': 6000,
    'C1': 10000,
    'C2': 20000,
};

// Common English words by approximate frequency rank
const COMMON_WORDS = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
]);

/**
 * Estimate CEFR level based on word characteristics
 */
function estimateCefrLevel(word: string, definition: string): string {
    const w = word.toLowerCase();

    // Very common words = A1
    if (COMMON_WORDS.has(w)) return 'A1';

    // Short words (3-4 letters) tend to be more basic
    if (w.length <= 4) return 'A2';

    // Check definition complexity
    const defWords = definition.split(/\s+/).length;

    // Simple definitions = simpler words
    if (defWords < 10) return 'B1';
    if (defWords < 20) return 'B2';

    // Complex words with Latin/Greek roots
    if (w.includes('tion') || w.includes('ment') || w.includes('ness')) return 'B2';
    if (w.includes('ology') || w.includes('phobia') || w.includes('philia')) return 'C1';

    return 'B1'; // Default to intermediate
}

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
        const response = await fetch(`${DICTIONARY_API}${encodeURIComponent(word.toLowerCase())}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

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
 * Fetch Russian translation from MyMemory API
 */
async function fetchRussianTranslation(word: string): Promise<string | null> {
    try {
        const url = `${TRANSLATE_API}?q=${encodeURIComponent(word)}&langpair=en|ru`;
        const response = await fetch(url);

        if (!response.ok) return null;

        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData?.translatedText) {
            const translation = data.responseData.translatedText;
            // MyMemory sometimes returns the same text if no translation found
            if (translation.toLowerCase() === word.toLowerCase()) {
                return null;
            }
            return translation;
        }
        return null;
    } catch (error) {
        console.warn('Translation API error:', error);
        return null;
    }
}

/**
 * Main translation function - uses AI when available, falls back to free APIs
 * @param word - The word to translate
 * @param context - Optional sentence context for better translations
 */
export async function translateWord(word: string, context?: string): Promise<TranslationResult | null> {
    const cleanWord = word.toLowerCase().trim().replace(/[^a-zA-Z'-]/g, '');
    if (!cleanWord || cleanWord.length < 2) return null;

    // Try AI-powered translation first (context-aware, better quality)
    try {
        const { translateWithContext } = await import('./aiService');
        const aiResult = await translateWithContext(cleanWord, context);

        if (aiResult) {
            return {
                word: cleanWord,
                definition: aiResult.definitions?.[0] || 'Definition not available',
                translation: aiResult.translations?.[0] || 'Перевод недоступен',
                phonetic: aiResult.phonetic,
                partOfSpeech: aiResult.partOfSpeech,
                examples: aiResult.examples,
                cefrLevel: aiResult.cefrLevel || 'B1',
            };
        }
    } catch (error) {
        console.log('AI translation not available, using free APIs');
    }

    // Fallback to free APIs
    const [englishResult, russianTranslation] = await Promise.all([
        fetchEnglishDefinition(cleanWord),
        fetchRussianTranslation(cleanWord),
    ]);

    // Need at least one result
    if (!englishResult && !russianTranslation) {
        return null;
    }

    const definition = englishResult?.definition || 'Definition not available';

    return {
        word: cleanWord,
        definition,
        translation: russianTranslation || 'Перевод недоступен',
        phonetic: englishResult?.phonetic,
        partOfSpeech: englishResult?.partOfSpeech,
        examples: englishResult?.examples,
        cefrLevel: estimateCefrLevel(cleanWord, definition),
    };
}

/**
 * Batch translate multiple words (with rate limiting)
 */
export async function translateWords(words: string[]): Promise<Map<string, TranslationResult>> {
    const results = new Map<string, TranslationResult>();
    const uniqueWords = [...new Set(words.map(w => w.toLowerCase().trim()))];

    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < uniqueWords.length; i += batchSize) {
        const batch = uniqueWords.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(w => translateWord(w)));

        batchResults.forEach((result, index) => {
            if (result) {
                results.set(batch[index], result);
            }
        });

        // Small delay between batches
        if (i + batchSize < uniqueWords.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    return results;
}

/**
 * Check if word is above user's CEFR level
 */
export function isWordAboveLevel(wordCefr: string, userCefr: string): boolean {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const wordIndex = levels.indexOf(wordCefr);
    const userIndex = levels.indexOf(userCefr);
    return wordIndex > userIndex;
}
