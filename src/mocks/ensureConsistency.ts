/**
 * Mock Data Consistency Checker and Fixer
 * 
 * Ensures all goals in list have corresponding detail entries
 */

import goalsDetail from './goals.detail.json';
import goalsList from './goals.list.json';

export function checkConsistency() {
  console.log('=== Mock Data Consistency Check ===\n');

  const listGoalIds = goalsList.items.map(g => g.goalId);
  const detailGoalIds = goalsDetail.map(g => g.goalId);
  
  console.log('Goals in list:', listGoalIds);
  console.log('Goals in detail:', detailGoalIds);
  
  const missing = listGoalIds.filter(id => !detailGoalIds.includes(id));
  if (missing.length > 0) {
    console.warn('⚠️  Missing detail for:', missing);
  } else {
    console.log('✅ All goals have details');
  }
  
  return { listGoalIds, detailGoalIds, missing };
}

if (require.main === module) {
  checkConsistency();
}
