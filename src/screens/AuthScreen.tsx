// Authentication screen for sign in and sign up with robust error handling

import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../components';
import { useAuth } from '../hooks/useAuth';
import { AuthError, sendReset } from '../services/auth';

export default function AuthScreen() {
  console.time('[AuthScreen] Component Mount');
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [showEmailAlreadyExists, setShowEmailAlreadyExists] = useState(false);
  
  const { signIn, signUp, user } = useAuth();

  // Debug auth state in AuthScreen (console only)
  React.useEffect(() => {
    console.log('[AuthScreen] Auth state changed:', { 
      hasUser: !!user, 
      userEmail: user?.email,
      authUserId: user?.id 
    });
  }, [user]);

  // Debug Firebase configuration and performance tracking
  React.useEffect(() => {
    if (__DEV__) {
      console.log('🔍 Firebase Project ID:', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
      console.log('🔍 Firebase Auth Domain:', process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN);
    }
    
    return () => {
      console.timeEnd('[AuthScreen] Component Mount');
    };
  }, []);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address to reset your password.');
      return;
    }

    try {
      console.log('🔍 [DEBUG] Sending password reset email to:', email);
      console.log('🔍 [DEBUG] Using Firebase project:', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
      await sendReset(email.trim());
      console.log('✅ [DEBUG] Password reset email sent successfully');
      Alert.alert(
        'Password Reset Email Sent',
        `A password reset link has been sent to ${email}. Please check your email and follow the instructions.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('❌ [DEBUG] Password reset failed:', error);
      console.log('🔍 [DEBUG] Error code:', error.code);
      Alert.alert('Password Reset Failed', error.friendlyMessage || error.message);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      Alert.alert('Missing Information', 'Please enter your name.');
      return;
    }

    const operation = isSignUp ? 'Sign Up' : 'Sign In';
    console.time(`[AuthScreen] ${operation}`);

    setLoading(true);

    try {
      setError(null);
      setShowEmailAlreadyExists(false);

      if (isSignUp) {
        console.time('[AuthScreen] Sign Up');
        await signUp(email.trim(), password.trim(), displayName.trim());
        console.log('[AuthScreen] Sign up successful - auth gate will handle navigation');
      } else {
        console.time('[AuthScreen] Sign In');
        await signIn(email.trim(), password.trim());
        console.log('[AuthScreen] Sign in successful - auth gate will handle navigation');
      }

      // Clear form on success - auth gate will handle navigation
      setEmail('');
      setPassword('');
      setDisplayName('');
      setError(null);
      setShowEmailAlreadyExists(false);
    } catch (error: any) {
      console.warn(`[AuthScreen] ${operation} failed:`, error);
      setError(error);

      // Handle specific error cases with user-friendly flows
      if (error.code === 'auth/email-already-in-use') {
        setShowEmailAlreadyExists(true);
        Alert.alert(
          'Email Already Exists',
          'An account with this email already exists. Would you like to sign in instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign In',
              onPress: () => {
                setIsSignUp(false);
                setShowEmailAlreadyExists(false);
              }
            }
          ]
        );
      } else if (error.code === 'auth/operation-not-allowed') {
        Alert.alert(
          'Sign-Up Disabled',
          'Email/Password sign-in is not enabled. Please contact support.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Authentication Error', error.friendlyMessage || error.message);
      }
    } finally {
      setLoading(false);
      console.timeEnd(`[AuthScreen] ${operation}`);
    }
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setShowEmailAlreadyExists(false);
  };

  return (
    <ScreenContainer
      backgroundColor="white"
      keyboardAvoidingView
      contentPadding
      paddingHorizontal={20}
      paddingVertical={16}
      contentContainerStyle={{ flexGrow: 1 }}
    >
            {/* Header */}
            <View style={{ marginBottom: 32, marginTop: 16 }}>
              <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>
                Doany
              </Text>
              <Text style={{ fontSize: 18, color: '#6B7280', marginBottom: 4 }}>
                Set goals, track progress, achieve more
              </Text>
              <Text style={{ fontSize: 24, fontWeight: '600', color: '#111827' }}>
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </Text>
            </View>

            {/* Auth Form */}
            <View style={{ marginBottom: 24 }}>
              {/* Name field for sign up */}
              {isSignUp && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#374151', fontWeight: '500', marginBottom: 8 }}>Name</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                    placeholder="Enter your name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    autoComplete="name"
                  />
                </View>
              )}

              {/* Email field */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#374151', fontWeight: '500', marginBottom: 8 }}>Email</Text>
                <TextInput
                  style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              {/* Password field */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#374151', fontWeight: '500', marginBottom: 8 }}>Password</Text>
                <TextInput
                  style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />
              </View>
            </View>

            {/* Error Display */}
            {error && (
              <View style={{ marginBottom: 16, padding: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8 }}>
                <Text style={{ color: '#B91C1C', fontWeight: '600', fontSize: 14, marginBottom: 4 }}>
                  Error ({error.code})
                </Text>
                <Text style={{ color: '#DC2626', fontSize: 14, marginBottom: 8 }}>
                  {error.friendlyMessage}
                </Text>
                {error.suggestedAction && (
                  <Text style={{ color: '#EF4444', fontSize: 12, fontStyle: 'italic' }}>
                    Suggestion: {error.suggestedAction}
                  </Text>
                )}
              </View>
            )}

            {/* Email Already Exists Helper */}
            {showEmailAlreadyExists && (
              <View style={{ marginBottom: 16, padding: 12, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8 }}>
                <Text style={{ color: '#92400E', fontWeight: '600', fontSize: 14, marginBottom: 4 }}>
                  Account Already Exists
                </Text>
                <Text style={{ color: '#D97706', fontSize: 14 }}>
                  An account with this email already exists. Try signing in instead.
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={{
                marginTop: 8,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: loading ? '#9CA3AF' : '#2563EB'
              }}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '500', fontSize: 18 }}>
                {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </Text>
            </TouchableOpacity>

            {/* Forgot Password Link - only show for sign in */}
            {!isSignUp && (
              <TouchableOpacity onPress={handleForgotPassword} style={{ marginTop: 16 }}>
                <Text style={{ color: '#2563EB', textAlign: 'center', fontWeight: '500' }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            )}

            {/* Toggle Auth Mode */}
            <TouchableOpacity onPress={toggleAuthMode} style={{ marginTop: 24 }}>
              <Text style={{ color: '#6B7280', textAlign: 'center' }}>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <Text style={{ color: '#2563EB', fontWeight: '500' }}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>
      <StatusBar style="auto" />
    </ScreenContainer>
  );
}