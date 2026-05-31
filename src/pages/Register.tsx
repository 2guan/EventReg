import { useState, useContext } from 'react';
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

// 注册表单验证模式
const registerFormSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(20, '用户名最多20个字符'),
  nickname: z.string().min(2, '昵称至少2个字符').max(20, '昵称最多20个字符'),
  password: z.string().min(6, '密码至少6个字符').max(20, '密码最多20个字符'),
  confirmPassword: z.string().min(6, '确认密码至少6个字符'),
  avatar: z.string().optional()
}).refine(data => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword']
});

type RegisterFormData = z.infer<typeof registerFormSchema>;

const AVATAR_COUNT = 30;
const avatars = Array.from({ length: AVATAR_COUNT }, (_, i) => `/sportsreg/face/defaultface-user (${i + 1}).jpg`);

export default function Register() {
  const { theme, toggleTheme } = useTheme();
  const { register } = useContext(AuthContext);
  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    nickname: '',
    password: '',
    confirmPassword: '',
    avatar: '/sportsreg/face/defaultface-user (1).jpg'
  });
  const [errors, setErrors] = useState<Partial<RegisterFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const navigate = useNavigate();

  // 处理表单输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // 清除对应字段的错误
    if (errors[name as keyof RegisterFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSelectAvatar = (avatarUrl: string) => {
    setFormData(prev => ({ ...prev, avatar: avatarUrl }));
    setShowAvatarModal(false);
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证表单
    try {
      registerFormSchema.parse(formData);

      // 提交注册请求
      setIsSubmitting(true);
      const success = await register(formData.username, formData.nickname, formData.password, formData.avatar);
      setIsSubmitting(false);

      if (success) {
        navigate('/login');
      }
    } catch (error) {
      setIsSubmitting(false);

      if (error instanceof z.ZodError) {
        // 处理验证错误
        const newErrors: Partial<RegisterFormData> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof RegisterFormData] = err.message;
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

          <h1 className="text-lg font-bold">注册</h1>

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
          className="text-center mb-8 mt-4"
        >


          <p className="text-gray-500 dark:text-gray-400 mt-1">
            创建账号，开始你的活动之旅
          </p>
        </motion.div>

        {/* 注册表单 */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* 头像选择 */}
          <div className="mb-6 flex flex-col items-center">
            <div className="relative group cursor-pointer" onClick={() => setShowAvatarModal(true)}>
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg">
                <img
                  src={formData.avatar || '/sportsreg/face/defaultface-user (1).jpg'}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-black bg-opacity-30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-bold">更换头像</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">点击头像选择</p>
          </div>

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
                placeholder="请设置用户名（3-20个字符）"
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-xs text-red-500">{errors.username}</p>
            )}
          </div>

          {/* 昵称输入框 */}
          <div className="mb-4">
            <label
              htmlFor="nickname"
              className="block text-sm font-medium mb-1"
            >
              昵称
            </label>
            <div className="relative">
              <input
                type="text"
                id="nickname"
                name="nickname"
                value={formData.nickname}
                onChange={handleChange}
                className={`w-full px-4 py-3 rounded-xl border ${errors.nickname
                  ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'
                  } bg-white dark:bg-gray-800 focus:outline-none transition-colors`}
                placeholder="请设置昵称（2-20个字符）"
              />
            </div>
            {errors.nickname && (
              <p className="mt-1 text-xs text-red-500">{errors.nickname}</p>
            )}
          </div>

          {/* 密码输入框 */}
          <div className="mb-4">
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
                placeholder="请设置密码（6-20个字符）"
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

          {/* 确认密码输入框 */}
          <div className="mb-6">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium mb-1"
            >
              确认密码
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`w-full px-4 py-3 rounded-xl border ${errors.confirmPassword
                  ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'
                  } bg-white dark:bg-gray-800 focus:outline-none transition-colors pr-10`}
                placeholder="请再次输入密码"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
            )}
          </div>

          {/* 头像选择模态框 */}
          {showAvatarModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowAvatarModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-4 sm:p-6 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">选择头像</h3>
                  <button onClick={() => setShowAvatarModal(false)} className="text-gray-500">
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-3">
                  {avatars.map((url, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleSelectAvatar(url)}
                      className={`aspect-square rounded-full overflow-hidden cursor-pointer border-2 ${formData.avatar === url ? 'border-red-500 ring-2 ring-red-200' : 'border-transparent'
                        }`}
                    >
                      <img src={url} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

          {/* 注册按钮 */}
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
                注册中...
              </>
            ) : (
              '注册'
            )}
          </button>

          {/* 登录链接 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              已有账号？
              <Link
                to="/login"
                className="text-red-500 hover:text-red-600 dark:hover:text-red-400 ml-1 font-medium"
              >
                立即登录
              </Link>
            </p>
          </div>
        </motion.form>

        {/* 用户协议 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 w-full max-w-md text-center text-xs text-gray-500 dark:text-gray-400"
        >
          <p>
            点击注册，即表示您同意我们的
            <a href="#" className="text-red-500 hover:underline mx-1">用户协议</a>
            和
            <a href="#" className="text-red-500 hover:underline mx-1">隐私政策</a>
          </p>
        </motion.div>
      </main>
    </div>
  );
}