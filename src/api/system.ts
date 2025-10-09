/**
 * DoAny API v1.3 - System Module
 * 
 * Health check and system status endpoints
 */

import { httpClient } from '@/lib/http';
import { HealthResponse } from './types';

/**
 * Get system health status
 * 
 * @endpoint GET /system/health
 * @returns Health status with timestamp
 * 
 * @example
 * ```json
 * {
 *   "ok": true,
 *   "time": 1609459200000,
 *   "version": "1.3.0"
 * }
 * ```
 */
export async function getHealth(): Promise<HealthResponse> {
  return httpClient.get<HealthResponse>('/system/health');
}

