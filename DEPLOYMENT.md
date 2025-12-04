# Deployment Guide for WordyAI

This guide covers how to deploy WordyAI to production for Web, Android, and iOS.

## 1. Prerequisites

1.  **Expo Account**: Create an account at [expo.dev](https://expo.dev).
2.  **EAS CLI**: Install the Expo Application Services CLI:
    ```bash
    npm install -g eas-cli
    eas login
    ```

## 2. Web Deployment (Vercel / Netlify)

WordyAI uses Expo Router, which makes it easy to deploy as a static website.

### Step 1: Configure `app.json`
Ensure your `app.json` has the web configuration:
```json
{
  "expo": {
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    }
  }
}
```

### Step 2: Build for Web
Run the export command to generate static files in the `dist` directory:
```bash
npx expo export
```

### Step 3: Deploy
**Using Vercel:**
1.  Install Vercel CLI: `npm i -g vercel`
2.  Deploy:
    ```bash
    vercel
    ```
    (Select `dist` as the output directory if asked)

**Using Netlify:**
1.  Drag and drop the `dist` folder to Netlify Drop, or use Netlify CLI.

## 3. Mobile Deployment (Android & iOS)

We use **EAS Build** for native apps.

### Step 1: Configure EAS
Initialize EAS in your project:
```bash
eas build:configure
```
This creates an `eas.json` file.

### Step 2: Build for Android (APK / AAB)
*   **APK (for testing):**
    ```bash
    eas build -p android --profile preview
    ```
*   **AAB (for Google Play Store):**
    ```bash
    eas build -p android --profile production
    ```

### Step 3: Build for iOS (IPA)
*   *Note: Requires an Apple Developer Account ($99/year).*
*   **Simulator Build:**
    ```bash
    eas build -p ios --profile preview
    ```
*   **App Store Build:**
    ```bash
    eas build -p ios --profile production
    ```

## 4. Environment Variables

If you use API keys (e.g., for Google Gemini, Datamuse), ensure they are set in your build environment.

*   **Web**: Set them in Vercel/Netlify dashboard.
*   **Mobile**: Add them to `eas.json` or use `eas secret:create`.

## 5. Over-the-Air Updates (OTA)

You can update your app without re-submitting to stores using EAS Update:
```bash
eas update --branch production --message "Fixed bugs and improved UI"
```
