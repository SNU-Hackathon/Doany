// LevelMapScreen: 2.5D progress map with step progression
// Design principles:
// - Apple: Spatial awareness, visual hierarchy
// - Toss: Clear status indication

import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { Image, ImageBackground, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Images } from '../assetsMap';

interface LevelStep {
  id: number;
  x: number;
  y: number;
  status: 'locked' | 'current' | 'completed';
}

const LEVEL_STEPS: LevelStep[] = [
  { id: 1, x: 160, y: 580, status: 'current' },
  { id: 2, x: 290, y: 500, status: 'locked' },
  { id: 3, x: 200, y: 400, status: 'locked' },
  { id: 4, x: 160, y: 300, status: 'locked' },
  { id: 5, x: 240, y: 200, status: 'locked' },
];

const DOT_PATHS = [
  { image: Images.levels.dotsV, x: 170, y: 490, rotation: 0 },
  { image: Images.levels.dotsH, x: 210, y: 450, rotation: 45 },
  { image: Images.levels.dotsV, x: 180, y: 350, rotation: 10 },
  { image: Images.levels.dotsH, x: 180, y: 250, rotation: 30 },
];

export default function LevelMapScreen() {
  const navigation = useNavigation();

  return (
    <ImageBackground source={Images.levelMap} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="dark-content" />
      
      {/* Back Button */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>{'‹'}</Text>
          <Text style={styles.headerTitle}>Level MAP</Text>
        </Pressable>
      </View>

      {/* Dot Paths (Background Layer) */}
      {DOT_PATHS.map((dot, index) => (
        <Image
          key={`dot-${index}`}
          source={dot.image}
          style={[
            styles.dotPath,
            {
              top: dot.y,
              left: dot.x,
              transform: [{ rotate: `${dot.rotation}deg` }],
            },
          ]}
        />
      ))}

      {/* Level Steps */}
      {LEVEL_STEPS.map((step) => (
        <View key={step.id} style={[styles.stepContainer, { top: step.y, left: step.x }]}>
          <Pressable
            style={styles.stepButton}
            onPress={() => {
              if (step.status === 'current') {
                console.log('Open current level details');
              }
            }}
          >
            <Image
              source={step.status === 'current' ? Images.levels.current : Images.levels.locked}
              style={styles.stepIcon}
            />
          </Pressable>
          {step.status === 'current' && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv.3</Text>
            </View>
          )}
        </View>
      ))}

      {/* Placeholder for future detail panel */}
      <View style={styles.detailPanelPlaceholder} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '300',
    color: '#1F2937',
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  dotPath: {
    position: 'absolute',
    width: 120,
    height: 120,
    resizeMode: 'contain',
    opacity: 0.85,
  },
  stepContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  stepButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  stepIcon: {
    width: 72,
    height: 72,
    resizeMode: 'contain',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -8,
    backgroundColor: '#ECFF65',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  detailPanelPlaceholder: {
    position: 'absolute',
    right: 0,
    top: 100,
    bottom: 0,
    width: 0, // Reserved for future panel
  },
});

