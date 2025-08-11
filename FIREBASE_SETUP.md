# Firebase Firestore Setup Guide

This guide walks you through setting up Cloud Firestore for your React Native (Expo) project.

## 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable the following services:
   - **Authentication** (Email/Password)
   - **Cloud Firestore**
   - **Storage** (optional)

## 2. Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

**To get these values:**
1. Go to Project Settings (gear icon) in Firebase Console
2. Scroll down to "Your apps" 
3. Add a web app or select existing one
4. Copy the config values from the Firebase SDK snippet

## 3. Firestore Security Rules

Deploy the following security rules to your Firestore database:

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

**To deploy security rules:**
1. Go to Firestore Database in Firebase Console
2. Click on "Rules" tab
3. Replace the default rules with the rules above
4. Click "Publish"

## 4. Data Model Structure

The Firestore database uses the following collections structure:

```
📁 users/{uid}
├── name: string
├── email: string
├── createdAt: timestamp
├── 📁 goals/{goalId}
│   ├── title: string
│   ├── category: string
│   ├── verificationMethods: array<string>
│   ├── frequency: string
│   ├── duration: string
│   ├── location: { lat: number, lng: number, address: string }
│   ├── startDate: timestamp
│   └── createdAt: timestamp
├── 📁 activities/{activityId}
│   ├── goalId: string
│   ├── date: timestamp
│   ├── status: string
│   └── notes: string
└── 📁 __debug__/ping
    └── lastPing: timestamp

📁 placesIndex/{placeId}
├── name: string
├── address: string
├── coordinates: { lat: number, lng: number }
└── updatedAt: timestamp
```

## 5. Usage Examples

### Basic Firebase Setup

```typescript
import { auth, db, ensureOnline, firestorePing } from './src/services/firebase';

// Check if online before Firestore operations
const isOnline = await ensureOnline();

// Test Firestore connectivity
const pingSuccess = await firestorePing(user.uid);
```

### Create a Goal

```typescript
import { createGoalDraft } from './src/services/firebase';

const goalData = {
  title: 'Exercise for 30 minutes',
  category: 'Fitness',
  verificationMethods: ['manual'],
  frequency: 'daily',
  duration: '30 days',
  location: {
    lat: 37.7749,
    lng: -122.4194,
    address: 'San Francisco, CA',
  },
  startDate: Timestamp.now(),
};

const goalId = await createGoalDraft(user.uid, goalData);
```

### Load User Goals

```typescript
import { loadGoals } from './src/services/firebase';

// Load latest 10 goals
const goals = await loadGoals(user.uid, 10);
```

### Authentication Flow

```typescript
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, createUserDocument } from './src/services/firebase';

// Monitor auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('User signed in:', user.uid);
  } else {
    console.log('User signed out');
  }
});

// Sign in
await signInWithEmailAndPassword(auth, email, password);

// Create user document after signup
await createUserDocument(user.uid, {
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: Timestamp.now(),
});
```

## 6. Error Handling

The Firebase service includes comprehensive error handling:

```typescript
import { getFirebaseErrorMessage } from './src/types/firestore';

try {
  await createGoalDraft(uid, goalData);
} catch (error: any) {
  const userMessage = getFirebaseErrorMessage(error);
  Alert.alert('Error', userMessage);
}
```

## 7. Performance Optimizations

The implementation includes several React Native optimizations:

- **Long Polling**: `experimentalForceLongPolling: true` for better RN compatibility
- **Network Awareness**: Checks internet connectivity before operations
- **Offline Support**: Graceful handling of offline scenarios
- **Connection Testing**: Built-in ping functionality to test Firestore connectivity

## 8. Troubleshooting

### Common Issues

**"Missing or insufficient permissions"**
- Check that security rules are deployed correctly
- Ensure user is authenticated (`auth.currentUser` is not null)
- Verify the user UID matches the document path

**"Client is offline"**
- Call `ensureOnline()` before Firestore operations
- Check device internet connectivity
- Verify Firebase project is active and billing enabled

**"Permission denied"**
- User might not be authenticated
- Security rules might be too restrictive
- Check Firebase Auth state

### Debug Tools

Use the built-in debugging features:

```typescript
// Test connectivity
const isOnline = await ensureOnline();
console.log('Is online:', isOnline);

// Test Firestore access
const pingResult = await firestorePing(user.uid);
console.log('Ping successful:', pingResult);
```

## 9. Security Best Practices

1. **Never expose server-side secrets** in `EXPO_PUBLIC_` variables
2. **Use security rules** to control data access
3. **Validate data** on both client and server side
4. **Monitor usage** in Firebase Console
5. **Set up billing alerts** to avoid unexpected charges
6. **Use indexes** for complex queries
7. **Implement rate limiting** for write operations

## 10. Next Steps

1. Set up your Firebase project and get configuration values
2. Create the `.env` file with your Firebase config
3. Deploy the security rules to your Firestore database
4. Test the connection using the provided example component
5. Start building your app features using the Firebase services

For more advanced features, consider adding:
- Cloud Functions for server-side logic
- Firebase Analytics for usage tracking
- Firebase Performance Monitoring
- Firebase Crashlytics for error reporting
