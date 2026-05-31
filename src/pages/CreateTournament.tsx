import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import {
  Sun,
  Moon,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import AuthGuard from '@/components/AuthGuard';
import TournamentForm, { TournamentFormData } from '@/components/TournamentForm';
import { api } from '@/lib/api';

export default function CreateTournament() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // 处理表单提交
  const handleSubmitTournament = async (formData: TournamentFormData) => {

    try {
      // 模拟API请求延迟
      await new Promise(resolve => setTimeout(resolve, 800));

      // Map to backend format
      const { mapFrontendToBackend } = await import('@/lib/mappers');
      const payload = mapFrontendToBackend(formData);

      await api.post('/matches', payload);

      toast.success('活动创建成功');
      navigate('/admin');
    } catch (error) {
      toast.error('创建活动失败，请重试');
    }
  };

  // 处理取消
  const handleCancel = () => {
    navigate('/admin');
  };

  return (
    <AuthGuard requiredRole="admin">
      <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        {/* 顶部导航 */}
        <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={handleCancel}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <h1 className="text-lg font-bold">创建活动</h1>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-6">
          {/* 提示信息 */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6 text-blue-600 dark:text-blue-300 flex items-start"
          >
            <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">创建活动指南</p>
              <p className="text-sm mt-1">
                预报名状态下无需设置人数限制，正式报名状态下需设置最大人数和候补人数。
              </p>
            </div>
          </motion.div>

          {/* 活动表单 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-6"
          >
            <TournamentForm
              onSubmit={handleSubmitTournament}
              onCancel={handleCancel}
            />
          </motion.div>
        </main>
      </div>
    </AuthGuard>
  );
}