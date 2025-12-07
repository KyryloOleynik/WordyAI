// src/services/unifiedAIManager.ts
// Unified AI Manager - Facade for simpler access to AI Service
// Refactored to delegate core logic to aiService.ts

import { getAICompletion, getAICompletionStream, APIStatus, onAPIStatusChange, getAPIStatus } from './aiService';
import { PromptTemplates } from './promptTemplates';
import { ApiKeyError } from './apiKeyService';
export { ApiKeyError };

export type AIBackend = 'google' | 'perplexity' | 'none';

export interface AIResponse {
    text: string;
    source: AIBackend;
    success: boolean;
    error?: string;
}

export type { APIStatus as AIManagerStatus } from './aiService';

// Singleton class
class UnifiedAIManager {
    private static instance: UnifiedAIManager;

    private constructor() { }

    static getInstance(): UnifiedAIManager {
        if (!UnifiedAIManager.instance) {
            UnifiedAIManager.instance = new UnifiedAIManager();
        }
        return UnifiedAIManager.instance;
    }

    // ============ STATUS MANAGEMENT ============

    async getStatus(): Promise<APIStatus> {
        return getAPIStatus();
    }

    onStatusChange(callback: (status: APIStatus) => void): () => void {
        return onAPIStatusChange(callback);
    }

    // ============ CORE AI METHODS ============

    async generateText(prompt: string, options?: { jsonMode?: boolean }): Promise<AIResponse> {
        try {
            const result = await getAICompletion(prompt, options);
            if (!result.success) {
                // Map generic failure to ApiKeyError if needed by UI
                // but typically getAICompletion handles returning helpful error objects or text
                if (result.source === 'none') {
                    throw new ApiKeyError(result.text);
                }
            }
            return {
                text: result.text,
                source: result.source as AIBackend,
                success: result.success
            };
        } catch (error) {
            console.error('[UnifiedAI] Error:', error);
            throw error; // Re-throw to be handled by caller
        }
    }

    async *generateTextStream(prompt: string): AsyncGenerator<{ text: string; source: AIBackend; done: boolean }> {
        for await (const chunk of getAICompletionStream(prompt)) {
            yield {
                text: chunk.text,
                source: chunk.source as AIBackend,
                done: chunk.done
            };
        }
    }

    // ============ SPECIALIZED METHODS ============

    async generateSentenceForWord(
        word: string,
        translation: string,
        level: string
    ): Promise<{ sentence: string; missingWord: string } | null> {
        const prompt = PromptTemplates.generateSentenceForWord(word, translation, level);

        const response = await this.generateText(prompt, { jsonMode: true });
        if (!response.success) return null;

        try {
            const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }

    /**
     * Extract English words from an image using Gemini Vision API
     * @param base64Image Base64 encoded image data
     * @returns Array of {word, translation} pairs or null on failure
     */
    async extractWordsFromImage(base64Image: string): Promise<{ word: string; translation: string }[] | null> {
        const prompt = PromptTemplates.extractWordsFromImage();

        try {
            // Use getAICompletion which now supports images
            const result = await getAICompletion(prompt, { jsonMode: true, image: base64Image });

            if (!result.success) {
                console.error('[UnifiedAI] Vision extraction failed:', result.text);
                return null;
            }

            const cleaned = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleaned);

            if (Array.isArray(data)) {
                return data.filter((item: any) => item.word && typeof item.word === 'string');
            }
            return null;
        } catch (error) {
            console.error('[UnifiedAI] Vision extraction exception:', error);
            return null;
        }
    }

    async generateRussianSentence(
        level: 'A1-A2' | 'B1-B2' | 'C1-C2',
        vocabWords?: string[]
    ): Promise<{ sentence: string; hint?: string; expectedTranslation: string } | null> {
        const prompt = PromptTemplates.generateRussianSentence(level, vocabWords);

        const response = await this.generateText(prompt, { jsonMode: true });
        if (!response.success) return null;

        try {
            const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }

    // ============ UNIFIED EVALUATION ============

    async evaluate(input:
        | { type: 'translation'; original: string; user: string; expected: string }
        | { type: 'conversation'; userText: string; context?: string }
        | { type: 'dialogue'; context: string; response: string }
        | { type: 'story-answer'; question: string; answer: string; correctAnswer: string; storyContext: string }
    ): Promise<{
        feedback: string;
        corrections: Array<{ wrong: string; correct: string; type?: 'spelling' | 'grammar' }>;
        grammarConcepts: Array<{ name: string; nameRu: string; description: string; rule: string; example: string }>;
        vocabularySuggestions: Array<{ word: string; translation: string; definition: string; level: string }>;
        accuracy?: number;
        grammarScore?: number;
        errors?: string[];
    }> {
        let prompt = '';

        if (input.type === 'translation') {
            prompt = PromptTemplates.evaluateTranslation(input.original, input.user, input.expected);
        } else if (input.type === 'conversation') {
            prompt = PromptTemplates.evaluateEnglishText(input.userText, input.context);
        } else if (input.type === 'dialogue') {
            prompt = PromptTemplates.evaluateDialogueResponse(input.context, input.response);
        } else if (input.type === 'story-answer') {
            prompt = PromptTemplates.evaluateStoryAnswer(input.question, input.answer, input.correctAnswer, input.storyContext);
        }

        const response = await this.generateText(prompt, { jsonMode: true });

        // Default empty structure
        const defaultResult = {
            feedback: '',
            corrections: [],
            grammarConcepts: [],
            vocabularySuggestions: []
        };

        if (!response.success) return { ...defaultResult, feedback: 'Error connecting to AI' };

        try {
            const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleaned);
            return { ...defaultResult, ...data };
        } catch (e) {
            console.error('Failed to parse evaluation response:', e);
            return { ...defaultResult, feedback: response.text };
        }
    }

    async generateStoryWithQuestions(
        topic: string,
        level: string,
        words?: string[],
        grammar?: string[]
    ): Promise<{ story: string; title: string; questions: any[]; targetWordsUsed: string[] } | null> {
        const prompt = PromptTemplates.generateStoryWithQuestions(topic, level as any, words, grammar);

        const response = await this.generateText(prompt, { jsonMode: true });
        if (!response.success) return null;

        try {
            const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (e) {
            console.error('Story parsing failed:', e);
            return null;
        }
    }
}

export const unifiedAI = UnifiedAIManager.getInstance();
