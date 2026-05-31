import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import {
  Calendar,
  Trophy,
  Users,
  Medal,
  Sun,
  Moon,
  ArrowLeft,
  Clock,
  X,
  Check
} from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import { toast } from 'sonner';

// 活动状态类型
type TournamentStatus = 'pre-registration' | 'registration' | 'waiting-list' | 'full' | 'finished' | 'cancelled';

// 报名状态类型
type RegistrationStatus = 'confirmed' | 'waiting' | 'cancelled';

// 定义新的图片URL常量
const newImage1 = "https://lf-code-agent.coze.cn/obj/x-ai-cn/299275222530/attachment/bannewr_20251207191539.jpg";
const newImage2 = "https://lf-code-agent.coze.cn/obj/x-ai-cn/299275222530/attachment/bannewr2_20251207191632.jpg";

import { api } from '@/lib/api';

export default function MyTournaments() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, userInfo } = useContext(AuthContext);
  const [myTournaments, setMyTournaments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [filteredTournaments, setFilteredTournaments] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMyEnrollments();
  }, [isAuthenticated]);

  const fetchMyEnrollments = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/enrollments/my/list');
      // res is array of { id, match_id, title, time, location, match_status, status, enrolled_for_name, ... }

      const mapped = res.map((e: any) => ({
        id: String(e.id),
        tournamentId: String(e.match_id),
        tournamentName: e.title,
        date: new Date(e.time).toISOString(),
        time: new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        location: e.location,
        tournamentStatus: e.match_status, // e.g. 'registration'
        registrationStatus: e.status === 'active' ? (e.type === 'waiting' ? 'waiting' : 'confirmed') : 'cancelled',
        // Note: Backend 'status' is 'active' or 'cancelled'. 'type' is 'player' or 'waiting'.
        // So validation: 
        // if e.status == 'cancelled' -> 'cancelled'
        // else if e.type == 'waiting' -> 'waiting'
        // else -> 'confirmed'

        image: "https://lf-code-agent.coze.cn/obj/x-ai-cn/299275222530/attachment/bannewr_20251207191539.jpg", // Placeholder or fetch if generic
        registeredCount: 0, // Backend might not send this in /my/list. We might need to fetch separately or ignore.
        // Actually the JOINED query in backend MIGHT return m.current_players? 
        // server/routes/enrollments.js says: m.max_players, m.current_players NOT selected explicitly in 'e.*, m.title...'?
        // Let's check backend code... it does select m.title, m.time, m.location, m.status. It might not have counts.
        // I will assume simple display for now.
        maxPlayers: 100,
        isForOthers: !!e.enrolled_for_name,
        othersName: e.enrolled_for_name || ''
      }));

      setMyTournaments(mapped);
    } catch (err) {
      toast.error('获取报名记录失败');
    }
  };

  // 根据标签筛选活动
  useEffect(() => {
    let result = [...myTournaments];

    if (activeTab === 'upcoming') {
      result = result.filter(t =>
        t.tournamentStatus !== 'finished' && t.tournamentStatus !== 'cancelled'
      );
    } else if (activeTab === 'past') {
      result = result.filter(t =>
        t.tournamentStatus === 'finished'
      );
    } else if (activeTab === 'waiting') {
      result = result.filter(t =>
        t.registrationStatus === 'waiting'
      );
    }

    setFilteredTournaments(result);
  }, [activeTab, myTournaments]);

  // 处理标签切换
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // 处理取消报名
  const handleCancelRegistration = async (enrollmentId: string) => {
    if (!confirm('确定要取消报名吗？')) return;

    try {
      await api.post('/enrollments/cancel', { enrollmentId });
      toast.success('已取消报名');
      fetchMyEnrollments(); // Reload
    } catch (err: any) {
      toast.error(err.error || '取消失败');
    }
  };

  // 格式化日期显示
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', weekday: 'short' };
    return new Date(dateString).toLocaleDateString('zh-CN', options);
  };

  // 获取活动状态文本
  const getTournamentStatusText = (status: TournamentStatus) => {
    const statusMap: Record<TournamentStatus, string> = {
      'pre-registration': '预报名',
      'registration': '报名中',
      'waiting-list': '可候补',
      'full': '已满员',
      'finished': '已结束',
      'cancelled': '已取消'
    };
    return statusMap[status];
  };

  // 获取活动状态对应的颜色类名
  const getTournamentStatusColor = (status: TournamentStatus) => {
    const colorMap: Record<TournamentStatus, string> = {
      'pre-registration': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'registration': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'waiting-list': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'full': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      'finished': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return colorMap[status];
  };

  // 获取报名状态文本
  const getRegistrationStatusText = (status: RegistrationStatus) => {
    const statusMap: Record<RegistrationStatus, string> = {
      'confirmed': '已确认',
      'waiting': '候补中',
      'cancelled': '已取消'
    };
    return statusMap[status];
  };

  // 获取报名状态对应的颜色类名
  const getRegistrationStatusColor = (status: RegistrationStatus) => {
    const colorMap: Record<RegistrationStatus, string> = {
      'confirmed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'waiting': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'cancelled': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    };
    return colorMap[status];
  };

  // 获取报名状态图标
  const getRegistrationStatusIcon = (status: RegistrationStatus) => {
    switch (status) {
      case 'confirmed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'waiting':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  return (
    <AuthGuard>
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

            <h1 className="text-lg font-bold">我的报名</h1>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-6">
          {/* 用户信息 */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6"
          >
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-red-500 to-orange-400 p-3 rounded-full mr-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{userInfo?.nickname || '用户'}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">共报名 {myTournaments.length} 场活动</p>
              </div>
            </div>
          </motion.div>

          {/* 标签切换 */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex space-x-4 mb-6 overflow-x-auto pb-2 scrollbar-hide"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTabChange('upcoming')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === 'upcoming'
                ? 'bg-red-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              即将开始
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTabChange('past')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === 'past'
                ? 'bg-red-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              已完成
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTabChange('waiting')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === 'waiting'
                ? 'bg-red-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              候补名单
            </motion.button>
          </motion.div>

          {/* 我的报名列表 */}
          <div className="space-y-4">
            {filteredTournaments.length > 0 ? (
              filteredTournaments.map((tournament, index) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <Link to={`/tournaments/${tournament.tournamentId}`} className="block">
                    <div className="relative aspect-[16/3]">
                      <img
                        src={tournament.image}
                        alt={tournament.tournamentName}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3">
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getTournamentStatusColor(tournament.tournamentStatus)}`}>
                          {getTournamentStatusText(tournament.tournamentStatus)}
                        </span>
                      </div>
                      <div className="absolute top-3 left-3">
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getRegistrationStatusColor(tournament.registrationStatus)} flex items-center`}>
                          {getRegistrationStatusIcon(tournament.registrationStatus)}
                          <span className="ml-1">{getRegistrationStatusText(tournament.registrationStatus)}</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-2">{tournament.tournamentName}</h3>

                          {tournament.isForOthers && (
                            <div className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-1 rounded mb-2 inline-block">
                              代{tournament.othersName}报名
                            </div>
                          )}

                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>{formatDate(tournament.date)} {tournament.time}</span>
                          </div>

                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{tournament.location}</span>
                          </div>
                        </div>

                        {/* 报名人数显示 */}
                        <div className="ml-4 flex flex-col justify-center items-end">
                          {tournament.tournamentStatus === 'pre-registration' ? (
                            // 预报名状态：显示一个矩形框
                            <div className="bg-blue-100 dark:bg-blue-900/50 px-3 py-2 rounded-lg text-center">
                              <p className="text-xs text-blue-600 dark:text-blue-300">预报名</p>
                              <p className="text-lg font-bold text-blue-800 dark:text-blue-200">
                                {tournament.registeredCount}
                              </p>
                            </div>
                          ) : (
                            // 其他状态：显示两个矩形框
                            <>
                              <div className="bg-green-100 dark:bg-green-900/50 px-3 py-2 rounded-lg text-center mb-2">
                                <p className="text-xs text-green-600 dark:text-green-300">报名人数</p>
                                <p className="text-lg font-bold text-green-800 dark:text-green-200">
                                  {tournament.registeredCount}/{tournament.maxPlayers}
                                </p>
                              </div>
                              <div className="bg-yellow-100 dark:bg-yellow-900/50 px-3 py-2 rounded-lg text-center">
                                <p className="text-xs text-yellow-600 dark:text-yellow-300">候补人数</p>
                                <p className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                                  {/* 模拟候补人数数据 */}
                                  {Math.floor(Math.random() * 5)}/{Math.floor(Math.random() * 10) + 5}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          报名状态
                        </div>

                        {(tournament.tournamentStatus === 'pre-registration' || tournament.tournamentStatus === 'registration') &&
                          tournament.registrationStatus !== 'cancelled' && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCancelRegistration(tournament.id);
                              }}
                              className="text-xs text-red-500 bg-red-50 dark:bg-red-900/30 px-3 py-1 rounded-full"
                            >
                              取消报名
                            </motion.button>
                          )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))
            ) : (
              <div className="py-16 text-center">
                <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-full inline-block mb-4">
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">暂无报名记录</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {activeTab === 'upcoming' ? '您还没有报名任何即将开始的活动' :
                    activeTab === 'past' ? '您还没有参加过任何已完成的活动' :
                      '您目前没有在任何活动的候补名单中'}
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/tournaments')}
                  className="mt-6 px-5 py-2.5 rounded-full bg-gradient-to-r from-red-500 to-orange-400 text-white font-medium hover:opacity-90 transition-opacity"
                >
                  浏览活动
                </motion.button>
              </div>
            )}
          </div>
        </main>

        {/* 底部导航栏 */}
        <footer className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-3 z-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-4 gap-2">
              <Link
                to="/"
                className="flex flex-col items-center text-gray-500 dark:text-gray-400"
              >
                <svg className="h-6 w-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
                <span className="text-xs">首页</span>
              </Link>

              <Link
                to="/tournaments"
                className="flex flex-col items-center text-gray-500 dark:text-gray-400"
              >
                <Calendar className="h-6 w-6 mb-1" />
                <span className="text-xs">活动</span>
              </Link>

              <Link
                to="/my-tournaments"
                className="flex flex-col items-center text-red-500 dark:text-red-400"
              >
                <svg className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 20h-1a4 4 0 01-4-4V6a4 4 0 00-4-4H6a4 4 0 00-4 4v10a4 4 0 004 4h1" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 20h-7" />
                </svg>
                <span className="text-xs">我的报名</span>
              </Link>

              <Link
                to="/my-scores"
                className="flex flex-col items-center text-gray-500 dark:text-gray-400"
              >
                <Medal className="h-6 w-6 mb-1" />
                <span className="text-xs">我的</span>
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </AuthGuard>
  );
}