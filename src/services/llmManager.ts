/**
 * Local LLM Manager - DISABLED
 * All local LLM functionality is disabled. Using external APIs only.
 */

// Stub implementation - all methods return false/null to indicate local LLM is unavailable
class LLMManagerStub {
    private static instance: LLMManagerStub;

    private constructor() { }

    static getInstance(): LLMManagerStub {
        if (!LLMManagerStub.instance) {
            LLMManagerStub.instance = new LLMManagerStub();
        }
        return LLMManagerStub.instance;
    }

    // Always return false - local LLM is disabled
    get ready(): boolean {
        return false;
    }

    get initializing(): boolean {
        return false;
    }

    onProgress(_callback: (progress: number, text: string) => void) {
        return () => { };
    }

    async initialize(): Promise<void> {
        console.log('LLMManager: Local LLM is disabled');
        // Do nothing - local LLM is disabled
    }

    async complete(_prompt: string, _jsonMode = false): Promise<string> {
        throw new Error('Local LLM is disabled');
    }

    async *completeStream(_prompt: string): AsyncGenerator<string> {
        throw new Error('Local LLM is disabled');
    }

    async *chatStream(
        _messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    ): AsyncGenerator<string> {
        throw new Error('Local LLM is disabled');
    }

    release() {
        // Do nothing
    }
}

export const llmManager = LLMManagerStub.getInstance();

// Stub for classifyWord - returns fallback
export async function classifyWord(_word: string) {
    return { level: 'B1-B2', source: 'fallback' };
}
