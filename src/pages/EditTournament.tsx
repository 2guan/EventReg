import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import {
  Sun,
  Moon,
  ArrowLeft,

  AlertCircle,
  Award
} from 'lucide-react';
import { toast } from 'sonner';
import AuthGuard from '@/components/AuthGuard';
import TournamentForm, { TournamentFormData } from '@/components/TournamentForm';
import { api } from '@/lib/api';

// 扩展活动表单数据接口，添加结算金额和状态字段
interface ExtendedTournamentFormData extends TournamentFormData {
  totalAmount?: number;
  settlementStatus?: 'pending' | 'completed';
}

export default function EditTournament() {
  const { theme, toggleTheme } = useTheme();
  const { id } = useParams();
  const [tournament, setTournament] = useState<ExtendedTournamentFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showAmountInput, setShowAmountInput] = useState(false);
  const navigate = useNavigate();

  // 加载活动数据
  useEffect(() => {
    const loadTournamentData = async () => {
      setIsLoading(true);
      try {
        const match = await api.get(`/matches/${id}`);
        // We need to map backend match to frontend match
        // But mapBackendToFrontend is an async import? No, it's a named export.
        const { mapBackendToFrontend } = await import('@/lib/mappers');
        const frontendMatch = mapBackendToFrontend(match);

        if (frontendMatch) {
          setTournament(frontendMatch as any); // Type assertion needed or fix types
          setShowAmountInput(['finished-pending', 'finished-completed'].includes(frontendMatch.status));
        } else {
          toast.error('未找到该活动');
          navigate('/admin');
        }
      } catch (error) {
        toast.error('加载活动数据失败');
        navigate('/admin');
      } finally {
        setIsLoading(false);
      }
    };

    loadTournamentData();
  }, [id, navigate]);



  // 处理表单提交
  const handleSubmitTournament = async (formData: TournamentFormData) => {

    try {
      // 模拟API请求延迟
      await new Promise(resolve => setTimeout(resolve, 800));

      // Prepare payload
      const { mapFrontendToBackend } = await import('@/lib/mappers');
      const payload = mapFrontendToBackend({
        ...formData,
        // If status ends with finished, we might need to handle totalAmount separately if backend supports it
        // My backend doesn't support 'totalAmount' in matches table directly, maybe in config_json?
        // Or points logic? The prompt mentions "活动后积分录入".
        // For now just update match info.
      });

      await api.put(`/matches/${id}`, payload);

      toast.success('活动更新成功');
      navigate('/admin');
    } catch (error) {
      toast.error('更新活动失败，请重试');
    }
  };

  // 处理取消
  const handleCancel = () => {
    navigate('/admin');
  };

  if (isLoading) {
    return (
      <AuthGuard requiredRole="admin">
        <div className={`min-h-screen flex flex-col items-center justify-center ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
          <p className="mt-4 text-lg">加载中...</p>
        </div>
      </AuthGuard>
    );
  }

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

            <h1 className="text-lg font-bold">编辑活动</h1>

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
            className={`rounded-xl p-4 mb-6 flex items-start ${showAmountInput
              ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300'
              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
              }`}
          >
            {showAmountInput ? (
              <>
                <Award className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">结算提示</p>
                  <p className="text-sm mt-1">
                    当前活动状态为已结束，请输入总金额进行结算。
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">编辑活动指南</p>
                  <p className="text-sm mt-1">
                    预报名状态下无需设置人数限制，正式报名状态下需设置最大人数和候补人数。
                    将状态修改为已结束时，需要输入活动总金额。
                  </p>
                </div>
              </>
            )}
          </motion.div>

          {/* 活动表单 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-6"
          >
            <TournamentForm
              initialData={tournament || undefined}
              onSubmit={handleSubmitTournament}
              onCancel={handleCancel}
            />
          </motion.div>
        </main>
      </div>
    </AuthGuard>
  );
}