/**
 * useLocalLLM - React hook that wraps llmManager singleton
 * Model loads ONCE and stays in memory until app closes
 */
import { useState, useEffect } from 'react';
import { llmManager } from '@/services/llmManager';

export interface DownloadProgress {
    progress: number;
    text: string;
}

export const useLocalLLM = () => {
    const [isReady, setIsReady] = useState(llmManager.ready);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

    useEffect(() => {
        // Subscribe to llmManager progress
        const unsubscribe = llmManager.onProgress((progress, text) => {
            setDownloadProgress({ progress, text });
        });

        // If already ready, no need to init
        if (llmManager.ready) {
            setIsReady(true);
            return () => { unsubscribe(); };
        }

        // If already initializing, just wait
        if (llmManager.initializing) {
            // Will get progress updates
            return () => { unsubscribe(); };
        }

        // Start initialization
        llmManager.initialize()
            .then(() => {
                setIsReady(true);
                setDownloadProgress(null);
            })
            .catch((err) => {
                setError(err.message || 'Failed to load model');
                setDownloadProgress(null);
            });

        return () => unsubscribe();
        // NO release() on unmount - model stays in memory!
    }, []);

    // Update ready state when llmManager becomes ready
    useEffect(() => {
        if (llmManager.ready && !isReady) {
            setIsReady(true);
            setDownloadProgress(null);
        }
    }, [llmManager.ready]);

    // Helper to get completion
    const getCompletion = async (prompt: string, jsonMode = false): Promise<string> => {
        return llmManager.complete(prompt, jsonMode);
    };

    // Chat with correction
    const chatWithCorrection = async (
        userMessage: string,
        history: Array<{ role: 'user' | 'assistant'; content: string }>,
        topic: string
    ): Promise<{ response: string; corrections: string | null }> => {
        if (!isReady) {
            return { response: 'Model not ready', corrections: null };
        }

        const historyText = history
            .slice(-6)
            .map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.content}`)
            .join('\n');

        const prompt = `You are a friendly English teacher having a conversation about "${topic}".
Your student just wrote: "${userMessage}"

Previous conversation:
${historyText}

IMPORTANT: 
1. Check if the student's message has grammar, spelling, or usage errors.
2. If errors exist, provide corrections with brief explanations.
3. Continue the conversation naturally, asking a follow-up question.

Output strictly JSON:
{
    "hasErrors": true/false,
    "corrections": "Your corrections (or null if no errors)",
    "response": "Your conversational response"
}`;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);
            return {
                response: data.response,
                corrections: data.hasErrors ? data.corrections : null,
            };
        } catch {
            return {
                response: "I'm sorry, I had trouble understanding. Could you try again?",
                corrections: null,
            };
        }
    };

    // Story generation
    const generateStoryWithQuestions = async (
        topic: string,
        level: 'A1-A2' | 'B1-B2' | 'C1-C2'
    ) => {
        if (!isReady) return null;

        const levelGuide = {
            'A1-A2': 'Use simple vocabulary and short sentences. Present tense mostly.',
            'B1-B2': 'Use varied vocabulary and sentence structures. Past and present tenses.',
            'C1-C2': 'Use sophisticated vocabulary, idioms, and complex sentences.',
        };

        const prompt = `Create a short engaging story for English learners.
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
}`;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch {
            return null;
        }
    };

    // Check story answer
    const checkStoryAnswer = async (
        question: string,
        userAnswer: string,
        correctAnswer: string,
        storyContext: string
    ) => {
        if (!isReady) return { isCorrect: false, feedback: 'Model not ready' };

        const prompt = `Story context: "${storyContext}"
Question: "${question}"
Expected answer: "${correctAnswer}"
Student's answer: "${userAnswer}"

Evaluate if the student's answer is correct or acceptable.

