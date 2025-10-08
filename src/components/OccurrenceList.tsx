/**
 * OccurrenceList Component
 * 
 * Displays schedule occurrences with inline editing capabilities.
 * Uses virtualized list for performance with many occurrences.
 * 
 * Features:
 * - Week-based grouping
 * - Inline time editing
 * - Cancel/Add/Move operations
 * - "Confirm" button to finalize
 */

import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { ScheduleOverride } from '../schemas/goalSpecV2';

export interface OccurrenceItem {
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm
  dayName: string;   // 월요일, 화요일...
  weekNumber: number; // Week number in period
}

interface OccurrenceListProps {
  items: OccurrenceItem[];
  onRetime: (date: string, newTime: string) => void;
  onCancel: (date: string) => void;
  onAdd: (date: string, time: string) => void;
  onMove: (fromDate: string, toDate: string, toTime: string) => void;
  onConfirm: (finalItems: OccurrenceItem[]) => void;
  isConfirmed?: boolean;
}

/**
 * Main OccurrenceList component
 */
export default function OccurrenceList({
  items,
  onRetime,
  onCancel,
  onAdd,
  onMove,
  onConfirm,
  isConfirmed = false
}: OccurrenceListProps) {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OccurrenceItem | null>(null);

  // Group items by week
  const groupedItems = useMemo(() => {
    const groups: Record<number, OccurrenceItem[]> = {};
    
    items.forEach(item => {
      if (!groups[item.weekNumber]) {
        groups[item.weekNumber] = [];
      }
      groups[item.weekNumber].push(item);
    });
    
    return Object.entries(groups)
      .map(([week, items]) => ({
        weekNumber: parseInt(week),
        items: items.sort((a, b) => a.date.localeCompare(b.date))
      }))
      .sort((a, b) => a.weekNumber - b.weekNumber);
  }, [items]);

  // Flatten for FlatList
  const flattenedData = useMemo(() => {
    const result: Array<{ type: 'header' | 'item'; data: any }> = [];
    
    groupedItems.forEach(group => {
      result.push({ type: 'header', data: group.weekNumber });
      group.items.forEach(item => {
        result.push({ type: 'item', data: item });
      });
    });
    
    return result;
  }, [groupedItems]);

  const handleRetime = (item: OccurrenceItem, newTime: string) => {
    onRetime(item.date, newTime);
    setEditingDate(null);
  };

  const handleCancel = (item: OccurrenceItem) => {
    onCancel(item.date);
  };

  const handleConfirm = () => {
    onConfirm(items);
  };

  const renderItem = ({ item: entry }: { item: { type: 'header' | 'item'; data: any } }) => {
    if (entry.type === 'header') {
      return (
        <View className="bg-blue-50 px-4 py-2 mt-2">
          <Text className="text-blue-800 font-semibold text-sm">
            {entry.data}주차
          </Text>
        </View>
      );
    }

    const item = entry.data as OccurrenceItem;
    const isEditing = editingDate === item.date;

    return (
      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <View className="flex-row items-center justify-between">
          {/* Date & Day */}
          <View className="flex-1">
            <Text className="text-gray-900 font-medium text-base">
              {formatDateKorean(item.date)}
            </Text>
            <Text className="text-gray-500 text-sm">
              {item.dayName}
            </Text>
          </View>

          {/* Time */}
          {isEditing ? (
            <TimeEditor
              initialTime={item.time}
              onConfirm={(newTime) => handleRetime(item, newTime)}
              onCancel={() => setEditingDate(null)}
            />
          ) : (
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setEditingDate(item.date)}
                disabled={isConfirmed}
                className={`px-4 py-2 rounded-lg ${isConfirmed ? 'bg-gray-100' : 'bg-blue-50'}`}
              >
                <Text className={`font-semibold text-lg ${isConfirmed ? 'text-gray-500' : 'text-blue-700'}`}>
                  {item.time}
                </Text>
              </TouchableOpacity>

              {/* Cancel button */}
              {!isConfirmed && (
                <TouchableOpacity
                  onPress={() => handleCancel(item)}
                  className="ml-2 p-2 bg-red-50 rounded-full"
                >
                  <Text className="text-red-600 font-bold text-sm">✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <View className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-lg font-semibold text-gray-900">일정 미리보기</Text>
            <Text className="text-sm text-gray-600 mt-1">
              총 {items.length}회 일정
            </Text>
          </View>
          
          {!isConfirmed && (
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              className="bg-blue-500 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-medium text-sm">+ 추가</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={flattenedData}
        renderItem={renderItem}
        keyExtractor={(item, index) => 
          item.type === 'header' 
            ? `header-week-${item.data}-${index}` 
            : `item-occ-${item.data.date}-${item.data.time}-${index}`
        }
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={20}
        removeClippedSubviews={true}
        style={{ flex: 1 }}
      />

      {/* Confirm Button */}
      {!isConfirmed && (
        <View className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <TouchableOpacity
            onPress={handleConfirm}
            className="bg-green-500 py-3 rounded-lg"
          >
            <Text className="text-white text-center font-semibold text-base">
              이 일정으로 확정
            </Text>
          </TouchableOpacity>
          <Text className="text-xs text-gray-500 text-center mt-2">
            확정 후에는 수정할 수 없습니다
          </Text>
        </View>
      )}

      {/* Confirmed State */}
      {isConfirmed && (
        <View className="px-4 py-3 bg-green-50 border-t border-green-200">
          <Text className="text-green-700 text-center font-medium">
            ✓ 일정이 확정되었습니다
          </Text>
        </View>
      )}

      {/* Add Modal */}
      <AddOccurrenceModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={(date, time) => {
          onAdd(date, time);
          setShowAddModal(false);
        }}
      />
    </View>
  );
}

/**
 * Inline Time Editor
 */
function TimeEditor({
  initialTime,
  onConfirm,
  onCancel
}: {
  initialTime: string;
  onConfirm: (time: string) => void;
  onCancel: () => void;
}) {
  const [hours, minutes] = initialTime.split(':').map(Number);
  const [selectedHours, setSelectedHours] = useState(hours);
  const [selectedMinutes, setSelectedMinutes] = useState(minutes);

  const handleConfirm = () => {
    const timeStr = `${String(selectedHours).padStart(2, '0')}:${String(selectedMinutes).padStart(2, '0')}`;
    onConfirm(timeStr);
  };

  return (
    <View className="flex-row items-center bg-blue-100 px-3 py-2 rounded-lg">
      {/* Hour selector */}
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => setSelectedHours(Math.max(0, selectedHours - 1))}
          className="px-2 py-1"
        >
          <Text className="text-blue-700 font-bold">▲</Text>
        </TouchableOpacity>
        <Text className="text-blue-900 font-bold text-lg mx-2 w-8 text-center">
          {String(selectedHours).padStart(2, '0')}
        </Text>
        <TouchableOpacity
          onPress={() => setSelectedHours(Math.min(23, selectedHours + 1))}
          className="px-2 py-1"
        >
          <Text className="text-blue-700 font-bold">▼</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-blue-900 font-bold text-lg mx-1">:</Text>

      {/* Minute selector */}
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => setSelectedMinutes(Math.max(0, selectedMinutes - 15))}
          className="px-2 py-1"
        >
          <Text className="text-blue-700 font-bold">▲</Text>
        </TouchableOpacity>
        <Text className="text-blue-900 font-bold text-lg mx-2 w-8 text-center">
          {String(selectedMinutes).padStart(2, '0')}
        </Text>
        <TouchableOpacity
          onPress={() => setSelectedMinutes(Math.min(45, selectedMinutes + 15))}
          className="px-2 py-1"
        >
          <Text className="text-blue-700 font-bold">▼</Text>
        </TouchableOpacity>
      </View>

      {/* Confirm/Cancel buttons */}
      <TouchableOpacity
        onPress={handleConfirm}
        className="ml-2 bg-blue-600 px-3 py-1 rounded"
      >
        <Text className="text-white font-medium text-sm">✓</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onCancel}
        className="ml-1 bg-gray-400 px-3 py-1 rounded"
      >
        <Text className="text-white font-medium text-sm">✕</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Add Occurrence Modal
 */
function AddOccurrenceModal({
  visible,
  onClose,
  onAdd
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (date: string, time: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');

  const handleAdd = () => {
    if (selectedDate) {
      onAdd(selectedDate, selectedTime);
      setSelectedDate('');
      setSelectedTime('09:00');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <View className="bg-white rounded-lg p-6 w-full max-w-md">
          <Text className="text-xl font-semibold text-gray-900 mb-4">
            일정 추가
          </Text>

          <Text className="text-sm text-gray-600 mb-2">날짜 (YYYY-MM-DD)</Text>
          <View className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 mb-4">
            <Text className="text-gray-900">
              {selectedDate || '날짜를 선택하세요'}
            </Text>
            {/* Note: In production, use a proper date picker */}
          </View>

          <Text className="text-sm text-gray-600 mb-2">시간</Text>
          <View className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 mb-6">
            <Text className="text-gray-900">{selectedTime}</Text>
            {/* Note: In production, use TimeEditor component */}
          </View>

          <View className="flex-row justify-end">
            <TouchableOpacity
              onPress={onClose}
              className="px-4 py-2 mr-2"
            >
              <Text className="text-gray-600 font-medium">취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAdd}
              disabled={!selectedDate}
              className={`px-4 py-2 rounded-lg ${selectedDate ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              <Text className={`font-medium ${selectedDate ? 'text-white' : 'text-gray-500'}`}>
                추가
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Format date to Korean format
 */
function formatDateKorean(dateStr: string): string {
  // YYYY-MM-DD → M월 D일
  const [year, month, day] = dateStr.split('-');
  return `${parseInt(month)}월 ${parseInt(day)}일`;
}

/**
 * Export override builder helper
 */
export function buildOverridesFromEdits(
  original: OccurrenceItem[],
  current: OccurrenceItem[]
): ScheduleOverride[] {
  const overrides: ScheduleOverride[] = [];
  
  // Find cancellations
  original.forEach(orig => {
    if (!current.find(curr => curr.date === orig.date)) {
      overrides.push({ kind: 'cancel', date: orig.date });
    }
  });
  
  // Find additions and retimes
  current.forEach(curr => {
    const orig = original.find(o => o.date === curr.date);
    
    if (!orig) {
      // New occurrence
      overrides.push({ kind: 'add', date: curr.date, time: curr.time });
    } else if (orig.time !== curr.time) {
      // Time changed
      overrides.push({ kind: 'retime', date: curr.date, time: curr.time });
    }
  });
  
  return overrides;
}

