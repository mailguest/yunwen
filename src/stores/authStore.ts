// 认证状态管理Store
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LoginRequest, LoginResponse } from '@/types';
import { api } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      login: async (credentials: LoginRequest) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post<LoginResponse>('/auth/login', credentials);
          const { user, access_token } = response;
          
          set({
            user,
            token: access_token,
            isAuthenticated: true,
            loading: false,
          });
          
          // 设置默认请求头
          api.client.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        } catch (error: any) {
          set({
            error: error.message,
            loading: false,
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
        
        // 清除请求头中的token
        delete api.client.defaults.headers.common['Authorization'];
      },

      checkAuth: async () => {
        const token = get().token;
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        set({ loading: true });
        try {
          // 验证token有效性
          const response: any = await api.get<any>('/auth/me');
          set({
            user: (response && (response.user || response)) as User,
            isAuthenticated: true,
            loading: false,
          });
        } catch (error: any) {
          // Token无效，清除认证状态
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            loading: false,
          });
          delete api.client.defaults.headers.common['Authorization'];
        }
      },

      clearError: () => set({ error: null }),

      updateProfile: async (data: Partial<User>) => {
        set({ loading: true, error: null });
        try {
          const response: any = await api.put<any>('/auth/profile', data);
          set({
            user: (response && (response.user || response)) as User,
            loading: false,
          });
        } catch (error: any) {
          set({
            error: error.message,
            loading: false,
          });
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage', // storage key name
      partialize: (state) => ({ 
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }), // 只持久化这些字段
    }
  )
);

// 初始化时检查认证状态
useAuthStore.getState().checkAuth();
