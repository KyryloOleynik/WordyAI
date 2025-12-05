/**
 * Native Llama Adapter - DISABLED
 * Local LLM functionality is disabled.
 */

export interface NativeLlamaState {
    isReady: boolean;
    progress: number;
    error: string | null;
}

// Stub implementation
class NativeLlamaAdapterStub {
    async checkModelExists(): Promise<boolean> {
        return false;
    }

    async downloadModel(_onProgress: (progress: number) => void): Promise<void> {
        throw new Error('Local LLM is disabled');
    }

    async initialize(): Promise<void> {
        throw new Error('Local LLM is disabled');
    }

    async completion(_prompt: string): Promise<string> {
        throw new Error('Local LLM is disabled');
    }

    async release() {
        // Do nothing
    }
}

export const nativeLlama = new NativeLlamaAdapterStub();
