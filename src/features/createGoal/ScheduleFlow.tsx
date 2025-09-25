import React, { memo, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import LocationSection from '../../components/LocationSection';
import SimpleDatePicker from '../../components/SimpleDatePicker';
import { DateRange, minMaxFromRanges } from '../../utils/dateRanges';

type GoalType = 'frequency' | 'schedule';

// ⬇️ 파일 상단 컴포넌트 밖으로 Page 호이스팅(타입 고정 → 스크롤 위치 유지)
const FOOTER_HEIGHT = 80;
const PAGE_PADDING = 16;
const Page = memo(function Page({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={{ padding: 12, paddingBottom: FOOTER_HEIGHT + 16 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
});

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
  
  // Debug logging
  console.log('[ScheduleFlow] goalType debug:', {
    goalType,
    isFrequency
  });

  // ---- 페이지 구성
  const pages = useMemo(() => {
    const base = ['period'];
    if (isFrequency) base.push('weeklyTarget');
    base.push('verification');
    // location 메서드를 이미 선택했으면 location 페이지 포함
    const selected: string[] = formData?.verificationMethods ?? [];
    if (selected.includes('location')) base.push('location');
    base.push('successCriteria');
    return base as Array<'period'|'weeklyTarget'|'verification'|'location'|'successCriteria'>;
  }, [goalType, formData?.verificationMethods]);

  const width = Dimensions.get('window').width;
  // (상단으로 이동)
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

  // ranges 기반으로 변경
  const ranges: DateRange[] = formData.durationRanges ?? (formData.duration?.startDate && formData.duration?.endDate
    ? [{ start: new Date(formData.duration.startDate), end: new Date(formData.duration.endDate) }]
    : []);
  const setRanges = (next: DateRange[]) => {
    setFormData(prev => ({
      ...prev,
      durationRanges: next,
      duration: (() => {
        const { start, end } = minMaxFromRanges(next);
        return { ...(prev?.duration ?? {}), startDate: start, endDate: end };
      })()
    }));
  };

  const allowed = ALLOWED[goalType];
  
  // 🔒 보정은 "실제로 달라질 때만" 수행
  React.useEffect(() => {
    const current: string[] = formData?.verificationMethods ?? [];
    const filtered = current.filter((m) => allowed.includes(m));
    const normalized = isFrequency ? Array.from(new Set(['manual', ...filtered])) : filtered;
    if (current.length !== normalized.length || current.some((m, i) => m !== normalized[i])) {
      setFormData((prev) => ({ ...prev, verificationMethods: normalized }));
    }
    // goalType/allowed가 바뀔 때만 시도
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalType]);
  
  // frequency에서는 manual 강제 포함 + 잠금
  const selected: string[] = (() => {
    const baseSelected = (formData?.verificationMethods ?? []).filter(m => allowed.includes(m));
    return isFrequency && !baseSelected.includes('manual') 
      ? ['manual', ...baseSelected]
      : baseSelected;
  })();
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


  const renderPage = (page: typeof pages[number]) => {
    switch (page) {
      case 'period':
        return (
          <Page width={width}>
            <SimpleDatePicker
              goalType={goalType}
              weeklyTarget={weeklyTarget}
              onWeeklyTargetChange={setWeeklyTarget}
              ranges={ranges}
              onRangesChange={setRanges}
              onNavigateToStep={() => {}} // Not used in sub-flow
              mode={isFrequency ? 'period' : 'period+weekly'}
              variant="compact" // 헤더/설명 축소
              isFrequencyGoal={isFrequency}
            />
          </Page>
        );
      case 'weeklyTarget':
        return (
          <Page width={width}>
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
          <Page width={width}>
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
          <Page width={width}>
            <Text className="text-2xl font-bold text-gray-800 mb-6">Target Location</Text>
            <LocationSection
              value={formData?.targetLocation}
              onChange={(loc: any) => setFormData(prev => ({ ...prev, targetLocation: loc }))}
            />
          </Page>
        );
      case 'successCriteria':
        return (
          <Page width={width}>
            <Text className="text-2xl font-bold text-gray-800 mb-6">성공 기준</Text>
            <Text className="text-gray-600 mb-6">목표 달성의 기준을 설정하세요</Text>
            
            <View className="space-y-4">
              <View className="bg-white rounded-lg border border-gray-200 p-4">
                <Text className="text-lg font-semibold text-gray-800 mb-4">성공률 목표</Text>
                <View className="flex-row items-center justify-center">
                  <TouchableOpacity
                    onPress={() => {
                      console.log('[ScheduleFlow] Decreasing success rate');
                      setFormData(prev => {
                        const newValue = Math.max(10, (prev.successRate || 80) - 10);
                        console.log('[ScheduleFlow] New success rate:', newValue);
                        return { ...prev, successRate: newValue };
                      });
                    }}
                    className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center"
                  >
                    <Text className="text-blue-600 text-2xl font-bold">−</Text>
                  </TouchableOpacity>
                  <Text className="mx-8 text-4xl font-bold text-blue-800">
                    {formData?.successRate || 80}%
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      console.log('[ScheduleFlow] Increasing success rate');
                      setFormData(prev => {
                        const newValue = Math.min(100, (prev.successRate || 80) + 10);
                        console.log('[ScheduleFlow] New success rate:', newValue);
                        return { ...prev, successRate: newValue };
                      });
                    }}
                    className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center"
                  >
                    <Text className="text-blue-600 text-2xl font-bold">＋</Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-gray-600 text-center mt-4">
                  {formData?.successRate || 80}% 이상 달성 시 성공으로 인정
                </Text>
              </View>

              <View className="bg-white rounded-lg border border-gray-200 p-4">
                <Text className="text-lg font-semibold text-gray-800 mb-4">목표 설명</Text>
                <Text className="text-gray-600 text-sm">
                  {isFrequency 
                    ? `주당 ${weeklyTarget}회 달성을 목표로 합니다.`
                    : '설정된 일정에 따라 목표를 진행합니다.'
                  }
                </Text>
                <Text className="text-gray-600 text-sm mt-2">
                  선택한 검증 방법: {(formData?.verificationMethods || []).join(', ')}
                </Text>
              </View>
            </View>
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
