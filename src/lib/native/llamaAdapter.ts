import { initLlama, LlamaContext } from 'llama.rn';
import { getInfoAsync, createDownloadResumable, documentDirectory } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// URL for Gemma 2 2B Instruct GGUF (Quantized)
// Using a reliable HuggingFace URL for the GGUF model
const MODEL_URL = 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf?download=true';
const MODEL_FILENAME = 'gemma-2-2b-it-Q4_K_M.gguf';

export interface NativeLlamaState {
    isReady: boolean;
    progress: number;
    error: string | null;
}

class NativeLlamaAdapter {
    private context: LlamaContext | null = null;
    private modelPath: string = `${documentDirectory}${MODEL_FILENAME}`;

    async checkModelExists(): Promise<boolean> {
        const info = await getInfoAsync(this.modelPath);
        return info.exists;
    }

    async downloadModel(onProgress: (progress: number) => void): Promise<void> {
        if (await this.checkModelExists()) {
            onProgress(1);
            return;
        }

        const downloadResumable = createDownloadResumable(
            MODEL_URL,
            this.modelPath,
            {},
            (downloadProgress) => {
                const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                onProgress(progress);
            }
        );

        try {
            await downloadResumable.downloadAsync();
        } catch (e) {
            console.error('Download failed:', e);
            throw e;
        }
    }

    async initialize(): Promise<void> {
        if (!await this.checkModelExists()) {
            throw new Error('Model file not found. Download it first.');
        }

        this.context = await initLlama({
            model: this.modelPath,
            use_mlock: true,
            n_ctx: 2048,
            n_gpu_layers: Platform.OS === 'ios' ? 99 : 0, // Metal on iOS, CPU/OpenCL on Android (unless configured)
        });
    }

    async completion(prompt: string): Promise<string> {
        if (!this.context) throw new Error('Context not initialized');

        const result = await this.context.completion({
            prompt,
            n_predict: 256,
            temperature: 0.7,
            top_k: 40,
            top_p: 0.9,
        });

        return result.text;
    }

    async release() {
        if (this.context) {
            await this.context.release();
            this.context = null;
        }
    }
}

export const nativeLlama = new NativeLlamaAdapter();
