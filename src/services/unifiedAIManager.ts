// src/services/unifiedAIManager.ts
// Unified AI Manager - single entry point for all AI operations
// Uses external APIs only (Google Gemini, Perplexity)

import {
    getWorkingKey,
    markKeyFailed,
    getAllAPIKeys,
    getTimeoutRemaining
} from './apiKeyService';
import { PromptTemplates } from './promptTemplates';

// Types
export type AIBackend = 'google' | 'perplexity' | 'none';

export interface AIResponse {
    text: string;
    source: AIBackend;
    success: boolean;
    error?: string;
}

export interface AIManagerStatus {
    activeBackend: AIBackend;
    google: { available: boolean; keyCount: number; timeoutMinutes: number };
    perplexity: { available: boolean; keyCount: number; timeoutMinutes: number };
}

// Listeners for status changes
type StatusListener = (status: AIManagerStatus) => void;
const statusListeners = new Set<StatusListener>();

// Singleton class
class UnifiedAIManager {
    private static instance: UnifiedAIManager;
    private cachedStatus: AIManagerStatus | null = null;

    private constructor() { }

    static getInstance(): UnifiedAIManager {
        if (!UnifiedAIManager.instance) {
            UnifiedAIManager.instance = new UnifiedAIManager();
        }
        return UnifiedAIManager.instance;
    }

    // ============ STATUS MANAGEMENT ============

    async getStatus(): Promise<AIManagerStatus> {
        const allKeys = await getAllAPIKeys();
        const now = Date.now();

        const googleKeys = allKeys.filter(k => k.type === 'google');
        const perplexityKeys = allKeys.filter(k => k.type === 'perplexity');

        const googleActive = googleKeys.find(k => k.isEnabled && (!k.timeoutUntil || k.timeoutUntil <= now));
        const perplexityActive = perplexityKeys.find(k => k.isEnabled && (!k.timeoutUntil || k.timeoutUntil <= now));
        const googleTimeout = googleKeys.find(k => k.isEnabled && k.timeoutUntil && k.timeoutUntil > now);
        const perplexityTimeout = perplexityKeys.find(k => k.isEnabled && k.timeoutUntil && k.timeoutUntil > now);

        // Determine active backend (external APIs only)
        let activeBackend: AIBackend = 'none';
        if (googleActive) {
            activeBackend = 'google';
        } else if (perplexityActive) {
            activeBackend = 'perplexity';
        }

        this.cachedStatus = {
            activeBackend,
            google: {
                available: !!googleActive,
                keyCount: googleKeys.length,
                timeoutMinutes: googleTimeout ? getTimeoutRemaining(googleTimeout) : 0
            },
            perplexity: {
                available: !!perplexityActive,
                keyCount: perplexityKeys.length,
                timeoutMinutes: perplexityTimeout ? getTimeoutRemaining(perplexityTimeout) : 0
            }
        };

        return this.cachedStatus;
    }

    onStatusChange(callback: StatusListener): () => void {
        statusListeners.add(callback);
        return () => statusListeners.delete(callback);
    }

    private notifyStatusChange() {
        if (this.cachedStatus) {
            statusListeners.forEach(cb => cb(this.cachedStatus!));
        }
    }

    // ============ CORE AI METHODS ============

    async generateText(prompt: string, options?: { jsonMode?: boolean }): Promise<AIResponse> {
        // Try Google API first
        const googleKey = await getWorkingKey('google');
        if (googleKey) {
            try {
                console.log('[UnifiedAI] Using Google API');
                const text = await this.callGoogleAPI(prompt, googleKey.key);
                return { text, source: 'google', success: true };
            } catch (error: any) {
                if (error.message?.includes('429')) {
                    console.warn('[UnifiedAI] Google rate limited (429), switching...');
                } else {
                    console.warn('[UnifiedAI] Google error:', error.message);
                }
                await markKeyFailed(googleKey.id);
                this.getStatus().then(() => this.notifyStatusChange());
            }
        }

        // Try Perplexity API
        const perplexityKey = await getWorkingKey('perplexity');
        if (perplexityKey) {
            try {
                console.log('[UnifiedAI] Using Perplexity API');
                const text = await this.callPerplexityAPI(prompt, perplexityKey.key);
                return { text, source: 'perplexity', success: true };
            } catch (error: any) {
                if (error.message?.includes('429')) {
                    console.warn('[UnifiedAI] Perplexity rate limited (429), switching...');
                } else {
                    console.warn('[UnifiedAI] Perplexity error:', error.message);
                }
                await markKeyFailed(perplexityKey.id);
                this.getStatus().then(() => this.notifyStatusChange());
            }
        }

        // No APIs available
        throw new ApiKeyError('Нет доступных AI провайдеров. Добавьте API ключ в настройках.');
    }

