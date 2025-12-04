import { StyleSheet, Text, View, Pressable, Animated } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '@/lib/design/theme';
import { updateSettings } from '@/services/storageService';

export default function OnboardingScreen() {
    const navigation = useNavigation<any>();
    const [step, setStep] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const slides = [
        {
            emoji: '🚀',
            title: 'Welcome to WordyAI',
            subtitle: 'Your AI-powered English learning companion',
        },
        {
            emoji: '📚',
            title: 'Build Your Dictionary',
            subtitle: 'Learn words from YouTube, stories, or add them manually',
        },
        {
            emoji: '🎯',
            title: 'Smart Practice',
            subtitle: 'AI creates personalized exercises based on what you need to learn',
        },
        {
            emoji: '🏆',
            title: 'Level Up',
            subtitle: 'Earn XP, maintain streaks, and track your progress',
        },
    ];

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, [step]);

    const completeOnboarding = async () => {
        // Save that user has seen onboarding
        await updateSettings({ hasSeenOnboarding: true });
        navigation.replace('Home');
    };

    const handleNext = () => {
        if (step < slides.length - 1) {
            fadeAnim.setValue(0);
            slideAnim.setValue(30);
            setStep(step + 1);
        } else {
            completeOnboarding();
        }
    };

    const handleSkip = () => {
        completeOnboarding();
    };

    const currentSlide = slides[step];

    return (
        <View style={styles.container}>
            {/* Skip Button */}
            {step < slides.length - 1 && (
                <Pressable style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipText}>Skip</Text>
                </Pressable>
            )}

            {/* Content */}
            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    }
                ]}
            >
                <Text style={styles.emoji}>{currentSlide.emoji}</Text>
                <Text style={styles.title}>{currentSlide.title}</Text>
                <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
            </Animated.View>

            {/* Progress Dots */}
            <View style={styles.dotsContainer}>
                {slides.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            step === index && styles.dotActive,
                        ]}
                    />
                ))}
            </View>

            {/* Continue Button */}
            <Pressable style={styles.continueButton} onPress={handleNext}>
                <Text style={styles.continueText}>
                    {step === slides.length - 1 ? "Let's Start!" : 'Continue'}
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.xxxl,
    },
    skipButton: {
        alignSelf: 'flex-end',
        padding: spacing.sm,
    },
    skipText: {
        ...typography.body,
        color: colors.text.secondary,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emoji: {
        fontSize: 80,
        marginBottom: spacing.xxl,
    },
    title: {
        ...typography.h1,
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    subtitle: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
        lineHeight: 26,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xxl,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.border.medium,
    },
    dotActive: {
        width: 24,
        backgroundColor: colors.primary[300],
    },
    continueButton: {
        backgroundColor: colors.primary[300],
        borderRadius: borderRadius.xl,
        paddingVertical: spacing.lg,
        alignItems: 'center',
    },
    continueText: {
        ...typography.button,
        color: colors.text.inverse,
    },
});
