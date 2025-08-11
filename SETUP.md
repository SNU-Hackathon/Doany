# Doany App Setup Guide

## Overview
Doany is a React Native mobile application built with Expo, designed to help users set goals, track progress through various verification methods, and calculate achievement rates.

## Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI: `npm install -g @expo/cli`
- Firebase project setup
- iOS/Android development environment (optional, for device testing)

## Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "doany-app" (or your preferred name)
3. Enable Google Analytics (optional)

### 2. Enable Authentication
1. In Firebase Console, go to "Authentication" > "Sign-in method"
2. Enable "Email/Password" authentication
3. Optionally enable Google sign-in for enhanced UX

### 3. Create Firestore Database
1. Go to "Firestore Database" > "Create database"
2. Start in test mode (you can configure rules later)
3. Choose a location close to your users

### 4. Enable Cloud Storage
1. Go to "Storage" > "Get started"
2. Start in test mode
3. Note the storage bucket URL

### 5. Get Firebase Configuration
1. Go to Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Add a web app (🌐 icon)
4. Register app with name "doany-app"
5. Copy the Firebase config object

### 6. Set Up Environment Variables
1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your actual Firebase config values:
   ```bash
   EXPO_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
   ```

3. The Firebase configuration in `/src/services/firebase.ts` will automatically use these environment variables.

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Install iOS Dependencies (macOS only)
```bash
cd ios && pod install && cd ..
```

## Running the App

### Development Server
```bash
npm start
```

### iOS Simulator
```bash
npm run ios
```

### Android Emulator
```bash
npm run android
```

### Web Browser (for testing)
```bash
npm run web
```

## App Structure

```
src/
├── components/          # Reusable UI components
│   ├── CreateGoalModal.tsx
│   └── index.ts
├── constants/           # App constants and theme
│   └── index.ts
├── hooks/              # Custom React hooks
│   └── useAuth.tsx
├── navigation/         # Navigation configuration
│   ├── RootNavigator.tsx
│   ├── MainTabNavigator.tsx
│   └── index.ts
├── screens/            # App screens
│   ├── AuthScreen.tsx
│   ├── HomeScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── GoalDetailScreen.tsx
│   └── index.ts
├── services/           # API and Firebase services
│   ├── firebase.ts
│   ├── userService.ts
│   ├── goalService.ts
│   ├── verificationService.ts
│   ├── locationService.ts
│   └── verificationAutomationService.ts
└── types/              # TypeScript type definitions
    └── index.ts
```

## Features Implemented

### ✅ Core Features
- [x] Firebase Authentication (Email/Password)
- [x] User profile management
- [x] Goal creation and management
- [x] Manual verification system
- [x] Location-based verification framework
- [x] Progress tracking and analytics
- [x] Beautiful UI with NativeWind/Tailwind CSS

### ✅ Screens
- [x] Authentication (Sign In/Sign Up)
- [x] Home screen with goals list
- [x] Goal detail screen with verification history
- [x] Profile screen with user stats
- [x] Goal creation modal

### 🚧 Planned Features
- [ ] Google Places API integration for location search
- [ ] Date picker for goal duration
- [ ] Screen time tracking integration
- [ ] Push notifications for goal reminders
- [ ] Goal sharing and social features
- [ ] Advanced analytics and reporting
- [ ] Image upload for manual verification

## Location Services Setup

### iOS Setup
Add the following to `ios/DoanyApp/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to verify location-based goals.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to verify location-based goals.</string>
```

### Android Setup
Add the following to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

## Database Structure

### Users Collection
```
users/{userId}
├── email: string
├── displayName: string
├── createdAt: timestamp
├── updatedAt: timestamp
├── depositBalance: number
└── points: number
```

### Goals Collection
```
goals/{goalId}
├── userId: string
├── title: string
├── description: string
├── category: string
├── verificationType: 'location' | 'time' | 'manual'
├── targetLocation?: { latitude, longitude, name }
├── timeFrame: 'daily' | 'weekly' | 'monthly'
├── frequency: number
├── startDate: timestamp
├── endDate: timestamp
├── createdAt: timestamp
└── updatedAt: timestamp
```

### Verifications Collection
```
verifications/{verificationId}
├── goalId: string
├── userId: string
├── status: 'success' | 'fail'
├── timestamp: timestamp
├── location?: { latitude, longitude, name }
└── screenshotUrl?: string
```

## Troubleshooting

### Common Issues

1. **Firebase initialization errors**: Make sure you've updated the Firebase config with your actual project details.

2. **Location permissions**: Ensure location permissions are properly configured for both iOS and Android.

3. **Metro bundler issues**: Clear cache with `npx expo start --clear`

4. **TypeScript errors**: Run `npx tsc --noEmit` to check for type errors.

### Development Tips

1. Use the Firebase Console to monitor data and authentication
2. Test location features on physical devices for better accuracy
3. Use Flipper or React Native Debugger for debugging
4. Check Expo documentation for platform-specific setup

## Next Steps

1. Set up your Firebase project and update the configuration
2. Test authentication flow
3. Create your first goal and test verification
4. Customize the UI theme in `/src/constants/index.ts`
5. Add additional features based on your requirements

## Support

For issues and questions:
- Check the Firebase documentation
- Review Expo documentation
- Examine the TypeScript types in `/src/types/index.ts`
- Test features in development mode first
