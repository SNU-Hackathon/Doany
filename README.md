# Doany - Goal Tracking App

A React Native mobile application built with Expo for setting goals, tracking progress through verification methods, and calculating achievement rates.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI: `npm install -g @expo/cli`
- Firebase project setup

### Installation
```bash
# Install dependencies
npm install

# Install iOS dependencies (macOS only)
cd ios && pod install && cd ..
```

### Running the App
```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run in web browser (for testing)
npm run web
```

## 🔥 Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "doany-app"
3. Enable Google Analytics (optional)

### 2. Enable Services
Enable the following services in Firebase Console:
- **Authentication** (Email/Password)
- **Cloud Firestore**
- **Storage** (for photo uploads)

### 3. Get Configuration
1. Go to Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Add a web app (🌐 icon)
4. Register app with name "doany-app"
5. Copy the Firebase config object

### 4. Environment Variables
Create a `.env` file in your project root:

```env
# Firebase Configuration (required)
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdefghijk

# Optional: Firebase Analytics
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-ABCDEFGHIJ

# Other API Keys (optional)
EXPO_PUBLIC_OPENAI_API_KEY=sk-your_openai_key_here
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key_here
```

**Important:** After making changes to `.env`, restart Metro with `expo start --clear`

## 🔒 Security Rules

### Firestore Rules
Deploy these security rules to your Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own documents
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Places index - read-only for all users, write for admins only
    match /placesIndex/{placeId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

### Storage Rules
For photo uploads, deploy these Storage rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Verification photos - users can upload their own
    match /verifications/{userId}/{goalId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
        && request.auth.uid == userId
        && request.resource.size < 10 * 1024 * 1024  // Max 10MB
        && request.resource.contentType.matches('image/.*');  // Only images
    }
    
    // User profile pictures
    match /users/{userId}/profile/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024  // Max 5MB
        && request.resource.contentType.matches('image/.*');
    }
    
    // Deny all other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## 📱 App Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/          # Common components (BaseScreen, LoadingState, etc.)
│   ├── chatbot/         # AI chatbot components
│   ├── createGoal/      # Goal creation flow
│   ├── feed/            # Social feed components
│   └── quests/          # Quest/gamification components
├── screens/             # App screens
│   ├── AuthScreen.tsx
│   ├── GoalsScreen.tsx
│   ├── ProfileScreen.tsx
│   └── ...
├── services/            # Business logic & API
│   ├── firebase.ts      # Firebase configuration
│   ├── auth.ts          # Authentication
│   ├── goalService.ts   # Goal management
│   └── ...
├── hooks/               # Custom React hooks
├── navigation/          # Navigation configuration
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── schemas/             # Data validation schemas
```

## 🎯 Features

### ✅ Implemented
- Firebase Authentication (Email/Password)
- User profile management
- Goal creation and management
- Manual verification system
- Location-based verification framework
- Progress tracking and analytics
- Beautiful UI with NativeWind/Tailwind CSS
- Photo upload for verification
- Social feed for sharing achievements

### 🚧 Planned
- Google Places API integration
- Push notifications for reminders
- Advanced analytics and reporting
- Screen time tracking integration

## 📊 Database Structure

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

## 🔧 Troubleshooting

### Common Issues

**Firebase initialization errors**
- Make sure you've updated the Firebase config with your actual project details
- Check that all environment variables are set correctly

**Location permissions**
- Ensure location permissions are properly configured for both iOS and Android

**Metro bundler issues**
- Clear cache with `npx expo start --clear`

**TypeScript errors**
- Run `npx tsc --noEmit` to check for type errors

**Photo upload errors**
- Check Firebase Storage rules are deployed correctly
- Verify user is authenticated
- Ensure file size is under 10MB

### Development Tips
1. Use Firebase Console to monitor data and authentication
2. Test location features on physical devices for better accuracy
3. Use Flipper or React Native Debugger for debugging
4. Check Expo documentation for platform-specific setup

## 📱 Platform Setup

### iOS Setup
Add to `ios/DoanyApp/Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to verify location-based goals.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to verify location-based goals.</string>
```

### Android Setup
Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

## 🎨 Styling

The app uses NativeWind (Tailwind CSS for React Native) for styling. Configuration is in `src/styles/tailwind.ts`.

## 🌍 Internationalization

The app supports multiple languages with translations in `src/i18n/resources/`.

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Navigation](https://reactnavigation.org/)
- [NativeWind Documentation](https://www.nativewind.dev/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
