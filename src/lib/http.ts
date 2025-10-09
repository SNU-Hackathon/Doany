/**
 * HTTP Client for DoAny API v1.3
 * 
 * Features:
 * - Automatic mock routing when USE_API_MOCKS=true
 * - Optional Authorization header injection
 * - Retry logic for 429 (rate limit) with Retry-After
 * - Request/response logging in development
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiConfig, isMockMode } from '../config/api';
import { resolveMock } from '../mocks/resolver';
import { getAuthorizationHeader } from './token';

/**
 * Create axios instance with base configuration
 */
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: apiConfig.baseURL,
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  // Request interceptor: Add auth header if available
  instance.interceptors.request.use(
    (config) => {
      const authHeader = getAuthorizationHeader();
      if (authHeader) {
        config.headers.Authorization = authHeader;
      }

      // Log requests in development
      if (__DEV__) {
        console.log(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data,
        });
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: Log responses and handle errors
  instance.interceptors.response.use(
    (response) => {
      if (__DEV__) {
        console.log(`[HTTP] ${response.status} ${response.config.url}`, {
          data: response.data,
        });
      }
      return response;
    },
    async (error: AxiosError) => {
      if (__DEV__) {
        console.error(`[HTTP] Error ${error.response?.status} ${error.config?.url}`, {
          error: error.response?.data,
        });
      }

      // Handle 429 Rate Limit with Retry-After
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const retryDelayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;

        if (__DEV__) {
          console.log(`[HTTP] Rate limited. Retrying after ${retryDelayMs}ms...`);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        return instance.request(error.config!);
      }

      // Log hint for 401 in development
      if (error.response?.status === 401 && __DEV__) {
        console.warn(
          '[HTTP] 401 Unauthorized - No token available. ' +
          'Either enable USE_API_MOCKS or wire authentication.'
        );
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

/**
 * Main axios instance
 */
const axiosInstance = createAxiosInstance();

/**
 * HTTP Client with mock support
 */
export const httpClient = {
  /**
   * GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    // Route to mock if enabled
    if (isMockMode()) {
      return resolveMock('GET', url, config?.params);
    }

    const response: AxiosResponse<T> = await axiosInstance.get(url, config);
    return response.data;
  },

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    // Route to mock if enabled
    if (isMockMode()) {
      return resolveMock('POST', url, data);
    }

    const response: AxiosResponse<T> = await axiosInstance.post(url, data, config);
    return response.data;
  },

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    // Route to mock if enabled
    if (isMockMode()) {
      return resolveMock('PATCH', url, data);
    }

    const response: AxiosResponse<T> = await axiosInstance.patch(url, data, config);
    return response.data;
  },

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    // Route to mock if enabled
    if (isMockMode()) {
      return resolveMock('DELETE', url, config?.params);
    }

    const response: AxiosResponse<T> = await axiosInstance.delete(url, config);
    return response.data;
  },

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    // Route to mock if enabled
    if (isMockMode()) {
      return resolveMock('PUT', url, data);
    }

    const response: AxiosResponse<T> = await axiosInstance.put(url, data, config);
    return response.data;
  },

  /**
   * Get the raw axios instance for advanced use
   */
  getInstance(): AxiosInstance {
    return axiosInstance;
  },
};

/**
 * Type for HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

/**
 * Export for convenience
 */
export default httpClient;