    async *generateTextStream(prompt: string): AsyncGenerator<{ text: string; source: AIBackend; done: boolean }> {
        // Try Google streaming
        const googleKey = await getWorkingKey('google');
        if (googleKey) {
            try {
                console.log('[UnifiedAI] Streaming via Google API');
                for await (const chunk of this.streamGoogleAPI(prompt, googleKey.key)) {
                    yield { text: chunk, source: 'google', done: false };
                }
                yield { text: '', source: 'google', done: true };
                return;
            } catch (error: any) {
                if (error.message?.includes('429')) {
                    console.warn('[UnifiedAI] Google rate limited (429), switching...');
                } else {
                    console.warn('[UnifiedAI] Google streaming warning:', error.message);
                }
                await markKeyFailed(googleKey.id);
            }
        }

        // Try Perplexity streaming
        const perplexityKey = await getWorkingKey('perplexity');
        if (perplexityKey) {
            try {
                console.log('[UnifiedAI] Streaming via Perplexity API');
                for await (const chunk of this.streamPerplexityAPI(prompt, perplexityKey.key)) {
                    yield { text: chunk, source: 'perplexity', done: false };
                }
                yield { text: '', source: 'perplexity', done: true };
                return;
            } catch (error: any) {
                if (error.message?.includes('429')) {
                    console.warn('[UnifiedAI] Perplexity streaming rate limited (429)');
                } else {
                    console.warn('[UnifiedAI] Perplexity streaming warning:', error.message);
                }
                await markKeyFailed(perplexityKey.id);
            }
        }

        yield { text: 'AI недоступен. Добавьте API ключ в настройках.', source: 'none', done: true };
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
        const googleKey = await getWorkingKey('google');
        if (!googleKey) {
            console.error('[UnifiedAI] Vision requires Google API key');
            return null;
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleKey.key}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    text: PromptTemplates.extractWordsFromImage()
                                },
                                {
                                    inline_data: {
                                        mime_type: 'image/jpeg',
                                        data: base64Image.replace(/^data:image\/\w+;base64,/, '')
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.2,
                            maxOutputTokens: 2048,
                        }
                    })
                }
            );

            if (!response.ok) {
                const error = await response.text();
                console.error('[UnifiedAI] Vision API error:', error);
                await markKeyFailed(googleKey.id);
                return null;
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

            const result = JSON.parse(cleaned);
            if (Array.isArray(result)) {
                return result.filter((item: any) => item.word && typeof item.word === 'string');
            }
            return null;
        } catch (error: any) {
            console.error('[UnifiedAI] Vision extraction failed:', error.message);
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
    ): Promise<{
        // Common
        feedback: string;
        corrections: Array<{ wrong: string; correct: string; type?: 'spelling' | 'grammar' }>;
        grammarConcepts: Array<{ name: string; nameRu: string; description: string; rule: string; example: string }>;
        vocabularySuggestions: Array<{ word: string; translation: string; definition: string; level: string }>;

        // Translation specific
        accuracy?: number;
        grammarScore?: number;
        errors?: string[];

        // Conversation specific
        conversationResponse?: string;
        hasErrors?: boolean;

        // Dialogue specific
        score?: number;
    }> {
        let prompt = '';
        let result: any = {};

        switch (input.type) {
            case 'translation':
                prompt = PromptTemplates.evaluateTranslation(input.original, input.user, input.expected);
                break;
            case 'conversation':
                prompt = PromptTemplates.evaluateEnglishText(input.userText, input.context);
                break;
            case 'dialogue':
                prompt = PromptTemplates.evaluateDialogueResponse(input.context, input.response);
                break;
        }

        const response = await this.generateText(prompt, { jsonMode: true });

        // Default empty result
        const emptyResult = {
            feedback: '',
            corrections: [],
            grammarConcepts: [],
            vocabularySuggestions: []
        };

        if (response.success) {
            try {
                const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                const data = JSON.parse(cleaned);

                // Map API response to unified format based on type
                if (input.type === 'translation') {
                    // Quick local calculation for translation
                    const userWords = input.user.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                    const expectedWords = input.expected.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                    const matched = userWords.filter(w => expectedWords.includes(w));
                    const wordOverlap = expectedWords.length > 0 ? matched.length / expectedWords.length : 0;

                    const accuracy = Math.round(
                        (data.semanticScore || 0.5) * 50 +
                        wordOverlap * 25 +
                        (data.grammarScore || 0.5) * 25
                    );

                    // Combine errors
                    const allErrors: string[] = data.errors || [];
                    if (data.spellingErrors) {
                        data.spellingErrors.forEach((e: any) => allErrors.push(`Орфография: ${e.wrong} → ${e.correct}`));
                    }
                    if (data.grammarErrors) {
                        data.grammarErrors.forEach((e: any) => allErrors.push(`${e.wrong} → ${e.correct}`));
                    }

                    return {
                        ...emptyResult,
                        feedback: data.feedback || 'Хорошая попытка!',
                        corrections: [], // Detailed errors are in 'errors' string array for translation UI legacy
                        grammarConcepts: data.grammarConcepts || [],
                        vocabularySuggestions: data.vocabularySuggestions || [],
                        accuracy: Math.min(100, accuracy),
                        grammarScore: data.grammarScore || 0.5,
                        errors: allErrors
                    };
                } else if (input.type === 'conversation') {
                    return {
                        ...emptyResult,
                        feedback: '', // Conversation uses conversationResponse
                        conversationResponse: data.conversationResponse || 'Good job!',
                        hasErrors: data.hasErrors || false,
                        corrections: data.corrections || [],
                        grammarConcepts: data.grammarConcepts || [],
                        vocabularySuggestions: data.vocabularySuggestions || []
                    };
                } else if (input.type === 'dialogue') {
                    return {
                        ...emptyResult,
                        feedback: data.feedback || '',
                        score: Math.round((data.score || 0.5) * 100),
                        corrections: data.corrections || []
                    };
                }

            } catch (e) {
                console.error('Unified evaluate parse error:', e);
            }
        }

        return { ...emptyResult, feedback: 'AI error', accuracy: 0, hasErrors: false };
    }

    // Legacy wrappers for backward compatibility (can be removed later)
    async evaluateTranslation(original: string, user: string, expected: string) {
        const res = await this.evaluate({ type: 'translation', original, user, expected });
        return {
            accuracy: res.accuracy || 0,
            feedback: res.feedback,
            errors: res.errors || [],
            grammarScore: res.grammarScore || 0,
            grammarConcepts: res.grammarConcepts,
            spellingErrors: [] // usage migrated to errors array
        };
    }

    async evaluateEnglishText(userText: string, context?: string) {
        const res = await this.evaluate({ type: 'conversation', userText, context });
        return {
            hasErrors: res.hasErrors || false,
            corrections: res.corrections,
            grammarConcepts: res.grammarConcepts,
            vocabularySuggestions: res.vocabularySuggestions,
            conversationResponse: res.conversationResponse || ''
        };
    }

    async evaluateDialogueResponse(context: string, userResponse: string) {
        const res = await this.evaluate({ type: 'dialogue', context, response: userResponse });
        return {
            score: res.score || 0,
            feedback: res.feedback,
            corrections: res.corrections.map(c => typeof c === 'string' ? c : `${c.wrong} -> ${c.correct}`) // Handle type difference if any
        };
    }

    /**
     * Helper to reliably parse JSON from AI response
     */
    private parseJSON<T>(text: string): T | null {
        try {
            // First try simple parse
            return JSON.parse(text);
        } catch (e) {
            // Try extracting JSON block
            try {
                const match = text.match(/\{[\s\S]*\}/);
                if (match) {
                    return JSON.parse(match[0]);
                }
            } catch (e2) {
                // Failed to extract
            }
        }
        console.warn('Failed to parse JSON from AI response:', text.substring(0, 100) + '...');
        return null;
    }

    async generateStoryWithQuestions(
        topic: string,
        level: 'A1-A2' | 'B1-B2' | 'C1-C2',
        vocabularyWords?: string[],
        grammarFocus?: string[]
    ): Promise<{ title: string; story: string; questions: Array<{ question: string; correctAnswer: string }> } | null> {
        const prompt = PromptTemplates.generateStoryWithQuestions(topic, level, vocabularyWords, grammarFocus);

        const response = await this.generateText(prompt, { jsonMode: true });
        if (!response.success) return null;

        return this.parseJSON(response.text);
    }

    async checkStoryAnswer(
        question: string,
        userAnswer: string,
        correctAnswer: string,
        storyContext: string
    ): Promise<{ isCorrect: boolean; feedback: string }> {
        const prompt = PromptTemplates.checkStoryAnswer(question, userAnswer, correctAnswer, storyContext);

        const response = await this.generateText(prompt, { jsonMode: true });
        if (!response.success) {
            return { isCorrect: false, feedback: 'Не удалось проверить ответ. Попробуйте ещё раз.' };
        }

        const data = this.parseJSON<{ isCorrect: boolean; feedback: string }>(response.text);
        return data || { isCorrect: false, feedback: 'Ошибка проверки.' };
    }

    // ============ PRIVATE API METHODS ============

    private async callGoogleAPI(prompt: string, apiKey: string): Promise<string> {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Google API error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    private async * streamGoogleAPI(prompt: string, apiKey: string): AsyncGenerator<string> {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Google API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) yield text;
                    } catch { }
                }
            }
        }
    }

    private async callPerplexityAPI(prompt: string, apiKey: string): Promise<string> {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-sonar-small-128k-online',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            throw new Error(`Perplexity API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    private async * streamPerplexityAPI(prompt: string, apiKey: string): AsyncGenerator<string> {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-sonar-small-128k-online',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 2048,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`Perplexity API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        const text = data.choices?.[0]?.delta?.content;
                        if (text) yield text;
                    } catch { }
                }
            }
        }
    }
}

// Export singleton
export const unifiedAI = UnifiedAIManager.getInstance();

// Helper function for quick access
export async function getAIBackend(): Promise<AIBackend> {
    const status = await unifiedAI.getStatus();
    return status.activeBackend;
}

export class ApiKeyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApiKeyError';
    }
}
