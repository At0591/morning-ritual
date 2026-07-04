# Morning Ritual 🌅

> Start your day with intention.

Morning Ritual is an iOS and Android alarm app designed to help you build positive morning habits. Instead of just swiping to dismiss or solving math problems, Morning Ritual requires you to complete a small, value-adding task before the alarm stops. 

The tone is aspirational and intentional, never punitive. It's about waking up to a pleasant prompt that gets your day started right.

## Features

- **1000 Intentional Tasks:** Curated tasks across 4 core themes (Body, Mind, Brain, Creative).
- **Smart Verification:** A hybrid verification system requiring a quick photo or check-in to confirm you're awake and active.
- **Native Smart Alarm Integration:** Leverages native Android `AlarmManager` for precise scheduling that bypasses Doze and battery optimizations.
- **Habit Chains & Streaks:** Tracks your 7-day streaks with visual progress dots on your home screen.
- **Privacy First:** 100% local processing. No cloud syncing, no accounts required in v1.0. Everything lives securely in a local SQLite database.
- **Curated Sounds:** Wake up to pleasant, nature-inspired sounds instead of jarring sirens.

## Tech Stack

- **Framework:** React Native + Expo (TypeScript)
- **Database:** Local SQLite (`expo-sqlite`)
- **Native Integrations:** 
  - `expo-notifications` 
  - `expo-camera` 
  - `expo-av` 
  - Custom Native Android Module for Alarm Management

## Running Locally

Because this project uses custom native code for precise alarm scheduling, you cannot use the standard Expo Go app. You must build the project locally or via EAS.

### Prerequisites
- Node.js (v24)
- Android Studio / Android SDK (for local Android builds)

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/At0591/morning-ritual.git
   cd morning-ritual
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Prebuild the native Android project:
   ```bash
   npx expo prebuild --platform android
   ```
4. Build and run on a connected Android device or emulator:
   ```bash
   npx expo run:android
   ```

## Design Philosophy

The core philosophy of Morning Ritual is that your alarm should not hate you. Morning Ritual acts as a gentle, intentional guide to get you out of bed and into a productive, positive mindset without the harshness of a blaring horn or the annoyance of a barcode scanner puzzle.
