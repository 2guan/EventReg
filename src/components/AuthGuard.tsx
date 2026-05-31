import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'admin';
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { isAuthenticated, userInfo } = useContext(AuthContext);
  const location = useLocation();

  // 如果未登录，重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 如果需要特定角色，检查用户角色
  if (requiredRole && userInfo && userInfo.role !== requiredRole) {
    // 如果用户角色不足，重定向到首页
    return <Navigate to="/" replace />;
  }

  // 用户已登录且角色符合要求，渲染子组件
  return <>{children}</>;
}