Output strictly JSON:
{ "isCorrect": true/false, "feedback": "Brief encouraging feedback" }`;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch {
            return { isCorrect: false, feedback: 'Could not evaluate answer' };
        }
    };

    // Check English translation
    const checkEnglishTranslation = async (
        russianSentence: string,
        userEnglish: string
    ) => {
        if (!isReady) {
            return {
                isCorrect: false,
                accuracy: 0,
                feedback: 'Model not ready',
                suggestedTranslation: '',
                errors: [],
            };
        }

        const prompt = `Russian sentence: "${russianSentence}"
Student's English translation: "${userEnglish}"

Evaluate the translation:
1. Is it grammatically correct and conveys the meaning?
2. Rate accuracy from 0-100%
3. List specific errors if any

Output strictly JSON:
{
    "isCorrect": true/false,
    "accuracy": 85,
    "feedback": "Detailed feedback in Russian",
    "suggestedTranslation": "Correct English translation",
    "errors": ["error 1 in Russian", "error 2"]
}`;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch {
            return {
                isCorrect: false,
                accuracy: 0,
                feedback: 'Не удалось проверить перевод',
                suggestedTranslation: '',
                errors: [],
            };
        }
    };

    // Content generation for flashcards
    const generateContent = async (word: string) => {
        if (!isReady) return null;

        const prompt = `Create learning content for the word "${word}".

1. Flashcard: Define it simply. Create a natural example sentence with the word replaced by "___".
2. Story: Write a very short, engaging flash fiction (2-3 sentences) containing the word.

Make the examples sound natural and conversational.

Output strictly JSON:
{
    "definition": "...",
    "example_sentence": "...",
    "missing_word": "${word}",
    "story": "..."
}`;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch {
            return null;
        }
    };

    // Classify word level
    const classifyWord = async (word: string) => {
        if (!isReady) return { level: 'B1-B2', source: 'fallback' };

        const prompt = `Classify the word "${word}" into a CEFR level (A1-C2).
Output strictly JSON: {"level": "B1", "reason": "..."}`;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch {
            return { level: 'B1', source: 'error' };
        }
    };

    // Validate grammar
    const validateGrammar = async (userResponse: string, targetWord: string) => {
        if (!isReady) return null;

        const prompt = `Analyze this learner's sentence: '${userResponse}'.
Target word was: "${targetWord}".

1. Is the grammar correct? If not, fix it.
2. Did the sentence sound natural?
3. Was the target word used correctly?

Provide a friendly, encouraging explanation.`;

        try {
            return await getCompletion(prompt);
        } catch {
            return null;
        }
    };

    // Generate sentence for word
    const generateSentence = async (word: string, context?: string) => {
        if (!isReady) return null;
        setIsGenerating(true);

        try {
            const prompt = `Generate a simple B1-level sentence using the word "${word}".
${context ? `Context: The word appeared in a video about "${context}".` : ''}
Output only the sentence.`;

            return await getCompletion(prompt);
        } finally {
            setIsGenerating(false);
        }
    };

    // Dictionary lookup
    const lookupWord = async (word: string) => {
        if (!isReady) return null;

        const prompt = `Provide a dictionary entry for the English word "${word}".
Include a Russian translation.

Output strictly JSON:
{
    "phonetic": "/phonetic transcription/",
    "definition": "clear, concise definition in English",
    "translation": "перевод на русский язык",
    "partOfSpeech": "noun/verb/adjective/etc",
    "examples": ["example sentence 1", "example sentence 2"],
    "synonyms": ["synonym1", "synonym2"],
    "cefrLevel": "A1/A2/B1/B2/C1/C2"
}`;

        try {
            const content = await getCompletion(prompt, true);
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch {
            return null;
        }
    };

    return {
        isReady,
        isGenerating,
        error,
        downloadProgress,
        getCompletion,
        chatWithCorrection,
        generateStoryWithQuestions,
        checkStoryAnswer,
        checkEnglishTranslation,
        lookupWord,
        generateContent,
        classifyWord,
        validateGrammar,
        generateSentence,
        startInteractiveSession: async (context: string) => {
            if (!isReady) return null;
            return `Let's discuss this story: "${context}". Ready?`;
        },
    };
};
