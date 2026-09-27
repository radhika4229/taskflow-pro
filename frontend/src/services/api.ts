import axios, { AxiosError } from 'axios';
import { Task, TaskStatus, Suggestion, ApiErrorResponse, PreviewDelayRequest, PreviewDelayResponse } from '../types';
import { placeholderEngine } from './placeholderEngine';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 3000,
});

let backendAvailable: boolean | null = null;

function isNetworkOrServerError(err: any): boolean {
  if (!axios.isAxiosError(err)) return true;
  // No response: connection refused, DNS failure, timeout
  if (!err.response) return true;
  // 502/503/504: Vite proxy unable to connect to localhost:8080
  if ([502, 503, 504].includes(err.response.status)) return true;
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
};

/**
 * Extracts a user-friendly error message from an API error response.
 * Specifically checks for 409 cycle conflict { error: "..." }.
 */
export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const axiosError = err as AxiosError<ApiErrorResponse>;
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error;
    }
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    if (axiosError.response?.status === 409) {
      return 'Circular dependency detected. This dependency would create a cycle and was rejected.';
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred';
}
