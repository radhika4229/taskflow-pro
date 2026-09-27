import axios from 'axios';
import { Task, TaskStatus, Suggestion, PreviewDelayRequest, PreviewDelayResponse } from '../types';
import { placeholderEngine } from './placeholderEngine';

const rawBaseUrl = (import.meta.env.VITE_API_URL || '').trim();

function resolveBaseUrl(url: string): string {
  if (!url) return '/api';
  const cleaned = url.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(cleaned) && !cleaned.endsWith('/api')) {
    return `${cleaned}/api`;
  }
  return cleaned;
}

const resolvedBaseUrl = resolveBaseUrl(rawBaseUrl);

// Log resolved baseURL on app startup for verification in production
console.log('[TaskFlow Pro] Initialized API Client with baseURL:', resolvedBaseUrl);

const client = axios.create({
  baseURL: resolvedBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

let backendAvailable: boolean | null = null;

function isNetworkOrServerError(err: any): boolean {
  if (!axios.isAxiosError(err)) return true;
  // No response: connection refused, DNS failure, timeout (network error)
  if (!err.response) return true;
  // HTTP status: 404 (endpoint missing / bad route), or 5xx server errors
  const status = err.response.status;
  if (status === 404 || status >= 500) return true;
  return false;
}

export const api = {
  isBackendOnline: (): boolean => backendAvailable === true,

  // Fetch all tasks
  getTasks: async (): Promise<Task[]> => {
    try {
      const response = await client.get<Task[]>('/tasks');
      backendAvailable = true;
      return response.data;
    } catch (err: any) {
      if (isNetworkOrServerError(err)) {
        backendAvailable = false;
        return placeholderEngine.getTasks();
      }
      throw err;
    }
  },

  // Update task status and/or boardPosition
  updateTask: async (
    id: string,
    payload: { status?: TaskStatus; boardPosition?: number }
  ): Promise<Task> => {
    if (backendAvailable === false) {
      return placeholderEngine.updateTask(id, payload);
    }
    try {
      const response = await client.patch<Task>(`/tasks/${id}`, payload);
      backendAvailable = true;
      return response.data;
    } catch (err: any) {
      if (isNetworkOrServerError(err)) {
        backendAvailable = false;
        return placeholderEngine.updateTask(id, payload);
      }
      throw err;
    }
  },

  // Create a new task
  createTask: async (payload: {
    title: string;
    description: string;
    status: TaskStatus;
    startDate?: string;
    endDate?: string;
  }): Promise<Task> => {
    if (backendAvailable === false) {
      return placeholderEngine.createTask(payload);
    }
    try {
      const response = await client.post<Task>('/tasks', payload);
      backendAvailable = true;
      return response.data;
    } catch (err: any) {
      if (isNetworkOrServerError(err)) {
        backendAvailable = false;
        return placeholderEngine.createTask(payload);
      }
      throw err;
    }
  },

  // Add dependency: taskId depends on prerequisiteId
  createDependency: async (taskId: string, prerequisiteId: string): Promise<any> => {
    if (backendAvailable === false) {
      return placeholderEngine.createDependency(taskId, prerequisiteId);
    }
    try {
      const response = await client.post('/dependencies', { taskId, prerequisiteId });
      backendAvailable = true;
      return response.data;
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Always pass 409 cycle errors through so the UI displays the conflict alert
        throw err;
      }
      if (isNetworkOrServerError(err)) {
        backendAvailable = false;
        return placeholderEngine.createDependency(taskId, prerequisiteId);
      }
      throw err;
    }
  },

  // Remove dependency by id
  deleteDependency: async (id: string, taskId?: string): Promise<any> => {
    if (backendAvailable === false) {
      return placeholderEngine.deleteDependency(taskId || id, id);
    }
    try {
      const response = await client.delete(`/dependencies/${id}`, {
        params: taskId ? { taskId, prerequisiteId: id } : { prerequisiteId: id },
        data: taskId ? { taskId, prerequisiteId: id } : undefined,
      });
      backendAvailable = true;
      return response.data;
    } catch (err: any) {
      if (isNetworkOrServerError(err)) {
        backendAvailable = false;
        return placeholderEngine.deleteDependency(taskId || id, id);
      }
      throw err;
    }
  },

  // Trigger AI suggestions for a task
  getSuggestions: async (taskId: string): Promise<Suggestion[]> => {
    if (backendAvailable === false) {
      return placeholderEngine.getSuggestions(taskId);
    }
    try {
      const response = await client.post<Suggestion[]>(`/tasks/${taskId}/suggestions`);
      backendAvailable = true;
      return response.data;
    } catch (err: any) {
      if (isNetworkOrServerError(err)) {
        backendAvailable = false;
        return placeholderEngine.getSuggestions(taskId);
      }
      throw err;
    }
  },

  // Accept an AI suggested dependency
  acceptSuggestion: async (suggestionId: string): Promise<any> => {
    if (backendAvailable === false) {
      return { success: true };
    }
    try {
      const response = await client.post(`/suggestions/${suggestionId}/accept`);
      backendAvailable = true;
      return response.data;
    } catch (err: any) {
      if (isNetworkOrServerError(err)) {
        backendAvailable = false;
        return { success: true };
      }
      throw err;
    }
  },

  // Reject an AI suggested dependency
  rejectSuggestion: async (suggestionId: string): Promise<any> => {
    if (backendAvailable === false) {
      return { success: true };
    }
    try {
      const response = await client.post(`/suggestions/${suggestionId}/reject`);
      backendAvailable = true;
      return response.data;
    } catch (err: any) {
      if (isNetworkOrServerError(err)) {
        backendAvailable = false;
        return { success: true };
      }
      throw err;
    }
  },

  // Get critical path task IDs from backend
  getCriticalPath: async (): Promise<string[]> => {
    if (backendAvailable === false) {
      return placeholderEngine.getCriticalPath();
    }
    try {
      const response = await client.get<string[]>('/critical-path');
      backendAvailable = true;
      return response.data;
    } catch (err: any) {
      if (isNetworkOrServerError(err)) {
        backendAvailable = false;
        return placeholderEngine.getCriticalPath();
      }
      throw err;
    }
  },

  // What-If Delay Preview
  previewTaskDelay: async (
    taskId: string,
    payload: PreviewDelayRequest
  ): Promise<PreviewDelayResponse> => {
    if (backendAvailable === false) {
      return placeholderEngine.previewTaskDelay(taskId, payload);
    }
    try {
      const response = await client.post<PreviewDelayResponse>(
        `/tasks/${taskId}/preview`,
        payload
      );
      backendAvailable = true;
      return response.data;
    } catch (err: any) {
      if (isNetworkOrServerError(err)) {
        backendAvailable = false;
        return placeholderEngine.previewTaskDelay(taskId, payload);
      }
      throw err;
    }
  },

  // Returns the resolved API base URL
  getBaseUrl: (): string => resolvedBaseUrl,
};

/**
 * Extracts a user-friendly, guaranteed string error message from any API error.
 * Guaranteed never to return a raw object, ensuring crash resilience against React error #31.
 */
export function extractErrorMessage(err: unknown): string {
  if (!err) return 'An unexpected error occurred';
  if (typeof err === 'string') return err.trim() || 'An error occurred';

  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    if (data) {
      if (typeof data === 'string' && data.trim()) {
        return data;
      }
      if (typeof data.error === 'string' && data.error.trim()) {
        return data.error;
      }
      if (data.error && typeof data.error === 'object') {
        if (typeof data.error.message === 'string') return data.error.message;
        if (typeof data.error.code === 'string') return `API Error: ${data.error.code}`;
      }
      if (typeof data.message === 'string' && data.message.trim()) {
        return data.message;
      }
      if (typeof data.title === 'string' && data.title.trim()) {
        return data.title;
      }
    }
    if (err.response?.status === 409) {
      return 'Circular dependency detected. This dependency would create a cycle and was rejected.';
    }
    if (err.response?.status === 404) {
      return 'Backend API endpoint not found (404). Check API URL configuration.';
    }
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message;
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.code === 'string' || typeof obj.code === 'number') {
      return `Error (${obj.code})`;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return 'An unexpected error occurred';
    }
  }

  return String(err);
}
