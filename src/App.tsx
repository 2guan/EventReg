import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Tournaments from "@/pages/Tournaments";
import TournamentDetail from "@/pages/TournamentDetail";
// MyTournaments已移除
import MyScores from "@/pages/MyScores";
import Rankings from "@/pages/Rankings";
import Admin from "@/pages/Admin";
import AdminUsers from "@/pages/AdminUsers";
import CreateTournament from "@/pages/CreateTournament";
import EditTournament from "@/pages/EditTournament";
import ActivityLog from "@/pages/ActivityLog";
import BannerConfig from "@/pages/BannerConfig";
import CacheCleanup from "@/pages/CacheCleanup";
import { useState } from "react";
import { AuthContext, UserInfo } from '@/contexts/authContext';
import { toast } from 'sonner';

import { api } from '@/lib/api';

// mockUsers removed

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // 登录功能
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await api.post('/auth/login', { username, password });

      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setUserInfo(data.user);

        localStorage.setItem('token', data.token);
        // localStorage.setItem('isAuthenticated', 'true'); // No longer needed as primary source

        toast.success('登录成功！');
        return true;
      } else {
        const err = await res.json();
        toast.error(err.error || '用户名或密码错误');
        return false;
      }
    } catch (error: any) {
      toast.error(error.message || '登录失败，请重试');
      return false;
    }
  };

  // 注册功能
  const register = async (username: string, nickname: string, password: string, avatar?: string): Promise<boolean> => {
    try {
      const res = await api.post('/auth/register', { username, nickname, password, avatar });

      if (res.ok) {
        toast.success('注册成功，请登录');
        return true;
      } else {
        const err = await res.json();
        toast.error(err.error || '注册失败');
        return false;
      }
    } catch (error: any) {
      toast.error(error.message || '注册失败，请重试');
      return false;
    }
  };

  const refreshUser = async () => {
    try {
      const user = await api.get('/auth/me');
      setUserInfo(user);
    } catch (err) {
      console.error('Failed to refresh user info', err);
    }
  };

  // 登出功能
  const logout = () => {
    setIsAuthenticated(false);
    setUserInfo(null);
    localStorage.removeItem('token');
    toast.info('已退出登录');
  };

  // 初始化时检查Token
  useState(() => {
    const token = localStorage.getItem('token');

    if (token) {
      api.get('/auth/me')
        .then(user => {
          setIsAuthenticated(true);
          setUserInfo(user);
        })
        .catch(err => {
          console.error('Failed to fetch user info', err);
          logout(); // Invalid token
        });
    }
  });

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userInfo,
        setIsAuthenticated,
        setUserInfo,
        logout,
        login,
        register,
        refreshUser
      }}
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        {/* 我的报名页面已移除 */}
        <Route path="/my-scores" element={<MyScores />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/log" element={<ActivityLog />} />
        <Route path="/admin/banners" element={<BannerConfig />} />
        <Route path="/admin/cleanup" element={<CacheCleanup />} />
        <Route path="/create-tournament" element={<CreateTournament />} />
        <Route path="/edit-tournament/:id" element={<EditTournament />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/other" element={<div className="text-center text-xl py-10">Other Page - Coming Soon</div>} />
      </Routes>
    </AuthContext.Provider>
  );
}
