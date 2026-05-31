import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import {
  Trophy,
  Medal,
  Sun,
  Moon,
  ArrowLeft,
  BarChart2,
  Award,
  Calendar,
  Edit,
  Save,
  X
} from 'lucide-react';
import MessageCenter from '@/components/MessageCenter';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AuthGuard from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

// 积分记录数据类型
interface ScoreRecord {
  id: string;
  tournamentName: string;
  points: number;
  date: string;
  status: 'win' | 'lose' | 'participation';
  totalAmount?: number; // 总金额
  registeredCount?: number; // 报名人数
  myRegistrationCount?: number; // 自己+为他人报名的人数
}

export default function MyScores() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, userInfo, refreshUser } = useContext(AuthContext);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [recentRecords, setRecentRecords] = useState<ScoreRecord[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [currentRank, setCurrentRank] = useState(0);

  // Edit Profile State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [showAvatarSelection, setShowAvatarSelection] = useState(false);

  // Avatars
  const AVATAR_COUNT = 30;
  const avatars = Array.from({ length: AVATAR_COUNT }, (_, i) => `/sportsreg/face/defaultface-user (${i + 1}).jpg`);

  const navigate = useNavigate();
  // ... (useEffect)

  const openEditProfile = () => {
    if (userInfo) {
      setEditNickname(userInfo.nickname);
      setEditAvatar(userInfo.avatar || avatars[0]);
      setEditPassword('');
      setShowEditModal(true);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await api.put('/auth/update', {
        nickname: editNickname,
        avatar: editAvatar,
        password: editPassword || undefined
      });
      toast.success('个人资料更新成功');
      setShowEditModal(false);
      // Reload page or re-fetch user info? 
      // AuthContext might need to be refreshed. 
      // For now, reloading is simplest to update Context, or we ideally update Context.
      // Since we don't have a 'refreshUser' in Context visible here, we might just reload.
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || '更新失败');
    }
  };

  // 1. Refresh user info on mount/auth change
  useEffect(() => {
    if (isAuthenticated) {
      refreshUser();
    }
  }, [isAuthenticated]);

  // 2. Fetch History on mount/auth change
  useEffect(() => {
    fetchMyPoints();
  }, [isAuthenticated]);

  // 3. Update local totalPoints when userInfo updates
  useEffect(() => {
    if (userInfo?.points !== undefined) {
      setTotalPoints(userInfo.points);
    }
  }, [userInfo]);

  const fetchMyPoints = async () => {
    if (!isAuthenticated) return;
    try {
      // refreshUser(); // REMOVED to prevent loop

      // Fetch history
      const historyRes = await api.get('/points/my/history');
      // historyRes should be array of { id, points, reason, created_at, match_title }

      const records = historyRes.map((item: any) => {
        let status: ScoreRecord['status'] = 'participation';

        // Check reason first
        const reason = item.reason || '';

        const val = item.amount !== undefined ? item.amount : item.points; // Support both

        if (reason.includes('活动得分')) {
          status = 'participation';
        } else {
          if (val > 0) status = 'win';
          else if (val < 0) status = 'lose';
          else status = 'participation';
        }

        return {
          id: String(item.id),
          tournamentName: item.match_title || reason || '积分变动',
          points: item.amount || item.points || 0, // Handle 'amount' from DB select *
          date: item.created_at,
          status: status
        };
      });
      setRecentRecords(records);

      // totalPoints logic moved to useEffect([userInfo])
      // But fallback calculation if userInfo is missing (race condition)?
      if (userInfo?.points === undefined) {
        const total = records.reduce((sum: number, r: any) => sum + r.points, 0);
        setTotalPoints(total);
      }

      // Fetch my rank (optional, if backend supports it or filter leaderboard)
      // For now, let's fetch leaderboard and find me
      const leaderboardRes = await api.get('/points/leaderboard');
      const myRankIdx = leaderboardRes.findIndex((u: any) => u.id === userInfo?.id);
      setCurrentRank(myRankIdx !== -1 ? myRankIdx + 1 : 0);

      // Generate chart data (mock distribution over months for now or aggregation)
      // Let's aggregate by month from records
      const monthsData = Array(12).fill(0).map((_, i) => ({ name: `${i + 1}月`, points: 0 }));
      records.forEach((r: any) => {
        // Safe date parsing - iOS compatible
        try {
          let dateStr = r.date;
          if (dateStr && dateStr.includes(' ')) {
            dateStr = dateStr.replace(' ', 'T');
          }
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const m = d.getMonth();
            monthsData[m].points += r.points;
          }
        } catch (e) { }
      });
      setScoreHistory(monthsData);

    } catch (err) {
      console.error(err);
      toast.error('获取积分记录失败');
    }
  };

  // 格式化日期显示
  // const formatDate = ... (Removed)

  // 获取记录状态文本
  const getStatusText = (status: ScoreRecord['status']) => {
    const statusMap: Record<ScoreRecord['status'], string> = {
      'win': '获得',
      'lose': '扣除',
      'participation': '活动得分'
    };
    return statusMap[status];
  };

  // 获取记录状态颜色
  const getStatusColor = (status: ScoreRecord['status']) => {
    const colorMap: Record<ScoreRecord['status'], string> = {
      'win': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'lose': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'participation': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    };
    return colorMap[status];
  };

  return (
    <AuthGuard>
      <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        {/* 顶部导航 */}
        <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-30">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <h1 className="text-lg font-bold">我的</h1>

            <div className="flex items-center">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </button>
              <div className="ml-2">
                <MessageCenter />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-6">
          {/* 积分概览卡片 */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-red-500 to-orange-400 rounded-xl p-6 mb-6 text-white relative overflow-hidden"
          >
            <div className="absolute right-0 top-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full"></div>
            <div className="absolute right-10 bottom-0 -mb-10 w-32 h-32 bg-white opacity-10 rounded-full"></div>

            <div className="relative z-10">
              <div className="flex items-center mb-4">
                <div className="w-14 h-14 rounded-full border-2 border-white/50 overflow-hidden mr-3 bg-white/20">
                  <img
                    src={userInfo?.avatar || '/sportsreg/face/defaultface-user (1).jpg'}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold leading-tight">{userInfo?.nickname || '用户'}</h2>
                    <button
                      onClick={openEditProfile}
                      className="px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      <span>编辑资料</span>
                    </button>
                  </div>
                  <p className="text-white text-opacity-80 text-sm">个人中心</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{isNaN(totalPoints) ? 0 : totalPoints}</div>
                  <div className="text-xs text-white text-opacity-80">总积分</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{isNaN(currentRank) ? 0 : currentRank}</div>
                  <div className="text-xs text-white text-opacity-80">当前排名</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{recentRecords.length}</div>
                  <div className="text-xs text-white text-opacity-80">参加次数</div>
                </div>
              </div>

              <button
                onClick={() => navigate('/rankings')}
                className="mt-4 w-full py-2 rounded-full bg-white bg-opacity-20 text-white text-sm font-medium hover:bg-opacity-30 transition-colors"
              >
                查看排行榜
              </button>
            </div>
          </motion.div>

          {/* 最近积分记录 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center">
                <Award className="h-5 w-5 text-red-500 mr-2" />
                最近积分记录
              </h3>
            </div>

            <div className="space-y-4">
              {recentRecords.length > 0 ? (
                recentRecords.map((record, index) => (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index + 0.2 }}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full ${getStatusColor(record.status).split(' ')[0]} flex items-center justify-center mr-3`}>
                        <Trophy className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="font-medium">{record.tournamentName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(record.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-red-500">
                        {record.points > 0 ? '+' : ''}{record.points}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(record.status)}`}>
                        {getStatusText(record.status)}
                      </span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full inline-block mb-3">
                    <Award className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">暂无积分记录</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* 积分趋势图表 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center">
                <BarChart2 className="h-5 w-5 text-red-500 mr-2" />
                积分趋势
              </h3>
              <button className="text-sm text-red-500">详情</button>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scoreHistory}>
                  <defs>
                    <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => value}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => value}
                  />
                  <Tooltip
                    formatter={(value) => [`${value} 积分`, '获得积分']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      backgroundColor: theme === 'dark' ? '#374151' : 'white',
                      color: theme === 'dark' ? 'white' : 'black'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="points"
                    stroke="#f43f5e"
                    fillOpacity={1}
                    fill="url(#colorPoints)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* 积分规则说明 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6"
          >
            <h3 className="text-lg font-bold mb-3">积分规则</h3>
            <ul className="space-y-2 text-gray-600 dark:text-gray-300">
              <li className="flex items-start">
                <div className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-900 text-red-500 flex items-center justify-center text-xs mr-2 mt-0.5">
                  1
                </div>
                <span>成功报名且为上场人员的用户，在活动结束后自动获得10积分</span>
              </li>
              <li className="flex items-start">
                <div className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-900 text-red-500 flex items-center justify-center text-xs mr-2 mt-0.5">
                  2
                </div>
                <span>活动获得前三名可额外获得积分奖励</span>
              </li>
              <li className="flex items-start">
                <div className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-900 text-red-500 flex items-center justify-center text-xs mr-2 mt-0.5">
                  3
                </div>
                <span>积分可用于兑换活动优先权、纪念品等奖励</span>
              </li>
            </ul>
          </motion.div>
        </main>

        {/* 底部导航栏 */}
        <footer className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-3 z-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-3 gap-2">
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
                <span className="text-xs">全部活动</span>
              </Link>

              <Link
                to="/my-scores"
                className="flex flex-col items-center text-red-500 dark:text-red-400"
              >
                <Medal className="h-6 w-6 mb-1" />
                <span className="text-xs">我的</span>
              </Link>
            </div>
          </div>
        </footer>

        {/* Edit Profile Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-bold">编辑个人资料</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Avatar Selection */}
                <div className="flex flex-col items-center mb-4">
                  <div className="relative group cursor-pointer" onClick={() => setShowAvatarSelection(!showAvatarSelection)}>
                    <img src={editAvatar} className="w-20 h-20 rounded-full object-cover border-4 border-gray-100 dark:border-gray-700" alt="Avatar" />
                    <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold">
                      更换
                    </div>
                  </div>
                  {showAvatarSelection && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl grid grid-cols-5 gap-2 w-full">
                      {avatars.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => { setEditAvatar(url); setShowAvatarSelection(false); }}
                          className={`aspect-square rounded-full overflow-hidden border-2 transition-all ${editAvatar === url ? 'border-red-500 scale-110' : 'border-transparent hover:border-gray-300'}`}
                        >
                          <img src={url} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">昵称</label>
                  <input
                    type="text"
                    value={editNickname}
                    onChange={e => setEditNickname(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">新密码 (留空不修改)</label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="请输入新密码"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleUpdateProfile}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  保存修改
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </AuthGuard>
  );
}