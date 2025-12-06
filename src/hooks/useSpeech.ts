import { useState, useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';

export const useSpeech = () => {
    const [isSpeaking, setIsSpeaking] = useState(false);

    const stop = useCallback(async () => {
        try {
            await Speech.stop();
        } catch (error) {
            console.error('Error stopping speech:', error);
        } finally {
            setIsSpeaking(false);
        }
    }, []);

    const speak = useCallback(async (text: string, language: string = 'en-US', rate: number = 0.8) => {
        try {
            if (isSpeaking) {
                await stop();
            }

            setIsSpeaking(true);
            Speech.speak(text, {
                language,
                rate,
                onDone: () => setIsSpeaking(false),
                onError: (error) => {
                    console.error('Speech error:', error);
                    setIsSpeaking(false);
                },
                onStopped: () => setIsSpeaking(false),
            });
        } catch (error) {
            console.error('Error starting speech:', error);
            setIsSpeaking(false);
        }
    }, [isSpeaking, stop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            Speech.stop();
        };
    }, []);

    return {
        speak,
        stop,
        isSpeaking
    };
};
