# Animal Adventures 🦁

An educational React Native app for learning about animals, built with Expo and modern React Native practices.

## 🚀 Features

- Interactive animal learning experience
- Beautiful animations with Lottie
- Multi-language support (English & Spanish)
- Sound effects and voice guidance
- Responsive design for all devices
- Offline-first approach

## 📱 Platforms

- iOS (iPhone & iPad)
- Android
- Web (responsive)

## 🛠 Tech Stack

- **Framework**: React Native 0.81.0
- **Expo**: SDK 57
- **Navigation**: React Navigation 7
- **State Management**: React Hooks
- **Styling**: Styled Components 6
- **Animations**: Lottie React Native 7
- **Audio**: Expo AV
- **Type Safety**: TypeScript (optional)

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm start
```

### 3. Run on Device/Simulator

```bash
# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

## 📁 Project Structure

```
AnimalAdventures/
├── assets/                 # Static assets
│   ├── animations/        # Lottie animation files
│   ├── backgrounds/       # Background images
│   ├── sounds/           # Audio files
│   └── voices/           # Voice recordings
├── components/            # Reusable components
│   ├── animals/          # Animal-related components
│   ├── home/             # Home screen components
│   ├── side_menu/        # Navigation components
│   └── utility/          # Utility components
├── android/               # Android-specific code
├── ios/                   # iOS-specific code
├── App.jsx                # Main app component
├── index.js              # Entry point
└── package.json          # Dependencies and scripts
```

## 🧹 Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS device/simulator
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking
- `npm run clean` - Clear Expo cache
- `npm run build:android` - Build Android APK
- `npm run build:ios` - Build iOS app

## 🔧 Configuration Files

- `eslint.config.js` - ESLint configuration (flat config)
- `.prettierrc` - Prettier formatting rules
- `tsconfig.json` - TypeScript configuration
- `babel.config.js` - Babel configuration
- `metro.config.js` - Metro bundler configuration
- `app.json` - Expo app configuration

## 📱 Building for Production

### Android

```bash
npm run build:android
```

### iOS

```bash
npm run build:ios
```

## 🚀 Deployment

### Submit to App Stores

```bash
# Android
npm run submit:android

# iOS
npm run submit:ios
```

### Version bump + EAS build (Android)

```bash
# Patch bump versionCode and versionName, then run production build
npm run production-build-eas:android

# Other bump options (no build):
npm run bump:patch      # 1.2.3 -> 1.2.4
npm run bump:minor      # 1.2.3 -> 1.3.0
npm run bump:major      # 1.2.3 -> 2.0.0
npm run bump:set -- 4.2.0   # set exact version (keeps code auto +1)
npm run bump:dry-run    # show planned changes only
```

Notes:
- The bump script updates `package.json`, `app.json` (`expo.version`, `ios.buildNumber`, `android.versionCode`), and `android/app/build.gradle` (`versionName`, `versionCode`).
- `android.versionCode` is incremented by +1 unless overridden via `--code N` when running the script directly.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and formatting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please contact the development team.

---

**Built with ❤️ by EliLearn Apps**
