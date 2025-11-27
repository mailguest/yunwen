// 工具函数

import { format, parseISO, isValid } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并类名
 * @param inputs - 类名数组
 * @returns 合并后的类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化日期时间
 * @param date - 日期字符串或Date对象
 * @param formatStr - 格式字符串，默认为 'yyyy-MM-dd HH:mm:ss'
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: string | Date, formatStr: string = 'yyyy-MM-dd HH:mm:ss'): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  if (!isValid(dateObj)) {
    return '';
  }
  
  return format(dateObj, formatStr, { locale: zhCN });
}

/**
 * 格式化相对时间
 * @param date - 日期字符串或Date对象
 * @returns 相对时间描述，如"刚刚"、"5分钟前"等
 */
export function formatRelativeTime(date: string | Date): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return '刚刚';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}分钟前`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}小时前`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}天前`;
  } else {
    return formatDate(dateObj, 'yyyy-MM-dd');
  }
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @returns 格式化后的文件大小，如"1.5MB"、"2GB"等
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化持续时间
 * @param seconds - 秒数
 * @returns 格式化后的持续时间，如"2分30秒"、"1小时15分"等
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 
      ? `${minutes}分${remainingSeconds}秒`
      : `${minutes}分`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return remainingMinutes > 0
      ? `${hours}小时${remainingMinutes}分`
      : `${hours}小时`;
  }
}

/**
 * 复制文本到剪贴板
 * @param text - 要复制的文本
 * @returns Promise<boolean> - 复制成功返回true，失败返回false
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        return true;
      } catch (err) {
        console.error('复制失败:', err);
        return false;
      } finally {
        document.body.removeChild(textArea);
      }
    }
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
}

/**
 * 生成随机字符串
 * @param length - 字符串长度
 * @returns 随机字符串
 */
export function generateRandomString(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 验证邮箱格式
 * @param email - 邮箱地址
 * @returns 是否有效
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证手机号格式（中国大陆）
 * @param phone - 手机号
 * @returns 是否有效
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * 防抖函数
 * @param func - 要执行的函数
 * @param wait - 等待时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * 节流函数
 * @param func - 要执行的函数
 * @param limit - 时间限制（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 下载文件
 * @param content - 文件内容
 * @param filename - 文件名
 * @param contentType - 文件类型
 */
export function downloadFile(
  content: string | Blob,
  filename: string,
  contentType: string = 'text/plain'
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * 等待指定时间
 * @param ms - 等待时间（毫秒）
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 判断是否为JSON字符串
 * @param str - 字符串
 * @returns 是否为JSON格式
 */
export function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 安全的JSON解析
 * @param str - JSON字符串
 * @param defaultValue - 默认值
 * @returns 解析结果或默认值
 */
export function safeJsonParse<T = any>(str: string, defaultValue: T = {} as T): T {
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * 深拷贝对象
 * @param obj - 要拷贝的对象
 * @returns 深拷贝后的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

/**
 * 获取URL参数
 * @param name - 参数名
 * @param url - URL（可选，默认为当前页面URL）
 * @returns 参数值
 */
export function getUrlParam(name: string, url: string = window.location.href): string | null {
  const urlObj = new URL(url);
  return urlObj.searchParams.get(name);
}

/**
 * 设置URL参数
 * @param name - 参数名
 * @param value - 参数值
 * @param url - URL（可选，默认为当前页面URL）
 * @returns 新的URL
 */
export function setUrlParam(name: string, value: string, url: string = window.location.href): string {
  const urlObj = new URL(url);
  urlObj.searchParams.set(name, value);
  return urlObj.toString();
}