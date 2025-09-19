import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import LocationSection from '../../components/LocationSection';
import SimpleDatePicker from '../../components/SimpleDatePicker';

type GoalType = 'frequency' | 'schedule';

type Props = {
  goalType: GoalType;
  formData: any;
  setFormData: (updater: (prev: any) => any) => void;
  onDone: () => void; // 서브 플로우 완료 시 호출
};

const ALLOWED: Record<GoalType, string[]> = {
  frequency: ['manual', 'location', 'photo'],
  schedule:  ['manual', 'location', 'photo', 'time', 'screentime'],
};

export default function ScheduleFlow({ goalType, formData, setFormData, onDone }: Props) {
  const isFrequency = goalType === 'frequency';

  // ---- 페이지 구성
  const pages = useMemo(() => {
    const base = ['period'];
    if (isFrequency) base.push('weeklyTarget');
    base.push('verification');
    // location 메서드를 이미 선택했으면 location 페이지 포함
    const selected: string[] = formData?.verificationMethods ?? [];
    if (selected.includes('location')) base.push('location');
    return base as Array<'period'|'weeklyTarget'|'verification'|'location'>;
  }, [goalType, formData?.verificationMethods]);

  const width = Dimensions.get('window').width;
  const FOOTER_HEIGHT = 80; // 하단 CTA 대략 높이
  const PAGE_PADDING = 16;
  const listRef = useRef<FlatList>(null);
  const [idx, setIdx] = useState(0);

  const goNext = () => {
    if (idx < pages.length - 1) {
      listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
      setIdx(i => i + 1);
    } else {
      onDone();
    }
  };
  const goBack = () => {
    if (idx > 0) {
      listRef.current?.scrollToIndex({ index: idx - 1, animated: true });
      setIdx(i => i - 1);
    }
  };

  // ---- 데이터 바인딩
  const weeklyTarget = formData?.weeklyTarget ?? formData?.weeklyMinimum ?? 3;
  const setWeeklyTarget = (v: number) =>
    setFormData(prev => ({ ...prev, weeklyTarget: v, weeklyMinimum: v }));

  const allowed = ALLOWED[goalType];
  // frequency에서는 manual 강제 포함 + 잠금
  let baseSelected: string[] = (formData?.verificationMethods ?? []).filter(m => allowed.includes(m));
  if (isFrequency && !baseSelected.includes('manual')) baseSelected = ['manual', ...baseSelected];
  // 상태 보정
  React.useEffect(() => {
    setFormData(prev => {
      const current = prev?.verificationMethods ?? [];
      const filtered = current.filter((m: string) => allowed.includes(m));
      const normalized = isFrequency
        ? Array.from(new Set(['manual', ...filtered]))
        : filtered;
      if (JSON.stringify(normalized) !== JSON.stringify(current)) {
        return { ...prev, verificationMethods: normalized };
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalType]);
  const selected = baseSelected;
  const toggleMethod = (m: string) => {
    if (isFrequency && m === 'manual') return; // 잠금
    const next = selected.includes(m) ? selected.filter(x => x !== m) : [...selected, m];
    setFormData(prev => ({ ...prev, verificationMethods: next }));
  };

  const canNext = (() => {
    const page = pages[idx];
    if (page === 'period') {
      return !!formData?.duration?.startDate && !!formData?.duration?.endDate;
    }
    if (page === 'weeklyTarget') {
      return weeklyTarget > 0;
    }
    if (page === 'verification') {
      return selected.length > 0;
    }
    if (page === 'location') {
      return !!formData?.targetLocation;
    }
    return true;
  })();

  const Page = ({children}: {children: React.ReactNode}) => (
    <ScrollView
      style={{ width }}
      contentContainerStyle={{ padding: PAGE_PADDING, paddingBottom: FOOTER_HEIGHT + 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );

  const renderPage = (page: typeof pages[number]) => {
    switch (page) {
      case 'period':
        return (
          <Page>
            <SimpleDatePicker
              goalType={goalType}
              weeklyTarget={weeklyTarget}
              onWeeklyTargetChange={setWeeklyTarget}
              startDate={formData?.duration?.startDate || null}
              endDate={formData?.duration?.endDate || null}
              onStartDateChange={(date) => setFormData(prev => ({ ...prev, duration: { ...prev?.duration, startDate: date } }))}
              onEndDateChange={(date) => setFormData(prev => ({ ...prev, duration: { ...prev?.duration, endDate: date } }))}
              onNavigateToStep={() => {}} // Not used in sub-flow
              mode={isFrequency ? 'period' : 'period+weekly'}
              variant="compact" // 헤더/설명 축소
            />
          </Page>
        );
      case 'weeklyTarget':
        return (
          <Page>
            <Text className="text-2xl font-bold text-gray-800 mb-6">주당 목표 횟수</Text>
            <View className="flex-row items-center justify-center mt-8">
              <TouchableOpacity
                onPress={() => setWeeklyTarget(Math.max(1, weeklyTarget - 1))}
                className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center"
              >
                <Text className="text-blue-600 text-2xl font-bold">−</Text>
              </TouchableOpacity>
              <Text className="mx-8 text-4xl font-bold text-blue-800">{weeklyTarget}회</Text>
              <TouchableOpacity
                onPress={() => setWeeklyTarget(Math.min(7, weeklyTarget + 1))}
                className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center"
              >
                <Text className="text-blue-600 text-2xl font-bold">＋</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-gray-600 text-center mt-6">
              주당 {weeklyTarget}회 목표를 달성하세요
            </Text>
          </Page>
        );
      case 'verification':
        return (
          <Page>
            <Text className="text-2xl font-bold text-gray-800 mb-6">Verification Methods</Text>
            <Text className="text-gray-600 mb-6">진행 상황을 확인할 방법을 선택하세요</Text>
            <View className="space-y-3">
              {allowed.map(m => {
                const locked = isFrequency && m === 'manual';
                const selectedNow = selected.includes(m) || locked;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => toggleMethod(m)}
                    disabled={locked}
                    className={`flex-row items-center py-4 px-4 rounded-lg border ${
                      selectedNow 
                        ? 'bg-blue-50 border-blue-300' 
                        : 'bg-white border-gray-300'
                    } ${locked ? 'opacity-75' : ''}`}
                  >
                    <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                      selectedNow
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-300 bg-white'
                    }`}>
                      {selectedNow && (
                        <Text className="text-white text-xs font-bold">✓</Text>
                      )}
                    </View>
                    <Text className="text-gray-700 text-base capitalize font-medium">
                      {m}
                      {locked && <Text className="text-xs text-gray-500 ml-1">(필수)</Text>}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selected.includes('location') && (
              <Text className="text-blue-600 text-sm mt-4 p-3 bg-blue-50 rounded-lg">
                다음 단계에서 위치를 선택합니다.
              </Text>
            )}
          </Page>
        );
      case 'location':
        return (
          <Page>
            <Text className="text-2xl font-bold text-gray-800 mb-6">Target Location</Text>
            <LocationSection
              value={formData?.targetLocation}
              onChange={(loc: any) => setFormData(prev => ({ ...prev, targetLocation: loc }))}
            />
          </Page>
        );
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* 진행 표시 (점) */}
      <View pointerEvents="none" className="flex-row justify-center mt-4 mb-4">
        {pages.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === idx ? 24 : 8, 
              height: 8, 
              borderRadius: 4,
              backgroundColor: i === idx ? '#2563eb' : '#d1d5db', 
              marginHorizontal: 4
            }}
          />
        ))}
      </View>

      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        bounces={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        data={pages}
        keyExtractor={(p) => p}
        renderItem={({ item }) => renderPage(item)}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* 하단 CTA */}
      <View style={{ height: FOOTER_HEIGHT }} className="flex-row gap-4 px-6 py-4 bg-white border-t border-gray-200">
        <TouchableOpacity
          onPress={goBack}
          disabled={idx === 0}
          className={`flex-1 py-3 px-6 rounded-lg border ${
            idx === 0 
              ? 'bg-gray-100 border-gray-200' 
              : 'bg-white border-gray-300'
          }`}
        >
          <Text className={`text-center font-semibold ${
            idx === 0 ? 'text-gray-400' : 'text-gray-700'
          }`}>
            Back
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={goNext}
          disabled={!canNext}
          className={`flex-1 py-3 px-6 rounded-lg ${
            canNext ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <Text className={`text-center font-semibold ${
            canNext ? 'text-white' : 'text-gray-500'
          }`}>
            {idx === pages.length - 1 ? '확인' : '다음'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
