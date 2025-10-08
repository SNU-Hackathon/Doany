// Era state management for character evolution themes
// Follows Apple's principle: Simple, clear state transitions

import { useState } from 'react';
import type { EraKey } from '../assetsMap';

export function useEraState(initial: EraKey = 'basic') {
  const [era, setEra] = useState<EraKey>(initial);
  
  const next = () =>
    setEra((e) => (e === 'basic' ? 'mesozoic' : e === 'mesozoic' ? 'paleolithic' : 'basic'));
  
  const prev = () =>
    setEra((e) => (e === 'basic' ? 'paleolithic' : e === 'paleolithic' ? 'mesozoic' : 'basic'));
  
  return { era, setEra, next, prev };
}

