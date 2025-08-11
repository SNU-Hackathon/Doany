# Environment Variables Setup

## Required Environment Variables

For the app to work properly, you need to set the following environment variables in a `.env` file at the project root:

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

## Important Notes

### EXPO_PUBLIC_ Prefix
- **Required**: All environment variables that need to be accessible in the client must use the `EXPO_PUBLIC_` prefix
- This is an Expo requirement for security - variables without this prefix are not available in React Native code
- Variables with this prefix are exposed to the client, so never put sensitive server-side secrets here

### Getting Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (gear icon)
4. Scroll down to "Your apps" section
5. Add a web app or select existing one
6. Copy the config values from the Firebase SDK snippet

### After Making Changes
- **Always restart Metro**: After adding or changing environment variables, restart with:
  ```bash
  expo start --clear
  ```
- The `--clear` flag clears the cache and ensures new environment variables are loaded

### Validation
The app automatically validates required environment variables on startup and will log warnings if any are missing.

## Troubleshooting

### "Missing env" errors in console
- Check that your `.env` file is in the project root (same level as `package.json`)
- Verify all variable names start with `EXPO_PUBLIC_`
- Restart Metro with `expo start --clear`

### Firebase authentication errors
- Verify your API key belongs to the correct Firebase project
- Check that Email/Password authentication is enabled in Firebase Console
- Ensure your domain is authorized in Firebase Auth settings

### "Configuration not found" errors
- Double-check your project ID matches the one in Firebase Console
- Verify the API key has the correct permissions
- Make sure billing is enabled if using Firebase on a paid plan
