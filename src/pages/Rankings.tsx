import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import {
  Trophy,
  Medal,
  Users,
  Sun,
  Moon,
  ArrowLeft,
  Search,
  Calendar
} from 'lucide-react';
import MessageCenter from '@/components/MessageCenter';
import AuthGuard from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// 用户排名数据类型
interface RankUser {
  id: string;
  name: string;
  points: number;
  rank: number;
  avatar?: string;
  isMe?: boolean;
}

export default function Rankings() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, userInfo } = useContext(AuthContext);
  const [rankData, setRankData] = useState<RankUser[]>([]);
  const [filteredRanks, setFilteredRanks] = useState<RankUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('global');
  const [myRank, setMyRank] = useState<RankUser | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRankings();
  }, [isAuthenticated, userInfo]);

  const fetchRankings = async () => {
    try {
      const res = await api.get('/points/leaderboard');
      // res: [{id, username, nickname, avatar, points}, ...]

      const formatted = res.map((u: any, idx: number) => ({
        id: String(u.id),
        name: u.nickname || u.username,
        points: u.total_points || u.points || 0,
        rank: idx + 1,
        avatar: u.avatar,
        isMe: userInfo ? u.id === userInfo.id : false
      }));

      setRankData(formatted);
      setFilteredRanks(formatted);

      if (userInfo) {
        const me = formatted.find((u: any) => u.isMe);
        setMyRank(me || null);
      }
    } catch (err) {
      console.error(err);
      toast.error('获取排行榜失败');
    }
  };

  // 搜索和筛选
  useEffect(() => {
    let result = [...rankData];

    // 搜索筛选
    if (searchTerm) {
      result = result.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 标签筛选
    if (activeTab === 'friends') {
      // 模拟好友排名数据（实际应用中应该根据用户关系过滤）
      result = result.slice(0, 5);
    }

    setFilteredRanks(result);
  }, [searchTerm, activeTab, rankData]);

  // 处理标签切换
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // 获取排名样式
  const getRankStyle = (rank: number) => {
    if (rank === 1) {
      return {
        bgColor: 'bg-yellow-100 dark:bg-yellow-900',
        textColor: 'text-yellow-600 dark:text-yellow-300',
        borderColor: 'border-yellow-200 dark:border-yellow-800'
      };
    } else if (rank === 2) {
      return {
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        textColor: 'text-gray-600 dark:text-gray-300',
        borderColor: 'border-gray-200 dark:border-gray-700'
      };
    } else if (rank === 3) {
      return {
        bgColor: 'bg-orange-100 dark:bg-orange-900',
        textColor: 'text-orange-600 dark:text-orange-300',
        borderColor: 'border-orange-200 dark:border-orange-800'
      };
    } else {
      return {
        bgColor: 'bg-gray-50 dark:bg-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300',
        borderColor: 'border-gray-100 dark:border-gray-700'
      };
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

            <h1 className="text-lg font-bold">积分排行榜</h1>

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
          {/* 前三名展示 */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 relative"
          >
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <Trophy className="h-5 w-5 text-red-500 mr-2" />
              活动之星
            </h2>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {/* 第二名 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center flex flex-col items-center"
              >
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-2">
                  <img
                    src={rankData[1]?.avatar}
                    alt={rankData[1]?.name || '第二名'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center font-bold text-sm mb-2">
                  2
                </div>
                <p className="font-medium text-sm">{rankData[1]?.name || '待定'}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{rankData[1]?.points || 0} 积分</p>
              </motion.div>

              {/* 第一名 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-yellow-400 text-center flex flex-col items-center relative"
              >
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-white rounded-full px-3 py-1 text-xs font-bold">
                  冠军
                </div>
                <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900 overflow-hidden mb-2 mt-2">
                  <img
                    src={rankData[0]?.avatar}
                    alt={rankData[0]?.name || '冠军'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-7 h-7 rounded-full bg-yellow-400 text-white flex items-center justify-center font-bold mb-2">
                  1
                </div>
                <p className="font-bold">{rankData[0]?.name || '待定'}</p>
                <p className="text-yellow-500 font-medium">{rankData[0]?.points || 0} 积分</p>
              </motion.div>

              {/* 第三名 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center flex flex-col items-center"
              >
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-2">
                  <img
                    src={rankData[2]?.avatar}
                    alt={rankData[2]?.name || '第三名'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-6 h-6 rounded-full bg-orange-400 text-white flex items-center justify-center font-bold text-sm mb-2">
                  3
                </div>
                <p className="font-medium text-sm">{rankData[2]?.name || '待定'}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{rankData[2]?.points || 0} 积分</p>
              </motion.div>
            </div>
          </motion.div>

          {/* 搜索栏和标签切换 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6"
          >
            {/* 搜索栏 */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="搜索用户"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-10 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 transition-colors"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>

            {/* 标签切换 */}
            <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTabChange('global')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === 'global'
                  ? 'bg-red-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                全球排名
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTabChange('friends')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === 'friends'
                  ? 'bg-red-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                好友排名
              </motion.button>
            </div>
          </motion.div>

          {/* 我的排名 */}
          {myRank && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-r from-red-500 to-orange-400 rounded-xl p-4 mb-6 text-white"
            >
              <div className="flex items-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 overflow-hidden">
                    <img
                      src={myRank.avatar || `https://space.coze.cn/api/coze_space/gen_image?image_size=square&prompt=Avatar%20placeholder&sign=b839f11cd37666ac24a66c9bfaafdb67`}
                      alt={myRank.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="font-medium">我的排名</p>
                  <p className="text-white text-opacity-80 text-sm">第 {myRank.rank} 名</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="font-bold text-xl">{myRank.points}</p>
                  <p className="text-white text-opacity-80 text-sm">总积分</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 排名列表 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-bold">排行榜</h3>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredRanks.length > 0 ? (
                filteredRanks.map((user, index) => {
                  const rankStyle = getRankStyle(user.rank);

                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index + 0.6 }}
                      className={`flex items-center p-4 ${user.isMe ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                    >
                      {/* 排名 */}
                      <div className="w-8 text-center mr-3">
                        {user.rank <= 3 ? (
                          <div className={`w-8 h-8 rounded-full ${rankStyle.bgColor} flex items-center justify-center text-lg font-bold ${rankStyle.textColor}`}>
                            {user.rank}
                          </div>
                        ) : (
                          <div className="text-gray-500 font-medium">{user.rank}</div>
                        )}
                      </div>

                      {/* 用户头像 */}
                      <div className="relative mr-3">
                        <div className={`w-12 h-12 rounded-full ${user.isMe ? 'ring-2 ring-red-500' : ''} overflow-hidden`}>
                          <img
                            src={user.avatar || `https://space.coze.cn/api/coze_space/gen_image?image_size=square&prompt=Avatar%20placeholder&sign=b839f11cd37666ac24a66c9bfaafdb67`}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {user.isMe && (
                          <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">
                            我
                          </div>
                        )}
                      </div>

                      {/* 用户名 */}
                      <div className="flex-1">
                        <p className={`font-medium ${user.isMe ? 'text-red-500' : ''}`}>{user.name}</p>
                      </div>

                      {/* 积分 */}
                      <div className="text-right">
                        <p className="font-bold text-lg">{user.points}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">积分</p>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="py-12 text-center">
                  <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-full inline-block mb-4">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">暂无排名数据</h3>
                  <p className="text-gray-500 dark:text-gray-400">当前筛选条件下没有找到用户</p>
                </div>
              )}
            </div>
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
      </div>
    </AuthGuard>
  );
}