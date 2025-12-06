# WordyAI 

**Master English with AI-Powered Immersion**

> A next-generation language learning application for Russian speakers, combining advanced AI, volumetric design, and gamified practice to make learning English intuitive and engaging.

![App Banner Placeholder](https://via.placeholder.com/1200x500.png?text=WordyAI+Showcase)

## Why WordyAI?

WordyAI isn't just another flashcard app. It utilizes **Unified AI Technology** (integrating Google Gemini and Perplexity) to create a personalized tutor that understands context, corrects grammar, and facilitates immersive conversations.

Built with **React Native (Expo)** and the **Volumetric Design System**, it offers a premium, tactile user experience that feels alive.

## Key Features

### Intelligent Learning Modes
- **Chat Mode**: Have natural voice or text conversations with an AI tutor. Get real-time corrections on your grammar and spelling.
- **Story Mode**: Read AI-generated stories tailored to your proficiency level (A1-C2). Tap any word to translate instantly and answer comprehension questions.
- **Translation Mode**: Practice sentence construction. Translate Russian sentences to English and receive detailed feedback on your accuracy and style.
- **YouTube Ingestion**: Import your favorite YouTube videos. The app extracts subtitles, identifies new vocabulary, and creates personalized lessons.

### Gamification & Progress
- **Matching Game**: Race against the clock to match words with meanings or definitions.
- **XP & Streaks**: Earn experience points for every correct interaction. Keep your daily streak alive to build a learning habit.
- **Mastery System**: Track your progress for every single word. Words move from "New" to "Learning" to "Known" based on spaced repetition (SM-2 Algorithm).

### Volumetric Design System
- **Tactile UI**: Buttons and cards practically pop off the screen with 3D-inspired styling.
- **Dynamic Animations**: Smooth transitions, haptic feedback, and fluid gestures.
- **Adaptive Aesthetics**: Beautiful dark mode support with vibrant accent colors.

## Tech Stack

**Frontend:**
- **Framework**: React Native (Expo SDK 54)
- **Language**: TypeScript
- **State/Props**: React Hooks, Context API
- **Navigation**: React Navigation 7
- **Styling**: StyleSheet + Volumetric Design System

**AI & Backend Services:**
- **Unified AI Manager**: Abstraction layer integrating Google Gemini and Perplexity APIs.
- **Speech**: `expo-speech` for Text-to-Speech (TTS).
- **Database**: `expo-sqlite` for offline-first persistent storage.

**Tools:**
- **Build System**: EAS (Expo Application Services)
- **Code Quality**: ESLint, Prettier

## 📲 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/KyryloOleynik/WordyAI.git
    cd WordyAI
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the development server**
    ```bash
    npx expo start
    ```

4.  **Run on Device**
    - **Android**: Scan the QR code with Expo Go or run `npx expo run:android`
    - **iOS**: Scan the QR code with Expo Go or run `npx expo run:ios` (Mac only)

## Configuration

To unlock the full potential of AI features, add your API keys in the app settings:

- **Google Gemini API Key**: For chat, stories, and image analysis.
- **Perplexity API Key**: For enhanced context and alternative explanations.

> Note: The app includes a limited offline mode, but AI features require an internet connection and valid keys.

## Build for Android

To generate an APK for your Android device:

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
