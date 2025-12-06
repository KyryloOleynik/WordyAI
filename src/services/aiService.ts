// src/services/aiService.ts
// Unified AI Service with streaming support and API key management
// Uses external APIs only (Google Gemini, Perplexity)

import {
    getWorkingKey,
    markKeyFailed,
    getAllAPIKeys,
    getTimeoutRemaining
} from './apiKeyService';

// AI Service Response
export interface AIServiceResponse {
    text: string;
    source: 'google' | 'perplexity' | 'none';
    success: boolean;
}

// API Status for UI display
export interface APIStatus {
    google: { available: boolean; inTimeout: boolean; timeoutMinutes: number; keyCount: number };
    perplexity: { available: boolean; inTimeout: boolean; timeoutMinutes: number; keyCount: number };
}

// Global status cache
let cachedStatus: APIStatus | null = null;
let statusListeners: Set<(status: APIStatus) => void> = new Set();

/**
 * Get current API status for UI display
 */
export async function getAPIStatus(): Promise<APIStatus> {
    const allKeys = await getAllAPIKeys();
    const now = Date.now();

    const googleKeys = allKeys.filter(k => k.type === 'google');
    const perplexityKeys = allKeys.filter(k => k.type === 'perplexity');

    const googleActive = googleKeys.find(k => k.isEnabled && (!k.timeoutUntil || k.timeoutUntil <= now));
    const perplexityActive = perplexityKeys.find(k => k.isEnabled && (!k.timeoutUntil || k.timeoutUntil <= now));

    const googleTimedOut = googleKeys.find(k => k.isEnabled && k.timeoutUntil && k.timeoutUntil > now);
    const perplexityTimedOut = perplexityKeys.find(k => k.isEnabled && k.timeoutUntil && k.timeoutUntil > now);

    cachedStatus = {
        google: {
            available: !!googleActive,
            inTimeout: !!googleTimedOut,
            timeoutMinutes: googleTimedOut ? getTimeoutRemaining(googleTimedOut) : 0,
            keyCount: googleKeys.length,
        },
        perplexity: {
            available: !!perplexityActive,
            inTimeout: !!perplexityTimedOut,
            timeoutMinutes: perplexityTimedOut ? getTimeoutRemaining(perplexityTimedOut) : 0,
            keyCount: perplexityKeys.length,
        },
    };

    return cachedStatus;
}

/**
 * Subscribe to status changes
 */
export function onAPIStatusChange(callback: (status: APIStatus) => void): () => void {
    statusListeners.add(callback);
    return () => statusListeners.delete(callback);
}

function notifyStatusChange(status: APIStatus) {
    statusListeners.forEach(cb => cb(status));
}

// ============ Google AI with Streaming ============

async function* streamGoogleAI(prompt: string, apiKey: string): AsyncGenerator<string> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Google AI error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

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
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }
    }
}

async function callGoogleAI(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Google AI error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ============ Perplexity API with Streaming ============

async function* streamPerplexityAI(prompt: string, apiKey: string): AsyncGenerator<string> {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2048,
            stream: true,
        }),
    });

    if (!response.ok) {
        throw new Error(`Perplexity error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

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
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }
    }
}

async function callPerplexityAI(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2048,
        }),
    });

    if (!response.ok) {
        throw new Error(`Perplexity error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

// ============ Main AI Service ============

/**
 * Get AI completion with automatic fallback
 * Priority: Google -> Perplexity
 */
export async function getAICompletion(
    prompt: string,
    options?: { jsonMode?: boolean }
): Promise<AIServiceResponse> {
    // Try Google first
    const googleKey = await getWorkingKey('google');
    if (googleKey) {
        try {
            console.log('Using Google AI...');
            const text = await callGoogleAI(prompt, googleKey.key);
            return { text, source: 'google', success: true };
        } catch (error) {
            console.error('Google AI failed:', error);
            await markKeyFailed(googleKey.id);
            getAPIStatus().then(notifyStatusChange); // Update UI
        }
    }

    // Try Perplexity
    const perplexityKey = await getWorkingKey('perplexity');
    if (perplexityKey) {
        try {
            console.log('Using Perplexity AI...');
            const text = await callPerplexityAI(prompt, perplexityKey.key);
            return { text, source: 'perplexity', success: true };
        } catch (error) {
            console.error('Perplexity failed:', error);
            await markKeyFailed(perplexityKey.id);
            getAPIStatus().then(notifyStatusChange);
        }
    }

    // No APIs available
    return { text: '', source: 'none', success: false };
}

/**
 * Streaming AI completion - yields text chunks as they arrive
 * Priority: Google (streaming) -> Perplexity (streaming)
 */
export async function* getAICompletionStream(prompt: string): AsyncGenerator<{ text: string; source: string; done: boolean }> {
    // Try Google streaming
    const googleKey = await getWorkingKey('google');
    if (googleKey) {
        try {
            console.log('Using Google AI (streaming)...');
            for await (const chunk of streamGoogleAI(prompt, googleKey.key)) {
                yield { text: chunk, source: 'google', done: false };
            }
            yield { text: '', source: 'google', done: true };
            return;
        } catch (error) {
            console.error('Google streaming failed:', error);
            await markKeyFailed(googleKey.id);
            getAPIStatus().then(notifyStatusChange);
        }
    }

    // Try Perplexity streaming
    const perplexityKey = await getWorkingKey('perplexity');
    if (perplexityKey) {
        try {
            console.log('Using Perplexity AI (streaming)...');
            for await (const chunk of streamPerplexityAI(prompt, perplexityKey.key)) {
                yield { text: chunk, source: 'perplexity', done: false };
            }
            yield { text: '', source: 'perplexity', done: true };
            return;
        } catch (error) {
            console.error('Perplexity streaming failed:', error);
            await markKeyFailed(perplexityKey.id);
            getAPIStatus().then(notifyStatusChange);
        }
    }

    // No APIs available
    yield { text: 'AI недоступен. Добавьте API ключ в настройках.', source: 'none', done: true };
}

/**
 * Chat completion with streaming (for ChatScreen)
 */
export async function* getChatCompletionStream(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): AsyncGenerator<{ text: string; source: string; done: boolean }> {
    // Format messages for API
    const formattedMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
    }));

    // Try Google streaming (format as single prompt for Gemini)
    const googleKey = await getWorkingKey('google');
    if (googleKey) {
        try {
            console.log('Using Google AI for chat (streaming)...');
            const chatPrompt = formattedMessages
                .map(m => `${m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System'}: ${m.content}`)
                .join('\n') + '\nAssistant:';

            for await (const chunk of streamGoogleAI(chatPrompt, googleKey.key)) {
                yield { text: chunk, source: 'google', done: false };
            }
            yield { text: '', source: 'google', done: true };
            return;
        } catch (error) {
            console.error('Google chat streaming failed:', error);
            await markKeyFailed(googleKey.id);
        }
    }

    // No APIs available
    yield { text: 'AI недоступен. Добавьте API ключ в настройках.', source: 'none', done: true };
}

