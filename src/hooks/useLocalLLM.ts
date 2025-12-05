/**
 * useLocalLLM - DISABLED
 * Local LLM functionality is disabled. This hook returns stubs only.
 */

export interface DownloadProgress {
    progress: number;
    text: string;
}

// Stub hook - always returns disabled state
export const useLocalLLM = () => {
    return {
        isReady: false,
        isGenerating: false,
        error: 'Local LLM is disabled',
        downloadProgress: null as DownloadProgress | null,

        getCompletion: async (_prompt: string, _jsonMode?: boolean): Promise<string> => {
            throw new Error('Local LLM is disabled');
        },

        chatWithCorrection: async (
            _userMessage: string,
            _history: Array<{ role: 'user' | 'assistant'; content: string }>,
            _topic: string
        ) => ({
            response: 'Local LLM is disabled',
            corrections: null,
        }),

        generateStoryWithQuestions: async (
            _topic: string,
            _level: 'A1-A2' | 'B1-B2' | 'C1-C2'
        ) => null,

        checkStoryAnswer: async (
            _question: string,
            _userAnswer: string,
            _correctAnswer: string,
            _storyContext: string
        ) => ({ isCorrect: false, feedback: 'Local LLM is disabled' }),

        checkEnglishTranslation: async (
            _russianSentence: string,
            _userEnglish: string
        ) => ({
            isCorrect: false,
            accuracy: 0,
            feedback: 'Local LLM is disabled',
            suggestedTranslation: '',
            errors: [],
        }),

        lookupWord: async (_word: string) => null,
        generateContent: async (_word: string) => null,
        classifyWord: async (_word: string) => ({ level: 'B1', source: 'fallback' }),
        validateGrammar: async (_userResponse: string, _targetWord: string) => null,
        generateSentence: async (_word: string, _context?: string) => null,
        startInteractiveSession: async (_context: string) => null,
    };
};
