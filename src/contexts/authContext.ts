import { createContext } from "react";

// 用户角色类型
export type UserRole = 'pending' | 'user' | 'admin';

// 用户信息接口
export interface UserInfo {
  id: string;
  username: string;
  nickname: string;
  role: UserRole;
  avatar?: string;
  points: number;
}

// AuthContext接口
interface AuthContextType {
  isAuthenticated: boolean;
  userInfo: UserInfo | null;
  setIsAuthenticated: (value: boolean) => void;
  setUserInfo: (userInfo: UserInfo | null) => void;
  logout: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, nickname: string, password: string, avatar?: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

// 创建默认用户信息
const defaultUserInfo: UserInfo = {
  id: '',
  username: '',
  nickname: '',
  role: 'pending',
  points: 0
};

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userInfo: defaultUserInfo,
  setIsAuthenticated: (_value: boolean) => { },
  setUserInfo: (_userInfo: UserInfo | null) => { },
  logout: () => { },
  login: async (_username: string, _password: string) => false,
  register: async (_username: string, _nickname: string, _password: string, _avatar?: string) => false,
  refreshUser: async () => { }
});