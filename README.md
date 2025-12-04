# WordyAI

AI-powered language learning app for Russian speakers learning English.

## About

WordyAI is a language learning application that uses on-device AI to provide personalized learning experiences. The app runs Gemma 2 2B locally, so most features work without an internet connection.

The main focus is on vocabulary building through various interactive modes, with automatic word difficulty classification and spaced repetition for optimal retention.

## Features

### Learning Modes

- **Chat Mode** - Practice conversations with an AI teacher that corrects grammar and spelling mistakes in real-time
- **Story Mode** - Read AI-generated stories with comprehension questions matched to your CEFR level
- **Translation Mode** - Translate Russian sentences to English and get detailed feedback
- **Matching Mode** - Connect English words with their translations or definitions
- **Practice Mode** - Flashcard-based review with spaced repetition scheduling

### Core Functionality

- Automatic CEFR level classification for every word (A1 to C2)
- Personal dictionary built from YouTube videos, stories, or manual input
- Words you get wrong are automatically added for extra practice
- XP system, daily streaks, and level progression for motivation

## Tech Stack

### Frontend

- React Native
- Expo SDK 54
- TypeScript
- React Navigation 7

### AI and NLP

- Gemma 2 2B (on-device LLM)
- @mlc-ai/web-llm for web inference
- llama.rn for native mobile inference
- Datamuse API for word frequency data

### Data and Storage

- AsyncStorage for persistent local storage
- WatermelonDB for local database
- SM-2 algorithm for spaced repetition

### External APIs

- Free Dictionary API for definitions
- MyMemory API for translations
- Expo Speech for pronunciation

## Installation

Requirements:
- Node.js 18 or higher
- npm or yarn
- Expo CLI

```bash
git clone https://github.com/yourusername/wordyai.git
cd wordyai
npm install
npx expo start
```

### Running on Different Platforms

```bash
# Web
npx expo start --web

# Android
npx expo run:android

# iOS (macOS only)
npx expo run:ios
```

## Building for Production

### Web

```bash
npx expo export --platform web
```

This creates a `dist` folder that can be deployed to any static hosting.

### Mobile

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

## Project Structure

```
src/
  components/ui/     Reusable UI components
  screens/           App screens
  services/          Business logic and API integrations
  lib/design/        Design system tokens
  lib/nlp/           NLP utilities
  navigation/        React Navigation setup
```

## Configuration

Optional environment variables:

```
GOOGLE_AI_API_KEY=your_gemini_api_key
```

## License

MIT
