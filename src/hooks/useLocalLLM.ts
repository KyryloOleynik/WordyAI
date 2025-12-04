import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { classifyWordDifficulty } from '../lib/nlp/frequencyAdapter';

// Conditional imports - only load what's needed for each platform
const isNativePlatform = Platform.OS !== 'web';

// Web-only import
let CreateMLCEngine: any;
let MLCEngine: any;
if (!isNativePlatform) {
    const webLlm = require('@mlc-ai/web-llm');
    CreateMLCEngine = webLlm.CreateMLCEngine;
}

// Native-only import
let nativeLlama: any;
if (isNativePlatform) {
    nativeLlama = require('../lib/native/llamaAdapter').nativeLlama;
}

type InitProgressCallback = (report: { progress: number; text: string }) => void;

// Model ID for Gemma 2 2B Instruct (Quantized) - Web
const WEB_MODEL_ID = "gemma-2-2b-it-q4f32_1-MLC";

interface GenerationResult {
    text: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
    };
}

export interface DownloadProgress {
    progress: number;
    text: string;
}

export const useLocalLLM = () => {
    const [isReady, setIsReady] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

    const webEngineRef = useRef<any>(null);
    const isNative = Platform.OS !== 'web';

    useEffect(() => {
        const initEngine = async () => {
            try {
                if (isNative) {
                    console.log('Initializing Native Llama...');
                    setDownloadProgress({ progress: 0, text: 'Checking model...' });

                    // Check and download if needed
                    const exists = await nativeLlama.checkModelExists();
                    if (!exists) {
                        setDownloadProgress({ progress: 0, text: 'Downloading Gemma 2 2B (Native)...' });
                        await nativeLlama.downloadModel((progress: number) => {
                            setDownloadProgress({ progress, text: 'Downloading Gemma 2 2B (Native)...' });
                        });
                    }

                    setDownloadProgress({ progress: 1, text: 'Loading model into memory...' });
                    await nativeLlama.initialize();
                    setIsReady(true);
                    setDownloadProgress(null);
                    console.log('Native Llama loaded.');
                } else {
                    console.log('Initializing WebLLM with Gemma 2 2B...');
                    const initProgressCallback: InitProgressCallback = (report) => {
                        console.log('Init progress:', report);
                        setDownloadProgress({
                            progress: report.progress,
                            text: report.text
                        });
                    };

                    const engine = await CreateMLCEngine(
                        WEB_MODEL_ID,
                        { initProgressCallback }
                    );

                    webEngineRef.current = engine;
                    setIsReady(true);
                    setDownloadProgress(null);
                    console.log('Web Gemma 2 2B loaded.');
                }
            } catch (err: any) {
                console.error('Failed to load model:', err);
                setError(`Failed to load model: ${err.message || 'Unknown error'}`);
                setDownloadProgress(null);
            }
        };

        initEngine();

        return () => {
            if (isNative) {
                nativeLlama.release();
            }
        };
    }, []);

    // Helper to get completion from either engine
    const getCompletion = async (prompt: string, jsonMode: boolean = false): Promise<string> => {
        if (isNative) {
            // Native Llama
            return await nativeLlama.completion(prompt);
        } else {
            // Web LLM
            if (!webEngineRef.current) throw new Error('Web Engine not ready');
            const response = await webEngineRef.current.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                response_format: jsonMode ? { type: "json_object" } : undefined
            });
            return response.choices[0].message.content || '';
        }
    };

    // --- LinguaFlow Pipeline Steps ---

    // Step 1: Hybrid Classification
    const classifyWord = async (word: string) => {
        // Step A: Pre-filter (JS Adapter)
        const difficulty = classifyWordDifficulty(word);

        if (difficulty === 'A1-A2' || difficulty === 'C1-C2') {
            return { level: difficulty, source: 'heuristic' };
        }

        // Step B: Gemma 2 Refinement for intermediate words
        if (!isReady) return { level: 'B1-B2', source: 'fallback' };

        const prompt = `
            You are a language expert. Classify the word "${word}" into a CEFR level (A1-C2). 
            Focus on how it is used in modern conversation vs formal writing. 
            Output strictly JSON in this format: {"level": "B1", "reason": "..."}
        `;

        try {
            const content = await getCompletion(prompt, true);
            // Clean up potential markdown code blocks if native model adds them
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Classification error:', e);
            return { level: 'B1', source: 'error' };
        }
    };

    // Step 2: Content Generation (Flashcards & Storytelling)
    const generateContent = async (word: string) => {
        if (!isReady) return null;

        const prompt = `
            Task: Create learning content for the word "${word}".
            
            1. Flashcard: Define it simply. Create a natural example sentence (like from a movie/dialogue) with the word "${word}" replaced by "___".
            2. Story: Write a very short, engaging flash fiction (2-3 sentences) containing the word.
            
            Make the examples sound natural and conversational, not robotic.
            
            Output strictly JSON:
            {
                "definition": "...",
                "example_sentence": "...",
                "missing_word": "${word}",
                "story": "..."
            }
        `;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Content generation error:', e);
            return null;
        }
    };

    // Step 3: Active Listening (Interactive Mode)
    const startInteractiveSession = async (context: string) => {
        if (!isReady) return null;
        return `Let's discuss this story: "${context}". I'll stop every few sentences to ask you a question. Ready?`;
    };

    // Step 4: Grammar Validator
    const validateGrammar = async (userResponse: string, targetWord: string) => {
        if (!isReady) return null;

        const prompt = `
            Analyze this learner's sentence: '${userResponse}'.
            Target word was: "${targetWord}".
            
            1. Is the grammar correct? If not, fix it.
            2. Did the sentence sound natural?
            3. Was the target word used correctly in context?
            
            Provide a friendly, encouraging explanation.
        `;

        try {
            return await getCompletion(prompt);
        } catch (e) {
            console.error('Validation error:', e);
            return null;
        }
    };

    const generateSentence = async (word: string, context?: string): Promise<string | null> => {
        if (!isReady) {
            setError('Model not ready');
            return null;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const prompt = `
                Generate a simple B1-level sentence using the word "${word}". 
                ${context ? `Context: The word appeared in a video about "${context}".` : ''}
                Output only the sentence.
            `;

            return await getCompletion(prompt);
        } catch (err: any) {
            setError('Generation failed: ' + err.message);
            return null;
        } finally {
            setIsGenerating(false);
        }
    };

    // ============== NEW FEATURES ==============

    // Chat Mode: Conversation with error correction
    interface ChatMessage {
        role: 'user' | 'assistant';
        content: string;
    }

    const chatWithCorrection = async (
        userMessage: string,
        history: ChatMessage[],
        topic: string
    ): Promise<{ response: string; corrections: string | null }> => {
        if (!isReady) {
            return { response: 'Model not ready', corrections: null };
        }

        const historyText = history
            .slice(-6) // Keep last 6 messages for context
            .map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.content}`)
            .join('\n');

        const prompt = `
            You are a friendly English teacher having a conversation about "${topic}".
            Your student just wrote: "${userMessage}"
            
            Previous conversation:
            ${historyText}
            
            IMPORTANT: 
            1. First, check if the student's message has any grammar, spelling, or natural usage errors.
            2. If there are errors, provide corrections with brief explanations.
            3. Then continue the conversation naturally, asking a follow-up question.
            
            Output strictly JSON:
            {
                "hasErrors": true/false,
                "corrections": "Your corrections with explanations (or null if no errors)",
                "response": "Your conversational response continuing the topic"
            }
        `;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);
            return {
                response: data.response,
                corrections: data.hasErrors ? data.corrections : null,
            };
        } catch (e) {
            console.error('Chat error:', e);
            return {
                response: "I'm sorry, I had trouble understanding. Could you try again?",
                corrections: null,
            };
        }
    };

    // Story Mode: Generate story with comprehension questions
    interface StoryWithQuestions {
        story: string;
        title: string;
        questions: {
            question: string;
            correctAnswer: string;
            options?: string[];
        }[];
    }

    const generateStoryWithQuestions = async (
        topic: string,
        level: 'A1-A2' | 'B1-B2' | 'C1-C2'
    ): Promise<StoryWithQuestions | null> => {
        if (!isReady) return null;

        const levelGuide = {
            'A1-A2': 'Use simple vocabulary and short sentences. Present tense mostly.',
            'B1-B2': 'Use varied vocabulary and sentence structures. Past and present tenses.',
            'C1-C2': 'Use sophisticated vocabulary, idioms, and complex sentences.',
        };

        const prompt = `
            Create a short engaging story for English learners.
            
            Topic: ${topic}
            Language Level: ${level}
            Guidelines: ${levelGuide[level]}
            
            The story should be 4-6 sentences long.
            Create 3 comprehension questions about the story.
            
            Output strictly JSON:
            {
                "title": "Story Title",
                "story": "The complete story text...",
                "questions": [
                    {
                        "question": "Question about the story?",
                        "correctAnswer": "The correct answer",
                        "options": ["option1", "option2", "option3", "option4"]
                    }
                ]
            }
        `;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Story generation error:', e);
            return null;
        }
    };

    // Check answer to story question
    const checkStoryAnswer = async (
        question: string,
        userAnswer: string,
        correctAnswer: string,
        storyContext: string
    ): Promise<{ isCorrect: boolean; feedback: string }> => {
        if (!isReady) {
            return { isCorrect: false, feedback: 'Model not ready' };
        }

        const prompt = `
            Story context: "${storyContext}"
            Question: "${question}"
            Expected answer: "${correctAnswer}"
            Student's answer: "${userAnswer}"
            
            Evaluate if the student's answer is correct or acceptable.
            Consider that the answer doesn't need to be word-for-word, just semantically correct.
            
            Output strictly JSON:
            {
                "isCorrect": true/false,
                "feedback": "Brief encouraging feedback explaining if correct or why not"
            }
        `;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            return { isCorrect: false, feedback: 'Could not evaluate answer' };
        }
    };

    // Translation Mode: Generate sentence and check translation
    interface TranslationExercise {
        originalSentence: string;
        targetLanguage: string;
        difficulty: string;
        hints?: string[];
    }

    const generateTranslationExercise = async (
        level: 'A1-A2' | 'B1-B2' | 'C1-C2',
        topic?: string
    ): Promise<TranslationExercise | null> => {
        if (!isReady) return null;

        const prompt = `
            Generate an English sentence for translation practice.
            
            Level: ${level}
            ${topic ? `Topic: ${topic}` : 'Topic: everyday situations'}
            
            Output strictly JSON:
            {
                "originalSentence": "The English sentence to translate",
                "difficulty": "${level}",
                "hints": ["grammar hint", "vocabulary hint"]
            }
        `;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);
            return {
                ...data,
                targetLanguage: 'Russian',
            };
        } catch (e) {
            console.error('Translation exercise error:', e);
            return null;
        }
    };

    const checkTranslation = async (
        originalSentence: string,
        userTranslation: string
    ): Promise<{
        isCorrect: boolean;
        accuracy: number;
        feedback: string;
        suggestedTranslation: string;
        grammarRules: string[];
    }> => {
        if (!isReady) {
            return {
                isCorrect: false,
                accuracy: 0,
                feedback: 'Model not ready',
                suggestedTranslation: '',
                grammarRules: [],
            };
        }

        const prompt = `
            Original English sentence: "${originalSentence}"
            Student's Russian translation: "${userTranslation}"
            
            Evaluate the translation:
            1. Is it correct or acceptable?
            2. Rate accuracy from 0-100%
            3. Provide detailed feedback
            4. Give a suggested correct translation
            5. List any grammar rules the student should know
            
            Output strictly JSON:
            {
                "isCorrect": true/false,
                "accuracy": 85,
                "feedback": "Detailed feedback explaining what's good and what needs improvement",
                "suggestedTranslation": "Правильный перевод предложения",
                "grammarRules": ["Rule 1: explanation", "Rule 2: explanation"]
            }
        `;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Translation check error:', e);
            return {
                isCorrect: false,
                accuracy: 0,
                feedback: 'Could not evaluate translation',
                suggestedTranslation: '',
                grammarRules: [],
            };
        }
    };

    // Dictionary lookup using LLM - with Russian translation
    const lookupWord = async (word: string): Promise<{
        definition: string;
        translation: string;
        phonetic: string;
        partOfSpeech: string;
        examples: string[];
        synonyms: string[];
        cefrLevel: string;
    } | null> => {
        if (!isReady) return null;

        const prompt = `
            Provide a dictionary entry for the English word "${word}".
            Include a Russian translation.
            
            Output strictly JSON:
            {
                "phonetic": "/phonetic transcription/",
                "definition": "clear, concise definition in English",
                "translation": "перевод на русский язык",
                "partOfSpeech": "noun/verb/adjective/etc",
                "examples": ["example sentence 1", "example sentence 2"],
                "synonyms": ["synonym1", "synonym2", "synonym3"],
                "cefrLevel": "A1/A2/B1/B2/C1/C2"
            }
        `;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Dictionary lookup error:', e);
            return null;
        }
    };

    // Translate from Russian to English
    const translateRussianToEnglish = async (russianText: string): Promise<{
        translation: string;
        isCorrect: boolean;
        feedback: string;
    } | null> => {
        if (!isReady) return null;

        const prompt = `
            Translate this Russian text to English: "${russianText}"
            
            Output strictly JSON:
            {
                "translation": "English translation",
                "alternatives": ["alternative translation 1", "alternative translation 2"]
            }
        `;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);
            return {
                translation: data.translation,
                isCorrect: true,
                feedback: data.alternatives ? `Альтернативы: ${data.alternatives.join(', ')}` : '',
            };
        } catch (e) {
            console.error('Translation error:', e);
            return null;
        }
    };

    // Check English translation from Russian
    const checkEnglishTranslation = async (
        russianSentence: string,
        userEnglish: string
    ): Promise<{
        isCorrect: boolean;
        accuracy: number;
        feedback: string;
        suggestedTranslation: string;
        errors: string[];
    }> => {
        if (!isReady) {
            return {
                isCorrect: false,
                accuracy: 0,
                feedback: 'Model not ready',
                suggestedTranslation: '',
                errors: [],
            };
        }

        const prompt = `
            Russian sentence: "${russianSentence}"
            Student's English translation: "${userEnglish}"
            
            Evaluate the translation:
            1. Is it grammatically correct and conveys the meaning?
            2. Rate accuracy from 0-100%
            3. List specific errors if any
            
            Output strictly JSON:
            {
                "isCorrect": true/false,
                "accuracy": 85,
                "feedback": "Detailed feedback in Russian for the student",
                "suggestedTranslation": "Correct English translation",
                "errors": ["error 1 explanation in Russian", "error 2"]
            }
        `;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Translation check error:', e);
            return {
                isCorrect: false,
                accuracy: 0,
                feedback: 'Не удалось проверить перевод',
                suggestedTranslation: '',
                errors: [],
            };
        }
    };

    return {
        isReady,
        isGenerating,
        error,
        downloadProgress,
        generateSentence,
        classifyWord,
        generateContent,
        startInteractiveSession,
        validateGrammar,
        // New features
        chatWithCorrection,
        generateStoryWithQuestions,
        checkStoryAnswer,
        generateTranslationExercise,
        checkTranslation,
        lookupWord,
        translateRussianToEnglish,
        checkEnglishTranslation,
        getCompletion,
    };
};

