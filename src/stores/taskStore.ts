// 任务状态管理Store
import { create } from 'zustand';
import { Task, TaskCreate, TaskUpdate, TaskListResponse } from '@/types/task';
import { api } from '@/lib/api';

interface TaskState {
  tasks: Task[];
  currentTask: Task | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchTasks: (params?: any) => Promise<void>;
  fetchTaskById: (id: string) => Promise<void>;
  createTask: (taskData: TaskCreate) => Promise<void>;
  updateTask: (id: string, taskData: TaskUpdate) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTaskStatus: (id: string, enabled: boolean) => Promise<void>;
  triggerTask: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  currentTask: null,
  loading: false,
  error: null,

  fetchTasks: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get<TaskListResponse>('/tasks', { params });
      set({ tasks: response.items, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchTaskById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get<{ success: boolean; data: Task }>(`/tasks/${id}`);
      set({ currentTask: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createTask: async (taskData: TaskCreate) => {
    set({ loading: true, error: null });
    try {
      await api.post('/tasks', taskData);
      await get().fetchTasks();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateTask: async (id: string, taskData: TaskUpdate) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/tasks/${id}`, taskData);
      await get().fetchTasks();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteTask: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/tasks/${id}`);
      await get().fetchTasks();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateTaskStatus: async (id: string, enabled: boolean) => {
    set({ loading: true, error: null });
    try {
      const endpoint = enabled ? `/tasks/${id}/enable` : `/tasks/${id}/disable`;
      await api.post(endpoint);
      await get().fetchTasks();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  triggerTask: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/tasks/${id}/trigger`);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
