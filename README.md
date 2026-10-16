# Animal Adventures

A free, ad-free, bilingual (English/Spanish) learning app that helps young children discover animals through five playful games — built with React Native and Expo.

📲 **[Download on Google Play](https://play.google.com/store/apps/details?id=com.elilearnapps.animaladventures)**

## Features

- 🔊 **Learn Animal Sounds & Names** — tap any animal to hear its name and the sound it makes
- 🐾 **Guess the Animal** — listen to a sound and pick the right animal across 8 levels
- 🔤 **Guess the First Letter** — match animals to the letter they start with, across 6 levels
- ✍️ **Trace the Letter** — trace each animal's first letter with a fingertip, across 6 levels
- 🧠 **Train Your Memory** — match animal pairs across 7 levels of increasing difficulty
- 📖 **Animal Album** — fills up with every animal a child meets along the way
- 🌎 Full English/Spanish support, switchable with one tap, including screen-reader support
- 👨‍👩‍👧 Parental controls: a reading-based parental gate, an optional daily play-time limit, and an age setting (under 4 / 4-6 / 7+) that adjusts difficulty
- 🚫 No ads, no in-app purchases, no data collection

## Tech stack

- [Expo](https://expo.dev) (React Native, prebuild/CNG workflow)
- [Lottie](https://airbnb.io/lottie/) for animal animations, `react-native-svg` for the letter-tracing canvas
- `expo-audio` / `expo-haptics` for sound and feedback
- `expo-updates` + EAS Update for over-the-air JS updates
- EAS Build for native Android/iOS builds

## Project structure

This is a single-app repo; the Expo project lives in [`AnimalAdventures/`](./AnimalAdventures).

```
AnimalAdventures/
├── components/   # Screens and UI (games, main menu, parents area, ...)
├── contexts/     # Settings and game-progress state (persisted to device storage)
├── constants/    # EN/ES strings and shared constants
├── utils/        # Audio, haptics, analytics, trace grading, etc.
└── assets/       # Images, Lottie animations, sounds, fonts
```

## Getting started

```bash
cd AnimalAdventures
npm install
npm start          # expo start --dev-client
npm run android     # or: npm run ios
```

## Building & releasing

- `npm run production-build-eas:android` — bumps the app version and builds a production Android binary via EAS Build
- `npm run build:ios` — EAS Build for iOS
- `npm run update:production -- "message"` — publishes an OTA JS update to production, no native build needed for JS-only changes
- [`EAS Build`](./.github/workflows/eas-build.yml) and [`EAS Update`](./.github/workflows/eas-update.yml) GitHub Actions workflows run the same from CI
- [`CI`](./.github/workflows/ci.yml) lints and does a Metro bundle sanity check on every push and pull request