// ============ Helper Functions ============

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
export function parseAIJson<T>(text: string): T | null {
    try {
        const cleaned = text
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('Failed to parse AI JSON:', e);
        return null;
    }
}

/**
 * Generate translation with context
 */
export async function translateWithContext(
    word: string,
    sentenceContext?: string
): Promise<{
    translations: string[];
    definitions: string[];
    partOfSpeech: string;
    phonetic: string;
    examples: string[];
    cefrLevel: string;
} | null> {
    const contextPart = sentenceContext
        ? `The word appears in this context: "${sentenceContext}".`
        : '';

    const prompt = `
        Provide a dictionary entry for "${word}".
        ${contextPart}
        
        Include multiple Russian translations if applicable.
        Output JSON only:
        {
            "translations": ["перевод1", "перевод2"],
            "definitions": ["definition1"],
            "partOfSpeech": "noun",
            "phonetic": "/fəˈnetɪk/",
            "examples": ["example sentence"],
            "cefrLevel": "B1"
        }
    `;

    const response = await getAICompletion(prompt, { jsonMode: true });
    return response.success ? parseAIJson(response.text) : null;
}

/**
 * Generate Russian sentence for translation exercise
 */
export async function generateRussianSentence(
    level: 'A1-A2' | 'B1-B2' | 'C1-C2',
    topic?: string
): Promise<{ sentence: string; hint?: string } | null> {
    const prompt = `
        Generate ONE Russian sentence for translation practice.
        Level: ${level}
        ${topic ? `Topic: ${topic}` : ''}
        
        Output JSON: {"sentence": "Русское предложение", "hint": "подсказка"}
    `;

    const response = await getAICompletion(prompt, { jsonMode: true });
    return response.success ? parseAIJson(response.text) : null;
}

/**
 * Evaluate translation accuracy
 */
export async function evaluateTranslation(
    original: string,
    userTranslation: string,
    expected: string
): Promise<{ accuracy: number; feedback: string; errors: string[] }> {
    // Quick local evaluation first
    const userWords = userTranslation.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const expectedWords = expected.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const matched = userWords.filter(w => expectedWords.includes(w));
    const localScore = expectedWords.length > 0 ? (matched.length / expectedWords.length) * 100 : 50;

    // Try AI evaluation
    const prompt = `
        Evaluate translation from Russian to English.
        Russian: "${original}"
        User: "${userTranslation}"
        Expected: "${expected}"
        
        Output JSON: {"semanticScore": 0.0-1.0, "feedback": "на русском", "errors": ["ошибки"]}
    `;

    const response = await getAICompletion(prompt, { jsonMode: true });

    if (response.success) {
        const data = parseAIJson<{ semanticScore: number; feedback: string; errors: string[] }>(response.text);
        if (data) {
            const accuracy = Math.round((localScore * 0.4 + data.semanticScore * 100 * 0.6));
            return { accuracy: Math.min(100, accuracy), feedback: data.feedback, errors: data.errors };
        }
    }

    return {
        accuracy: Math.round(localScore),
        feedback: localScore >= 70 ? 'Хорошо!' : 'Попробуй ещё раз',
        errors: [],
    };
}
