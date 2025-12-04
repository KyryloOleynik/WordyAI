import { Platform } from 'react-native';
import { getWorkingKey, markKeyFailed, APIKeyType } from './apiKeyService';
import { llmManager } from './llmManager';

// AI Service Response
export interface AIServiceResponse {
    text: string;
    source: 'google' | 'perplexity' | 'local';
    success: boolean;
}

// ============ Google AI API ============

async function callGoogleAI(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
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

// ============ Perplexity API ============

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
            max_tokens: 1024,
        }),
    });

    if (!response.ok) {
        throw new Error(`Perplexity error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

// ============ Main AI Service ============

export async function getAICompletion(
    prompt: string,
    options?: {
        jsonMode?: boolean;
        preferredSource?: APIKeyType;
        contextWords?: string[];
    }
): Promise<AIServiceResponse> {
    // Enhanced prompt for context-aware translations
    let enhancedPrompt = prompt;
    if (options?.contextWords && options.contextWords.length > 0) {
        enhancedPrompt = `Context: The following words are in the same sentence: [${options.contextWords.join(', ')}]\n\n${prompt}`;
    }

    // Priority 1: Google AI
    const googleKey = await getWorkingKey('google');
    if (googleKey) {
        try {
            console.log('Using Google AI...');
            const text = await callGoogleAI(enhancedPrompt, googleKey.key);
            return { text, source: 'google', success: true };
        } catch (error) {
            console.error('Google AI failed:', error);
            await markKeyFailed(googleKey.id);
        }
    }

    // Priority 2: Perplexity
    const perplexityKey = await getWorkingKey('perplexity');
    if (perplexityKey) {
        try {
            console.log('Using Perplexity AI...');
            const text = await callPerplexityAI(enhancedPrompt, perplexityKey.key);
            return { text, source: 'perplexity', success: true };
        } catch (error) {
            console.error('Perplexity failed:', error);
            await markKeyFailed(perplexityKey.id);
        }
    }

    // Priority 3: Local LLM (fallback) - using singleton llmManager
    if (llmManager.ready || !llmManager.initializing) {
        try {
            console.log('Using Local LLM via llmManager...');
            const text = await llmManager.complete(enhancedPrompt, options?.jsonMode);
            return { text, source: 'local', success: true };
        } catch (error) {
            console.error('Local LLM failed:', error);
        }
    }

    // All failed
    return {
        text: '',
        source: 'local',
        success: false,
    };
}

// ============ Specialized Functions ============

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
        Provide a detailed dictionary entry for the English word "${word}".
        ${contextPart}
        
        IMPORTANT: Include multiple Russian translations if the word has different meanings.
        Prioritize the meaning that fits the context if provided.
        
        Output strictly JSON:
        {
            "translations": ["основной перевод", "альтернативный перевод", "ещё вариант"],
            "definitions": ["main English definition", "secondary definition if exists"],
            "partOfSpeech": "noun/verb/adjective/etc",
            "phonetic": "/phonetic transcription/",
            "examples": ["example sentence 1", "example sentence 2"],
            "cefrLevel": "A1/A2/B1/B2/C1/C2"
        }
    `;

    try {
        const response = await getAICompletion(prompt, { jsonMode: true });
        if (!response.success) return null;

        const jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Context translation error:', e);
        return null;
    }
}

export async function generateRussianSentence(
    level: 'A1-A2' | 'B1-B2' | 'C1-C2',
    topic?: string
): Promise<{ sentence: string; hint?: string } | null> {
    const topicPart = topic ? `Topic: ${topic}.` : 'Topic: everyday situations.';

    const levelGuide = {
        'A1-A2': 'Use simple vocabulary and short sentences. Present tense mostly. Basic grammar.',
        'B1-B2': 'Use varied vocabulary. Past and future tenses. Conditional sentences OK.',
        'C1-C2': 'Use sophisticated vocabulary, idioms, subjunctive mood, complex structures.',
    };

    const prompt = `
        Generate ONE Russian sentence for an English learner to translate.
        
        Level: ${level}
        ${topicPart}
        Guidelines: ${levelGuide[level]}
        
        Output strictly JSON:
        {
            "sentence": "Русское предложение для перевода",
            "hint": "optional grammar hint in Russian"
        }
    `;

    try {
        const response = await getAICompletion(prompt, { jsonMode: true });
        if (!response.success) return null;

        const jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Sentence generation error:', e);
        return null;
    }
}

export async function calculateTranslationAccuracy(
    russianOriginal: string,
    userEnglish: string,
    correctEnglish: string
): Promise<{
    accuracy: number;
    feedback: string;
    errors: string[];
}> {
    // First, calculate word-based metrics locally
    const userWords = userEnglish.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const correctWords = correctEnglish.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const matchedWords = userWords.filter(w => correctWords.includes(w));
    const wordMatchRatio = correctWords.length > 0
        ? matchedWords.length / correctWords.length
        : 0;

    const lengthRatio = Math.min(userWords.length, correctWords.length) /
        Math.max(userWords.length, correctWords.length, 1);

    // Get AI semantic analysis
    const prompt = `
        Russian: "${russianOriginal}"
        User's English: "${userEnglish}"
        Expected English: "${correctEnglish}"
        
        Evaluate the translation semantically (0.0 to 1.0 where 1.0 is perfect).
        List specific errors in Russian.
        
        Output strictly JSON:
        {
            "semanticScore": 0.85,
            "feedback": "Краткая обратная связь на русском",
            "errors": ["ошибка 1", "ошибка 2"]
        }
    `;

    try {
        const response = await getAICompletion(prompt, { jsonMode: true });
        let semanticScore = 0.5;
        let feedback = 'Не удалось оценить';
        let errors: string[] = [];

        if (response.success) {
            const jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);
            semanticScore = data.semanticScore || 0.5;
            feedback = data.feedback || 'Хорошо';
            errors = data.errors || [];
        }

        // Combined formula: 40% word match + 20% length + 40% AI semantic
        const accuracy = Math.round(
            (wordMatchRatio * 0.4 + lengthRatio * 0.2 + semanticScore * 0.4) * 100
        );

        return { accuracy: Math.min(100, accuracy), feedback, errors };
    } catch (e) {
        // Fallback to local calculation only
        const accuracy = Math.round((wordMatchRatio * 0.6 + lengthRatio * 0.4) * 100);
        return {
            accuracy: Math.min(100, accuracy),
            feedback: accuracy >= 70 ? 'Хорошо!' : 'Попробуй ещё раз',
            errors: []
        };
    }
}
