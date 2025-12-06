import { addOrUpdateGrammarConcept, addWord, DictionaryWord, updateWordMetrics } from './database';
import { ParsedGrammar, ParsedWord } from './promptTemplates';

/**
 * Handles the persistence of AI-generated data (grammar, vocabulary, etc.)
 * Provides verification logs as requested.
 */

export async function saveGrammarConcepts(concepts: ParsedGrammar[]): Promise<void> {
    if (!concepts || concepts.length === 0) return;

    console.log(`[AI Data] Processing ${concepts.length} grammar concepts...`);

    for (const concept of concepts) {
        try {
            await addOrUpdateGrammarConcept({
                name: concept.name,
                nameRu: concept.nameRu,
                description: concept.description,
                rule: concept.rule,
                examples: JSON.stringify([concept.example]),
            });
            console.log(`[AI Data] ✅ Saved grammar concept: "${concept.name}"`);
        } catch (error) {
            console.error(`[AI Data] ❌ Failed to save grammar concept "${concept.name}":`, error);
        }
    }
}

export async function saveVocabulary(words: ParsedWord[]): Promise<void> {
    if (!words || words.length === 0) return;

    console.log(`[AI Data] Processing ${words.length} vocabulary words...`);

    for (const word of words) {
        try {
            await addWord({
                text: word.word.toLowerCase(),
                translation: word.translation,
                definition: word.definition,
                cefrLevel: word.level || 'B1',
                status: 'new',
                timesShown: 0,
                timesCorrect: 0,
                timesWrong: 0,
                lastReviewedAt: null,
                nextReviewAt: Date.now(),
                source: 'lookup',
                reviewCount: 0,
                masteryScore: 0,
            });
            console.log(`[AI Data] ✅ Saved vocabulary word: "${word.word}"`);
        } catch (error) {
            console.error(`[AI Data] ❌ Failed to save word "${word.word}":`, error);
        }
    }
}

/**
 * Helper to track usage of words during conversation/practice
 */
export async function trackWordUsage(text: string, knownWords: DictionaryWord[], wasCorrect: boolean = true): Promise<void> {
    const textLower = text.toLowerCase();
    for (const word of knownWords) {
        if (textLower.includes(word.text.toLowerCase())) {
            try {
                await updateWordMetrics(word.id, 'usage', wasCorrect);
                console.log(`[AI Data] 📈 Tracked usage for word: "${word.text}" (Correct: ${wasCorrect})`);
            } catch (error) {
                console.error(`[AI Data] ❌ Failed to track metrics for "${word.text}":`, error);
            }
        }
    }
}

/**
 * Main entry point to save all structured data associated with an AI result
 */
export async function saveAIResult(result: {
    grammarConcepts?: ParsedGrammar[];
    vocabularySuggestions?: ParsedWord[];
    grammarErrors?: any[]; // For future use if we save specific error instances
}): Promise<void> {
    console.log('[AI Data] Starting batch save of AI result...');

    if (result.grammarConcepts) {
        await saveGrammarConcepts(result.grammarConcepts);
    }

    if (result.vocabularySuggestions) {
        await saveVocabulary(result.vocabularySuggestions);
    }

    console.log('[AI Data] Batch save completed.');
}

/**
 * Legacy support / Utility
 * Returns a clean string if needed, though mostly we deal with JSON now.
 */
export function cleanMarkupFromText(text: string): string {
    // If we still have any residual markup, clean it. 
    // New prompts should return clean "conversationResponse" separately.
    return text.replace(/\[(GRA|VOC):.*?\]/g, '').trim();
}
