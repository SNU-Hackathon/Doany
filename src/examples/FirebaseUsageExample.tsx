// Example React component demonstrating Firebase Firestore usage
// Shows how to create goals, load goals, and handle authentication

import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, Text, TextInput, View } from 'react-native';
import { auth, createGoalDraft, createUserDocument, ensureOnline, firestorePing, Goal, loadGoals } from '../services/firebase';

export default function FirebaseUsageExample() {
  // Authentication state
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('Test User');
  
  // Goals state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Connection status
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [pingResult, setPingResult] = useState<boolean | null>(null);

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        console.log('👤 User signed in:', user.uid);
        loadUserGoals(user.uid);
        performConnectivityTests(user.uid);
      } else {
        console.log('👤 User signed out');
        setGoals([]);
        setIsOnline(null);
        setPingResult(null);
      }
    });

    return unsubscribe;
  }, []);

  /**
   * Test connectivity and perform Firestore ping
   */
  const performConnectivityTests = async (uid: string) => {
    try {
      // Test if we're online
      const online = await ensureOnline();
      setIsOnline(online);
      
      if (online) {
        // Perform Firestore ping test
        const ping = await firestorePing(uid);
        setPingResult(ping);
      }
    } catch (error) {
      console.error('Connectivity test failed:', error);
      setIsOnline(false);
      setPingResult(false);
    }
  };

  /**
   * Load user's goals from Firestore
   */
  const loadUserGoals = async (uid: string) => {
    try {
      setLoading(true);
      const userGoals = await loadGoals(uid, 5); // Load latest 5 goals
      setGoals(userGoals);
    } catch (error: any) {
      console.error('Failed to load goals:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign up new user
   */
  const handleSignUp = async () => {
    try {
      setLoading(true);
      
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Create user document in Firestore
      await createUserDocument(firebaseUser.uid, {
        name,
        email,
        createdAt: new Date() as any, // Will be replaced with serverTimestamp
      });
      
      Alert.alert('Success', 'Account created successfully!');
      
    } catch (error: any) {
      console.error('Sign up failed:', error);
      Alert.alert('Sign Up Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign in existing user
   */
  const handleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      Alert.alert('Success', 'Signed in successfully!');
    } catch (error: any) {
      console.error('Sign in failed:', error);
      Alert.alert('Sign In Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign out current user
   */
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      Alert.alert('Success', 'Signed out successfully!');
    } catch (error: any) {
      console.error('Sign out failed:', error);
      Alert.alert('Sign Out Failed', error.message);
    }
  };

  /**
   * Create a new goal
   */
  const handleCreateGoal = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    if (!goalTitle.trim()) {
      Alert.alert('Error', 'Please enter a goal title');
      return;
    }

    try {
      setLoading(true);
      
      // Create goal data
      const goalData = {
        title: goalTitle.trim(),
        category: 'Fitness',
        verificationMethods: ['manual'],
        frequency: 'daily',
        duration: '30 days',
        location: {
          lat: 37.7749,
          lng: -122.4194,
          address: 'San Francisco, CA',
        },
        startDate: new Date() as any, // Will be replaced with serverTimestamp
      };

      // Create the goal in Firestore
      const goalId = await createGoalDraft(user.uid, goalData);
      
      Alert.alert('Success', `Goal created with ID: ${goalId}`);
      setGoalTitle('');
      
      // Reload goals to show the new one
      await loadUserGoals(user.uid);
      
    } catch (error: any) {
      console.error('Failed to create goal:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh goals and connectivity
   */
  const handleRefresh = async () => {
    if (!user) return;
    
    await loadUserGoals(user.uid);
    await performConnectivityTests(user.uid);
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        Firebase Firestore Example
      </Text>

      {/* Connection Status */}
      <View style={{ backgroundColor: '#e3f2fd', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>Connection Status</Text>
        <Text>Online: {isOnline === null ? 'Testing...' : isOnline ? '✅ Yes' : '❌ No'}</Text>
        <Text>Firestore Ping: {pingResult === null ? 'Testing...' : pingResult ? '✅ Success' : '❌ Failed'}</Text>
      </View>

      {/* Authentication Section */}
      {!user ? (
        <View style={{ backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>Authentication</Text>
          
          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, marginBottom: 10, borderRadius: 5 }}
            placeholder="Name"
            value={name}
            onChangeText={setName}
          />
          
          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, marginBottom: 10, borderRadius: 5 }}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, marginBottom: 15, borderRadius: 5 }}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Button title="Sign Up" onPress={handleSignUp} disabled={loading} />
            <Button title="Sign In" onPress={handleSignIn} disabled={loading} />
          </View>
        </View>
      ) : (
        <View style={{ backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Welcome!</Text>
          <Text>Email: {user.email}</Text>
          <Text>UID: {user.uid}</Text>
          <Button title="Sign Out" onPress={handleSignOut} />
        </View>
      )}

      {/* Goal Creation Section */}
      {user && (
        <View style={{ backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>Create Goal</Text>
          
          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, marginBottom: 15, borderRadius: 5 }}
            placeholder="Goal title (e.g., 'Exercise for 30 minutes')"
            value={goalTitle}
            onChangeText={setGoalTitle}
          />
          
          <Button title="Create Goal" onPress={handleCreateGoal} disabled={loading || !goalTitle.trim()} />
        </View>
      )}

      {/* Goals List Section */}
      {user && (
        <View style={{ backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Your Goals ({goals.length})</Text>
            <Button title="Refresh" onPress={handleRefresh} disabled={loading} />
          </View>
          
          {loading ? (
            <ActivityIndicator size="large" style={{ margin: 20 }} />
          ) : goals.length > 0 ? (
            goals.map((goal, index) => (
              <View key={goal.id} style={{ 
                padding: 12, 
                borderWidth: 1, 
                borderColor: '#e0e0e0', 
                borderRadius: 6, 
                marginBottom: 10,
                backgroundColor: '#fafafa' 
              }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{goal.title}</Text>
                <Text style={{ color: '#666', fontSize: 14 }}>Category: {goal.category}</Text>
                <Text style={{ color: '#666', fontSize: 14 }}>Frequency: {goal.frequency}</Text>
                <Text style={{ color: '#666', fontSize: 14 }}>Duration: {goal.duration}</Text>
                <Text style={{ color: '#666', fontSize: 12 }}>ID: {goal.id}</Text>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
              No goals yet. Create your first goal above!
            </Text>
          )}
        </View>
      )}

      {/* Loading Indicator */}
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                       backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ color: 'white', marginTop: 10 }}>Loading...</Text>
        </View>
      )}
    </ScrollView>
  );
}
