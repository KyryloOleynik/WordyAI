import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import YouTubeIngestionScreen from '../screens/YouTubeIngestionScreen';
import MyDictionaryScreen from '../screens/MyDictionaryScreen';
import DictionaryScreen from '../screens/DictionaryScreen';
import ChatModeScreen from '../screens/ChatModeScreen';
import ChatHistoryScreen from '../screens/ChatHistoryScreen';
import StoryModeScreen from '../screens/StoryModeScreen';
import TranslationModeScreen from '../screens/TranslationModeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MatchingModeScreen from '../screens/MatchingModeScreen';
import LessonsScreen from '../screens/LessonsScreen';
import { colors, typography } from '@/lib/design/theme';
import { getSettings } from '@/services/storageService';

const Stack = createNativeStackNavigator();

const screenOptions = {
    headerStyle: {
        backgroundColor: colors.surface,
    },
    headerTintColor: colors.text.primary,
    headerTitleStyle: {
        ...typography.bodyBold,
    },
    contentStyle: {
        backgroundColor: colors.background,
    },
};

export default function AppNavigator() {
    const [isLoading, setIsLoading] = useState(true);
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

    useEffect(() => {
        checkOnboardingStatus();
    }, []);

    const checkOnboardingStatus = async () => {
        try {
            const settings = await getSettings();
            setHasSeenOnboarding(settings.hasSeenOnboarding);
        } catch (error) {
            console.error('Error checking onboarding status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary[300]} />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName={hasSeenOnboarding ? 'Home' : 'Onboarding'}
                screenOptions={screenOptions}
            >
                <Stack.Screen
                    name="Onboarding"
                    component={OnboardingScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{
                        title: 'WordyAI',
                        headerLargeTitle: true,
                    }}
                />
                <Stack.Screen
                    name="YouTubeIngestion"
                    component={YouTubeIngestionScreen}
                    options={{ title: 'Добавить контент' }}
                />
                <Stack.Screen
                    name="MyDictionary"
                    component={MyDictionaryScreen}
                    options={{ title: 'Мой словарь' }}
                />
                <Stack.Screen
                    name="Vocabulary"
                    component={MyDictionaryScreen}
                    options={{ title: 'Мой словарь' }}
                />
                <Stack.Screen
                    name="ChatHistory"
                    component={ChatHistoryScreen}
                    options={{ title: 'История чатов' }}
                />
                <Stack.Screen
                    name="Dictionary"
                    component={DictionaryScreen}
                    options={{ title: 'Поиск слова' }}
                />
                <Stack.Screen
                    name="ChatMode"
                    component={ChatModeScreen}
                    options={{ title: 'Чат' }}
                />
                <Stack.Screen
                    name="StoryMode"
                    component={StoryModeScreen}
                    options={{ title: 'Истории' }}
                />
                <Stack.Screen
                    name="TranslationMode"
                    component={TranslationModeScreen}
                    options={{ title: 'Перевод' }}
                />
                <Stack.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{ title: 'Настройки' }}
                />
                <Stack.Screen
                    name="MatchingMode"
                    component={MatchingModeScreen}
                    options={{ title: 'Соединение' }}
                />
                <Stack.Screen
                    name="Lessons"
                    component={LessonsScreen}
                    options={{ title: 'Уроки' }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
