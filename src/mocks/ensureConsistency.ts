/**
 * Mock Data Consistency Checker and Fixer
 * 
 * Ensures all goals in list have corresponding detail entries
 */

import goalsList from './goals.list.json';
import goalsDetail from './goals.detail.json';

export function checkConsistency() {
  console.log('=== Mock Data Consistency Check ===\n');

  const listGoalIds = goalsList.items.map(g => g.goalId);
  console.log('Goals in list:', listGoalIds);
  console.log('Detail goalId:', goalsDetail.goalId);
  
  const missing = listGoalIds.filter(id => id !== goalsDetail.goalId);
  if (missing.length > 0) {
    console.warn('⚠️  Missing detail for:', missing);
  } else {
    console.log('✅ All goals have details');
  }
  
  return { listGoalIds, detailGoalId: goalsDetail.goalId, missing };
}

if (require.main === module) {
  checkConsistency();
}
