// screens/EvoHomeScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
    Alert, Image, ImageBackground, Modal, Pressable, StatusBar,
    StyleSheet, Text, TextInput, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '../assetsMap';
import { useEraState } from '../store/era';

type RootStackParamList = { Tabs: undefined; LevelMap: undefined; };
const CHARACTER_NAME_KEY = 'character_name';
const ERA_LABEL: Record<string,string> = { basic: '기본', mesozoic: '중생대', paleolithic: '구석기' };

export default function EvoHomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const { era, next, prev } = useEraState('basic');
  const [name, setName] = useState('아기');
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState('');

  useEffect(() => {
    (async () => {
      try { const v = await AsyncStorage.getItem(CHARACTER_NAME_KEY); if (v) setName(v); } catch {}
    })();
  }, []);

  const save = async () => {
    const v = temp.trim(); if (!v) return;
    try { await AsyncStorage.setItem(CHARACTER_NAME_KEY, v); setName(v); setEditing(false); }
    catch { Alert.alert('오류','이름 저장 실패'); }
  };

  const TOP = insets.top + 50; // 카메라/Level MAP baseline
  const BOTTOM = insets.bottom + 20; // 하단 여백

  return (
    <ImageBackground source={Images.home[era]} style={styles.bg} resizeMode="cover">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* 상단 타이틀 */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.title}>My Evo</Text>
      </View>

        {/* 좌상단 카메라 */}
        <Pressable style={[styles.abs, { left: 20, top: TOP, alignItems: 'center' }]} hitSlop={8}>
          <View style={styles.circleBtn}>
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
          <Text style={styles.iconLabel}>Screen shot</Text>
        </Pressable>

        {/* 우상단 Level MAP */}
        <Pressable
          onPress={() => nav.navigate('LevelMap')}
          style={[styles.abs, { right: 20, top: TOP, alignItems: 'center' }]}
          hitSlop={8}
        >
          <Image source={Images.homeItem.maps} style={styles.mapIcon} />
          <Text style={styles.iconLabel}>Level MAP</Text>
        </Pressable>

        {/* 캐릭터 */}
        <View style={styles.center}>
          <Image source={Images.homeItem.character} style={styles.character} />
        </View>

        {/* 진행 패널 */}
        <View style={styles.panel}>
          <View style={styles.lvChip}><Text style={styles.lvText}>Lv 3</Text></View>

          <Pressable style={styles.nameRow} onPress={() => { setTemp(name); setEditing(true); }}>
            <Text style={styles.name}>{name}</Text>
            <Ionicons name="pencil" size={16} color="#6B7280" style={{ marginLeft: 6 }} />
          </Pressable>

          <View style={styles.track}><View style={styles.fill} /></View>
          <Text style={styles.progress}>20% 진행 중</Text>
        </View>

        {/* 하단 플로팅 + Era 전환 */}
        <View style={[styles.bottomRow, { paddingBottom: BOTTOM }]}>
          <Pressable style={styles.fabCol}>
            <View style={styles.fab}>
              <Image source={Images.homeItem.clothes} style={styles.fabIcon} />
            </View>
            <Text style={styles.fabLabel}>옷장</Text>
          </Pressable>

          <View style={styles.eraSwitch}>
            <Pressable onPress={prev} hitSlop={10}><Text style={styles.arrow}>{'‹'}</Text></Pressable>
            <Text style={styles.eraText}>{ERA_LABEL[era]}</Text>
            <Pressable onPress={next} hitSlop={10}><Text style={styles.arrow}>{'›'}</Text></Pressable>
          </View>

          <Pressable style={styles.fabCol}>
            <View style={styles.fab}>
              <Image source={Images.homeItem.stores} style={styles.fabIcon} />
            </View>
            <Text style={styles.fabLabel}>상점</Text>
          </Pressable>
        </View>

        {/* 이름 변경 모달 */}
        <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
          <Pressable style={styles.dim} onPress={() => setEditing(false)}>
            <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.cardTitle}>캐릭터 이름 변경</Text>
              <TextInput
                value={temp}
                onChangeText={setTemp}
                placeholder="이름을 입력하세요"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                autoFocus
                maxLength={20}
              />
              <View style={styles.actions}>
                <Pressable style={[styles.btn, styles.ghost]} onPress={() => setEditing(false)}>
                  <Text style={[styles.btnText, { color: '#6B7280' }]}>취소</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.primary]} onPress={save}>
                  <Text style={[styles.btnText, { color: '#fff' }]}>저장</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#000' }, // 상단/하단 흰 띠 방지

  topBar: { paddingHorizontal: 20, backgroundColor: 'transparent' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  abs: { position: 'absolute', zIndex: 10 },
  circleBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  mapIcon: { width: 44, height: 44, marginBottom: 4, resizeMode: 'contain' },
  iconLabel: {
    fontSize: 11, fontWeight: '800', color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 110, marginLeft: 80 },
  character: { width: 260, height: 280, resizeMode: 'contain' },

  panel: {
    alignSelf: 'center', width: '88%',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18,
    marginBottom: -5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  lvChip: { alignSelf: 'center', backgroundColor: '#ECFF65', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 6 },
  lvText: { fontWeight: '800', color: '#111827', fontSize: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  name: { fontSize: 18, fontWeight: '800', color: '#111827' },
  track: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden' },
  fill: { width: '20%', height: '100%', backgroundColor: '#3B82F6' },
  progress: { marginTop: 6, textAlign: 'center', color: '#4B5563', fontWeight: '700', fontSize: 12 },

  bottomRow: {
    bottom: -25,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  fabCol: {
    alignItems: 'center',
  },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 4,
  },
  fabIcon: { width: 40, height: 40, resizeMode: 'contain' },
  fabLabel: {
    fontSize: 11, fontWeight: '800', color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  eraSwitch: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 4,
  },
  eraText: { color: '#fff', fontWeight: '800', fontSize: 14, minWidth: 56, textAlign: 'center' },
  arrow: { color: '#fff', fontSize: 24, fontWeight: '300', paddingHorizontal: 2 },

  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    backgroundColor: '#fff', width: '100%', maxWidth: 380, borderRadius: 18,
    padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 14
  },
  cardTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', color: '#111827', marginBottom: 12 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 14, fontSize: 16, color: '#111827', marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  ghost: { backgroundColor: '#F3F4F6' },
  primary: { backgroundColor: '#3B82F6' },
  btnText: { fontSize: 16, fontWeight: '800' },
});