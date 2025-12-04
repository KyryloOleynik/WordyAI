// src/features/ingestion/youtubeService.ts
import { getSubtitles } from 'youtube-caption-extractor';

export interface Subtitle {
    text: string;
    start: number;
    dur: number;
}

export interface YouTubeVideoInfo {
    videoId: string;
    subtitles: Subtitle[];
    fullText: string;
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Fetch subtitles from YouTube video
 */
export async function fetchYouTubeSubtitles(url: string, lang = 'en'): Promise<YouTubeVideoInfo> {
    const videoId = extractVideoId(url);

    if (!videoId) {
        throw new Error('Invalid YouTube URL');
    }

    try {
        // Fetch subtitles using youtube-caption-extractor
        const subtitles = await getSubtitles({ videoID: videoId, lang }) as any[];

        if (!subtitles || subtitles.length === 0) {
            throw new Error('No subtitles available for this video');
        }

        // Combine all subtitle text
        const fullText = subtitles.map((sub: any) => sub.text).join(' ');
        const typedSubtitles = subtitles as Subtitle[];

        return {
            videoId,
            subtitles: typedSubtitles,
            fullText,
        };
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch subtitles: ${error.message}`);
        }
        throw new Error('Failed to fetch subtitles');
    }
}

/**
 * Find the context (sentence) where a word appears in subtitles
 */
export function findWordContext(
    word: string,
    subtitles: Subtitle[]
): Array<{ sentence: string; timestamp: number }> {
    const contexts: Array<{ sentence: string; timestamp: number }> = [];
    const wordLower = word.toLowerCase();

    for (const subtitle of subtitles) {
        if (subtitle.text.toLowerCase().includes(wordLower)) {
            contexts.push({
                sentence: subtitle.text,
                timestamp: subtitle.start,
            });
        }
    }

    return contexts;
}
