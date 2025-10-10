# Schema Normalization Report

**Date**: 2025-10-09  
**Purpose**: Align all fields with `src/api/types.ts` canonical schema

---

## 🔍 Detected Legacy Keys

### **1. Date Fields (15+ occurrences)**
| Legacy Key | New Key | Type | Files |
|------------|---------|------|-------|
| `startDate` | `startAt` | `number \| string` | CreateGoalModal.tsx (15+) |
| `endDate` | `endAt` | `number \| string` | CreateGoalModal.tsx (10+) |

**Action**: Replace `startDate` → `startAt`, `endDate` → `endAt`

---

### **2. User ID (1 occurrence)**
| Legacy Key | New Key | Type | Files |
|------------|---------|------|-------|
| `user.uid` | `user.id` | `string` | ProfileScreen.tsx:248 |

**Action**: Replace `user.uid` → `user.id`

---

### **3. Status Values (10+ occurrences)**
| Legacy Value | New Value | Type | Files |
|--------------|-----------|------|-------|
| `'completed'` | `'complete'` | `QuestState \| GoalState` | GoalDetailScreenV2, QuestDetailList, QuestMapView |
| `quest.status` | `quest.state` | `QuestState` | Multiple quest components |

**Action**: 
- Replace status string `'completed'` → `'complete'`
- Replace field `status` → `state` where applicable

---

### **4. Quest Fields**
| Legacy Field | New Field | Type | Files |
|--------------|-----------|------|-------|
| `quest.status` | `quest.state` | `'complete' \| 'fail' \| 'onTrack'` | Quest components |

---

## 🗺️ Normalization Mapping

### **Goal/Quest State**
```typescript
// Legacy
status: 'completed' | 'failed' | 'ontrack'

// API v1.3
state: 'complete' | 'fail' | 'onTrack'
```

### **Date Fields**
```typescript
// Legacy
duration: {
  startDate: string,  // ISO date string
  endDate: string
}

// API v1.3
{
  startAt: number | string,  // epoch or ISO
  endAt: number | string
}
```

### **User ID**
```typescript
// Legacy
user.uid: string

// API v1.3
user.id: string
```

---

## 📋 Required Changes

### **High Priority (Breaking)**
1. ✅ ProfileScreen.tsx:248
   - Change: `user.uid` → `user.id`

2. ✅ CreateGoalModal.tsx (15+ locations)
   - Change: All `startDate` → `startAt`
   - Change: All `endDate` → `endAt`

### **Medium Priority (Display)**
3. ✅ GoalDetailScreenV2.tsx
   - Change: `quest.status === 'completed'` → `quest.state === 'complete'`
   - Verify: Uses `state` field consistently

4. ✅ QuestDetailList.tsx, QuestMapView.tsx
   - Change: `quest.status` → `quest.state`
   - Change: `'completed'` → `'complete'`

---

## ✅ Validation Steps

After normalization:
- [ ] No `startDate` in src/ (except comments)
- [ ] No `endDate` in src/ (except comments)
- [ ] No `user.uid` in src/
- [ ] No `status === 'completed'` in src/
- [ ] TypeScript compiles
- [ ] App runs with mocks

---

**Total Changes Required**: ~40 replacements across 5-6 files

