// src/services/unifiedAIManager.ts
// Unified AI Manager - single entry point for all AI operations
// Automatically chooses between API keys and Local LLM

import { Platform } from 'react-native';
import {
    getWorkingKey,
    markKeyFailed,
    getAllAPIKeys,
    getTimeoutRemaining
} from './apiKeyService';
import { llmManager } from './llmManager';

// Types
export type AIBackend = 'google' | 'perplexity' | 'local' | 'none';

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
    local: { available: boolean; initializing: boolean; progress: number };
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

        // Determine active backend
        let activeBackend: AIBackend = 'none';
        if (googleActive) {
            activeBackend = 'google';
        } else if (perplexityActive) {
            activeBackend = 'perplexity';
        } else if (llmManager.ready) {
            activeBackend = 'local';
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
            },
            local: {
                available: llmManager.ready,
                initializing: llmManager.initializing,
                progress: 0
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
                console.error('[UnifiedAI] Google failed:', error.message);
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
                console.error('[UnifiedAI] Perplexity failed:', error.message);
                await markKeyFailed(perplexityKey.id);
                this.getStatus().then(() => this.notifyStatusChange());
            }
        }

        // Fallback to Local LLM
        if (llmManager.ready) {
            try {
                console.log('[UnifiedAI] Using Local LLM');
                const text = await llmManager.complete(prompt, options?.jsonMode);
                return { text, source: 'local', success: true };
            } catch (error: any) {
                console.error('[UnifiedAI] Local LLM failed:', error.message);
            }
        }

        // Try to initialize local LLM if not ready
        if (!llmManager.ready && !llmManager.initializing) {
            try {
                console.log('[UnifiedAI] Initializing Local LLM...');
                await llmManager.initialize();
                const text = await llmManager.complete(prompt, options?.jsonMode);
                return { text, source: 'local', success: true };
            } catch (error: any) {
                console.error('[UnifiedAI] Failed to initialize Local LLM:', error.message);
            }
        }

        return {
            text: '',
            source: 'none',
            success: false,
            error: 'Нет доступных AI провайдеров. Добавьте API ключ или загрузите локальную модель.'
        };
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
                console.error('[UnifiedAI] Google streaming failed:', error.message);
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
                console.error('[UnifiedAI] Perplexity streaming failed:', error.message);
                await markKeyFailed(perplexityKey.id);
            }
        }

        // Fallback to local LLM
        if (llmManager.ready) {
            try {
                for await (const chunk of llmManager.completeStream(prompt)) {
                    yield { text: chunk, source: 'local', done: false };
                }
                yield { text: '', source: 'local', done: true };
                return;
            } catch (error) {
                console.error('[UnifiedAI] Local streaming failed');
            }
        }

        yield { text: 'AI недоступен', source: 'none', done: true };
    }

    // ============ SPECIALIZED METHODS ============

    async generateSentenceForWord(
        word: string,
        translation: string,
        level: string
    ): Promise<{ sentence: string; missingWord: string } | null> {
        const prompt = `Generate ONE English sentence using the word "${word}" (${translation}).
Level: ${level}. 
The sentence should be natural and help learn this word.
Output JSON only: {"sentence": "The ___ was beautiful.", "missingWord": "${word}"}
Replace the target word with ___ in the sentence.`;

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
                                    text: `Look at this image and extract ALL English words or vocabulary you can see.
For each word, provide its Russian translation.
Only include actual English words, not numbers or symbols.
Output JSON array only: [{"word": "example", "translation": "пример"}, ...]` },
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
        const vocabPart = vocabWords?.length
            ? `Try to use these vocabulary words if appropriate: ${vocabWords.join(', ')}.`
            : '';

        const prompt = `Generate ONE Russian sentence for translation practice.
Level: ${level}
${vocabPart}

Output JSON only: {
    "sentence": "Русское предложение",
    "hint": "optional hint in Russian",
    "expectedTranslation": "English translation"
}`;

        const response = await this.generateText(prompt, { jsonMode: true });
        if (!response.success) return null;

        try {
            const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }

    async evaluateTranslation(
        original: string,
        userTranslation: string,
        expectedTranslation: string
    ): Promise<{ accuracy: number; feedback: string; errors: string[]; grammarScore: number }> {
        // Quick local evaluation
        const userWords = userTranslation.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const expectedWords = expectedTranslation.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matched = userWords.filter(w => expectedWords.includes(w));
        const wordOverlap = expectedWords.length > 0 ? matched.length / expectedWords.length : 0;

        // Try AI evaluation
        const prompt = `Evaluate this translation from Russian to English.
Russian: "${original}"
User translation: "${userTranslation}"
Expected: "${expectedTranslation}"

Analyze:
1. semanticScore (0.0-1.0): Does it convey the same meaning?
2. grammarScore (0.0-1.0): Is the grammar correct?
3. feedback: Brief feedback in Russian
4. errors: List of specific errors in Russian (max 3)

Output JSON: {"semanticScore": 0.8, "grammarScore": 0.9, "feedback": "...", "errors": [...]}`;

        const response = await this.generateText(prompt, { jsonMode: true });

        if (response.success) {
            try {
                const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                const data = JSON.parse(cleaned);

                // Combined accuracy: 50% semantic + 25% word overlap + 25% grammar
                const accuracy = Math.round(
                    (data.semanticScore || 0.5) * 50 +
                    wordOverlap * 25 +
                    (data.grammarScore || 0.5) * 25
                );

                return {
                    accuracy: Math.min(100, accuracy),
                    feedback: data.feedback || 'Хорошая попытка!',
                    errors: data.errors || [],
                    grammarScore: data.grammarScore || 0.5
                };
            } catch {
                // Parse error, use fallback
            }
        }

        // Fallback evaluation
        const fallbackAccuracy = Math.round(wordOverlap * 100);
        return {
            accuracy: fallbackAccuracy,
            feedback: fallbackAccuracy >= 70 ? 'Хорошо!' : 'Попробуй ещё раз',
            errors: [],
            grammarScore: 0.5
        };
    }

    async generateDialogue(
        topic: string,
        targetWords: string[],
        turnCount: number = 2
    ): Promise<{ turns: Array<{ speaker: 'A' | 'B'; text: string }> } | null> {
        const prompt = `Create a short English dialogue about "${topic}".
Use these vocabulary words naturally: ${targetWords.join(', ')}.
Generate ${turnCount} turns per speaker.

Output JSON: {
    "turns": [
        {"speaker": "A", "text": "Hello, how are you today?"},
        {"speaker": "B", "text": "I'm great, thanks for asking!"}
    ]
}`;

        const response = await this.generateText(prompt, { jsonMode: true });
        if (!response.success) return null;

        try {
            const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }

    async generateReadingText(
        topic: string,
        targetWords: string[],
        level: string
    ): Promise<{ text: string; questions: Array<{ question: string; correctAnswer: string }> } | null> {
        const prompt = `Create a short English reading text about "${topic}" for ${level} learners.
Use these vocabulary words: ${targetWords.join(', ')}.
Generate 2-3 comprehension questions.

Output JSON: {
    "text": "The reading passage text here...",
    "questions": [
        {"question": "What is the main idea?", "correctAnswer": "The correct answer"}
    ]
}`;

        const response = await this.generateText(prompt, { jsonMode: true });
        if (!response.success) return null;

        try {
            const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }

    async evaluateDialogueResponse(
        context: string,
        userResponse: string
    ): Promise<{ score: number; feedback: string; corrections: string[] }> {
        const prompt = `You are evaluating a student's English dialogue response.
Context: ${context}
Student's response: "${userResponse}"

Evaluate:
1. Is the response appropriate for the context?
2. Is the grammar correct?
3. Provide brief feedback in Russian.

Output JSON: {"score": 0.8, "feedback": "Отличный ответ!", "corrections": []}`;

        const response = await this.generateText(prompt, { jsonMode: true });

        if (response.success) {
            try {
                const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                const data = JSON.parse(cleaned);
                return {
                    score: Math.round((data.score || 0.5) * 100),
                    feedback: data.feedback || 'Хорошо!',
                    corrections: data.corrections || []
                };
            } catch {
                // Parse error
            }
        }

        return { score: 50, feedback: 'Неплохо!', corrections: [] };
    }

    async generateStoryWithQuestions(
        topic: string,
        level: 'A1-A2' | 'B1-B2' | 'C1-C2'
    ): Promise<{ title: string; story: string; questions: Array<{ question: string; correctAnswer: string }> } | null> {
        const levelGuide = {
            'A1-A2': 'Use simple vocabulary and short sentences. Present tense mostly.',
            'B1-B2': 'Use varied vocabulary and sentence structures. Past and present tenses.',
            'C1-C2': 'Use sophisticated vocabulary, idioms, and complex sentences.',
        };

        const prompt = `Create a short engaging story for English learners.
Topic: ${topic}
Language Level: ${level}
Guidelines: ${levelGuide[level]}

The story should be 5-7 sentences long.
Create 4 comprehension questions about the story (mix of detail and inference questions).

Output strictly JSON:
{
    "title": "Story Title",
    "story": "The complete story text...",
    "questions": [
        {"question": "Question about the story?", "correctAnswer": "The correct answer"}
    ]
}`;

        const response = await this.generateText(prompt, { jsonMode: true });
        if (!response.success) return null;

        try {
            const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }

    async checkStoryAnswer(
        question: string,
        userAnswer: string,
        correctAnswer: string,
        storyContext: string
    ): Promise<{ isCorrect: boolean; feedback: string }> {
        const prompt = `Story context: "${storyContext}"
Question: "${question}"
Expected answer: "${correctAnswer}"
Student's answer: "${userAnswer}"

Evaluate if the student's answer is correct or acceptable.

Output strictly JSON:
{ "isCorrect": true/false, "feedback": "Brief encouraging feedback in Russian" }`;

        const response = await this.generateText(prompt, { jsonMode: true });

        if (response.success) {
            try {
                const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                return JSON.parse(cleaned);
            } catch { }
        }

        return { isCorrect: false, feedback: 'Не удалось проверить ответ' };
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

    private async *streamGoogleAPI(prompt: string, apiKey: string): AsyncGenerator<string> {
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

    private async *streamPerplexityAPI(prompt: string, apiKey: string): AsyncGenerator<string> {
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
