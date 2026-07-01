import { useState, useCallback, useEffect } from 'react';

export interface UserInfo {
  id: string;
  name: string;
  phone: string;
  email: string;
  vipLevel: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'customerServiceUserId';

export function useUser() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 从 localStorage 恢复 userId，并从服务器加载用户信息
  useEffect(() => {
    const savedUserId = localStorage.getItem(STORAGE_KEY);
    if (savedUserId) {
      fetchUser(savedUserId);
    }
  }, []);

  const fetchUser = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/auth/user/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem(STORAGE_KEY, userId);
        }
      }
    } catch (e) {
      console.error('Failed to fetch user:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (phone: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem(STORAGE_KEY, data.user.id);
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || '登录失败' };
    } catch (e: any) {
      return { success: false, error: e.message || '登录失败' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, phone: string, email?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email }),
      });
      const data = await res.json();
      if (data.userId) {
        // 注册成功后自动登录
        const loginResult = await login(phone);
        return loginResult;
      }
      return { success: false, error: data.error || '注册失败' };
    } catch (e: any) {
      return { success: false, error: e.message || '注册失败' };
    } finally {
      setIsLoading(false);
    }
  }, [login]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getUserId = useCallback(() => {
    return user?.id || localStorage.getItem(STORAGE_KEY) || null;
  }, [user]);

  return {
    user,
    isLoading,
    login,
    register,
    logout,
    fetchUser,
    getUserId,
  };
}
