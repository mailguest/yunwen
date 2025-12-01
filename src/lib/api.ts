// API客户端配置

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';

class ApiClient {
  public client: AxiosInstance;

  constructor() {
    const envBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
    const isAbs = /^https?:\/\//i.test(envBase);
    this.client = axios.create({
      baseURL: isAbs ? envBase : '',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response) {
          const { status, data, config } = error.response;
          
          switch (status) {
            case 401:
              // 登录接口的401在页面内处理，不做全局跳转
              if (config?.url && String(config.url).includes('/auth/login')) {
                const msg = (data && (data.detail || data.message)) || '登录失败，请检查用户名和密码';
                toast.error(msg);
                console.error('未授权错误', { url: config?.url, data });
                break;
              }
              // 其他接口401：清除token并跳转到登录页
              useAuthStore.getState().logout();
              toast.error('登录已过期，请重新登录');
              console.error('未授权错误', { url: config?.url, data });
              window.location.href = '/login';
              break;
            case 403:
              toast.error('权限不足');
              console.error('权限不足', { url: config?.url, data });
              break;
            case 404:
              toast.error('请求的资源不存在');
              console.error('请求的资源不存在', { url: config?.url, data });
              break;
            case 422:
              // 验证错误
              if (data.detail) {
                toast.error(data.detail);
                console.error('验证错误', { url: config?.url, detail: data.detail });
              } else if (data.message) {
                toast.error(data.message);
                console.error('验证错误', { url: config?.url, message: data.message });
              }
              break;
            case 500:
              toast.error('服务器内部错误');
              console.error('服务器内部错误', { url: config?.url, data });
              break;
            default:
              if (data.detail) {
                toast.error(data.detail);
                console.error('请求失败', { url: config?.url, detail: data.detail });
              } else if (data.message) {
                toast.error(data.message);
                console.error('请求失败', { url: config?.url, message: data.message });
              } else {
                toast.error('请求失败');
                console.error('请求失败', { url: config?.url, data });
              }
          }
        } else if (error.request) {
          toast.error('网络连接失败');
          console.error('网络连接失败', error);
        } else {
          toast.error('请求配置错误');
          console.error('请求配置错误', error);
        }
        
        return Promise.reject(error);
      }
    );
  }

  private async requestWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: any
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn()
      } catch (e) {
        lastErr = e
        if (i < attempts - 1) await new Promise(r => setTimeout(r, Math.min(500 * (i + 1), 2000)))
      }
    }
    throw lastErr
  }

  private normalizeUrl(u: string): string {
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('/api/')) return u;
    if (u.startsWith('/')) return `/api${u}`;
    return u;
  }

  // GET请求
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.requestWithRetry(async () => {
      const response = await this.client.get<T>(this.normalizeUrl(url), config)
      return response.data
    })
  }

  // POST请求
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(this.normalizeUrl(url), data, config);
    return response.data;
  }

  // PUT请求
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(this.normalizeUrl(url), data, config);
    return response.data;
  }

  // DELETE请求
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(this.normalizeUrl(url), config);
    return response.data;
  }

  // PATCH请求
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(this.normalizeUrl(url), data, config);
    return response.data;
  }

  // 上传文件
  async upload<T>(url: string, file: File, onUploadProgress?: (progressEvent: any) => void): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });

    return response.data;
  }
}

// 创建API客户端实例
export const api = new ApiClient();

// 导出类型
export type { AxiosResponse, AxiosRequestConfig };
