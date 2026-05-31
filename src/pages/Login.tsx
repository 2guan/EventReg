import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import {
  Trophy,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ArrowLeft
} from 'lucide-react';
import { z } from 'zod';

// 登录表单验证模式
const loginFormSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符'),
  password: z.string().min(3, '密码至少3个字符')
});

type LoginFormData = z.infer<typeof loginFormSchema>;

export default function Login() {
  const { theme, toggleTheme } = useTheme();
  const { login, isAuthenticated } = useContext(AuthContext);
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // 如果已登录，重定向到首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  // 处理表单输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // 清除对应字段的错误
    if (errors[name as keyof LoginFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证表单
    try {
      loginFormSchema.parse(formData);

      // 提交登录请求
      setIsSubmitting(true);
      const success = await login(formData.username, formData.password);
      setIsSubmitting(false);

      if (success) {
        navigate('/');
      }
    } catch (error) {
      setIsSubmitting(false);

      if (error instanceof z.ZodError) {
        // 处理验证错误
        const newErrors: Partial<LoginFormData> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof LoginFormData] = err.message;
          }
        });
        setErrors(newErrors);
      }
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* 顶部导航 */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <h1 className="text-lg font-bold">登录</h1>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-8 flex flex-col items-center">
        {/* Logo 和标题 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10 mt-8"
        >
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-red-500 to-orange-400 p-4 rounded-2xl">
              <Trophy className="h-12 w-12 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
            有熊来集
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            专业的活动报名平台
          </p>
        </motion.div>

        {/* 登录表单 */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* 用户名输入框 */}
          <div className="mb-4">
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-1"
            >
              用户名
            </label>
            <div className="relative">
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={`w-full px-4 py-3 rounded-xl border ${errors.username
                  ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'
                  } bg-white dark:bg-gray-800 focus:outline-none transition-colors`}
                placeholder="请输入用户名"
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-xs text-red-500">{errors.username}</p>
            )}
          </div>

          {/* 密码输入框 */}
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-4 py-3 rounded-xl border ${errors.password
                  ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'
                  } bg-white dark:bg-gray-800 focus:outline-none transition-colors pr-10`}
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password}</p>
            )}
          </div>

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-400 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                登录中...
              </>
            ) : (
              '登录'
            )}
          </button>

          {/* 注册链接 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              还没有账号？
              <Link
                to="/register"
                className="text-red-500 hover:text-red-600 dark:hover:text-red-400 ml-1 font-medium"
              >
                立即注册
              </Link>
            </p>
          </div>
        </motion.form>


      </main>
    </div>
  );
}