/**
 * Singleton LLM Manager - keeps model in memory across the app lifecycle
 */
import { Platform } from 'react-native';
import { classifyWordDifficulty } from '../lib/nlp/frequencyAdapter';

const isNativePlatform = Platform.OS !== 'web';

// Lazy imports
let CreateMLCEngine: any;
let nativeLlama: any;

class LLMManager {
    private static instance: LLMManager;
    private webEngine: any = null;
    private isInitialized = false;
    private isInitializing = false;
    private initPromise: Promise<void> | null = null;
    private onProgressCallbacks: Set<(progress: number, text: string) => void> = new Set();

    private constructor() { }

    static getInstance(): LLMManager {
        if (!LLMManager.instance) {
            LLMManager.instance = new LLMManager();
        }
        return LLMManager.instance;
    }

    get ready(): boolean {
        return this.isInitialized;
    }

    get initializing(): boolean {
        return this.isInitializing;
    }

    onProgress(callback: (progress: number, text: string) => void) {
        this.onProgressCallbacks.add(callback);
        return () => this.onProgressCallbacks.delete(callback);
    }

    private notifyProgress(progress: number, text: string) {
        this.onProgressCallbacks.forEach(cb => cb(progress, text));
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;

        this.isInitializing = true;
        this.initPromise = this._doInitialize();

        try {
            await this.initPromise;
        } finally {
            this.isInitializing = false;
        }
    }

    private async _doInitialize(): Promise<void> {
        try {
            if (isNativePlatform) {
                // Native initialization
                if (!nativeLlama) {
                    nativeLlama = require('../lib/native/llamaAdapter').nativeLlama;
                }

                console.log('LLMManager: Initializing Native Llama...');
                this.notifyProgress(0, 'Проверка модели...');

                const exists = await nativeLlama.checkModelExists();
                if (!exists) {
                    this.notifyProgress(0, 'Загрузка Gemma 2 2B...');
                    await nativeLlama.downloadModel((progress: number) => {
                        this.notifyProgress(progress, 'Загрузка Gemma 2 2B...');
                    });
                }

                this.notifyProgress(0.9, 'Загрузка модели в память...');
                await nativeLlama.initialize();
                this.isInitialized = true;
                this.notifyProgress(1, 'Готово');
                console.log('LLMManager: Native Llama loaded.');
            } else {
                // Web initialization
                if (!CreateMLCEngine) {
                    const webLlm = require('@mlc-ai/web-llm');
                    CreateMLCEngine = webLlm.CreateMLCEngine;
                }

                console.log('LLMManager: Initializing WebLLM...');
                const WEB_MODEL_ID = "gemma-2-2b-it-q4f32_1-MLC";

                this.webEngine = await CreateMLCEngine(WEB_MODEL_ID, {
                    initProgressCallback: (report: { progress: number; text: string }) => {
                        this.notifyProgress(report.progress, report.text);
                    }
                });

                this.isInitialized = true;
                this.notifyProgress(1, 'Готово');
                console.log('LLMManager: WebLLM loaded.');
            }
        } catch (err: any) {
            console.error('LLMManager: Failed to load model:', err);
            throw err;
        }
    }

    async complete(prompt: string, jsonMode = false): Promise<string> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (isNativePlatform) {
            return await nativeLlama.completion(prompt);
        } else {
            if (!this.webEngine) throw new Error('Web Engine not ready');
            const response = await this.webEngine.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                response_format: jsonMode ? { type: "json_object" } : undefined
            });
            return response.choices[0].message.content || '';
        }
    }

    /**
     * Streaming completion - yields text chunks as they arrive
     */
    async *completeStream(prompt: string): AsyncGenerator<string> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (isNativePlatform) {
            // Native doesn't support streaming yet, return full response
            const result = await nativeLlama.completion(prompt);
            yield result;
        } else {
            if (!this.webEngine) throw new Error('Web Engine not ready');

            const stream = await this.webEngine.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                stream: true,
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    yield content;
                }
            }
        }
    }

    /**
     * Chat completion with streaming
     */
    async *chatStream(
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    ): AsyncGenerator<string> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (isNativePlatform) {
            // Build prompt from messages for native
            const prompt = messages
                .map(m => m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`)
                .join('\n') + '\nAssistant:';
            const result = await nativeLlama.completion(prompt);
            yield result;
        } else {
            if (!this.webEngine) throw new Error('Web Engine not ready');

            const stream = await this.webEngine.chat.completions.create({
                messages,
                stream: true,
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    yield content;
                }
            }
        }
    }

    release() {
        if (isNativePlatform && nativeLlama) {
            nativeLlama.release();
        }
        this.isInitialized = false;
        this.webEngine = null;
    }
}

// Export singleton
export const llmManager = LLMManager.getInstance();

// Helper functions
export async function classifyWord(word: string) {
    const difficulty = classifyWordDifficulty(word);
    if (difficulty === 'A1-A2' || difficulty === 'C1-C2') {
        return { level: difficulty, source: 'heuristic' };
    }

    if (!llmManager.ready) {
        return { level: 'B1-B2', source: 'fallback' };
    }

    const prompt = `Classify the word "${word}" into a CEFR level (A1-C2). Output JSON: {"level": "B1", "reason": "..."}`;

    try {
        const content = await llmManager.complete(prompt, true);
        const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        return { level: 'B1', source: 'error' };
    }
}
