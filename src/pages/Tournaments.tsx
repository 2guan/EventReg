import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { AuthContext } from '@/contexts/authContext';
import { motion } from 'framer-motion';
import {
  Calendar,
  Sun,
  Moon,
  ArrowLeft,
  Search,
  Filter,
  Medal
} from 'lucide-react';
import MessageCenter from '@/components/MessageCenter';
import TournamentCard, { TournamentData } from '@/components/TournamentCard';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { mapBackendToFrontend } from '@/lib/mappers';

// 定义新的图片URL常量


// 活动状态类型
type TournamentStatus = 'all' | 'pre-registration' | 'registration' | 'waiting-list' | 'full' | 'finished' | 'finished-pending' | 'finished-completed' | 'cancelled' | 'my';

export default function Tournaments() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, userInfo } = useContext(AuthContext);
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [filteredTournaments, setFilteredTournaments] = useState<TournamentData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TournamentStatus>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 用户参加的活动ID列表
  const [myParticipatedTournamentIds, setMyParticipatedTournamentIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'ongoing' | 'my' | 'all'>('ongoing');
  const navigate = useNavigate();

  // 获取活动数据
  useEffect(() => {
    // ... (This block 43-84 is fine, fetching data)
    const fetchTournaments = async () => {
      setIsLoading(true);
      try {
        const [matchesRes, myEnrollments] = await Promise.all([
          api.get('/matches'),
          isAuthenticated ? api.get('/enrollments/my/list') : Promise.resolve([])
        ]);

        let mappedData = matchesRes.map((item: any) => mapBackendToFrontend(item));

        // If authenticated, merge my counts
        if (isAuthenticated && Array.isArray(myEnrollments)) {
          // Fetch full details to ensure accurate cost calculation (synced with Detail page)
          const uniqueMatchIds = Array.from(new Set(myEnrollments.map((e: any) => e.match_id)));
          const detailsMap: Record<string, any[]> = {};

          await Promise.all(uniqueMatchIds.map(async (mId) => {
            try {
              const details = await api.get(`/enrollments/${mId}`);
              detailsMap[String(mId)] = details;
            } catch (e) { console.error(e); }
          }));

          const myRealCountsMap: Record<string, number> = {};
          const myIds: string[] = [];

          myEnrollments.forEach((e: any) => {
            const mId = String(e.match_id);
            if (!myIds.includes(mId)) myIds.push(mId);

            // Only calculate if not already calculated
            if (myRealCountsMap[mId] !== undefined) return;

            const allEnrollments = detailsMap[mId] || [];
            let limit = e.max_players;
            try {
              const config = JSON.parse(e.config_json || '{}');
              if (config.maxFieldPlayers) limit = config.maxFieldPlayers;
            } catch (err) { }

            // Valid players logic from TournamentDetail
            const sorted = [...allEnrollments].sort((a: any, b: any) => parseInt(a.id) - parseInt(b.id));
            const activePlayers = sorted.slice(0, limit);

            // Count how many of these are ME (or owned by ME)
            const myCount = activePlayers.filter((p: any) => String(p.user_id) === String(userInfo?.id)).length;
            myRealCountsMap[mId] = myCount;
          });

          setMyParticipatedTournamentIds(myIds);

          mappedData = mappedData.map((m: any) => ({
            ...m,
            myRegistrationCount: myRealCountsMap[m.id] || 0
          }));


        }

        setTournaments(mappedData);
        setFilteredTournaments(mappedData);
      } catch (error) {
        console.error('Failed to fetch tournaments:', error);
        toast.error('获取活动列表失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTournaments();
  }, [isAuthenticated]);

  // 过滤活动
  useEffect(() => {
    let result = [...tournaments];

    // 1. First apply Tab Filter (Main View)
    if (activeTab === 'ongoing') {
      // Default: Show active matches (exclude finished/cancelled)
      result = result.filter(t =>
        t.status !== 'finished' &&
        t.status !== 'finished-pending' &&
        t.status !== 'finished-completed' &&
        t.status !== 'cancelled'
      );
    } else if (activeTab === 'my') {
      // My Tournaments
      result = result.filter(t => myParticipatedTournamentIds.includes(t.id));
    }
    // If 'all', no initial filter (show everything including history)

    // 2. Then apply Dropdown Status Filter (refinement)
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'my') {
        // Redundant if tab is 'my', but consistent
        result = result.filter(t => myParticipatedTournamentIds.includes(t.id));
      } else {
        result = result.filter(t => t.status === selectedStatus);
      }
    }

    // 3. Search Filter
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      result = result.filter(tournament =>
        tournament.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        tournament.location.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    setFilteredTournaments(result);
  }, [tournaments, searchTerm, selectedStatus, activeTab, myParticipatedTournamentIds]);

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

          <h1 className="text-lg font-bold">全部活动</h1>

          <div className="flex items-center">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            {isAuthenticated && (
              <div className="ml-2">
                <MessageCenter />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* 搜索栏 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-6"
        >
          <input
            type="text"
            placeholder="搜索活动名称或地点"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-10 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 transition-colors"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        </motion.div>

        {/* 标签切换 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex space-x-4 mb-6 overflow-x-auto pb-2 scrollbar-hide"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('ongoing')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === 'ongoing'
              ? 'bg-red-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            报名中
          </motion.button>

          {isAuthenticated && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab('my')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === 'my'
                ? 'bg-red-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              我的活动
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === 'all'
              ? 'bg-red-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            全部活动
          </motion.button>
        </motion.div>

        {/* 筛选菜单 */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <h3 className="font-medium mb-3">按状态筛选</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'all', label: '全部状态' },
                { value: 'my', label: '我参加的' },
                { value: 'pre-registration', label: '预报名' },
                { value: 'registration', label: '报名中' },
                { value: 'waiting-list', label: '可候补' },
                { value: 'full', label: '已满员' },
                { value: 'finished-pending', label: '待结算' },
                { value: 'finished-completed', label: '已结束' }
              ].map((status) => (
                <motion.button
                  key={status.value}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedStatus(status.value as TournamentStatus)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${selectedStatus === status.value
                    ? 'bg-red-100 text-red-500 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                >
                  {status.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* 活动列表 */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
            </div>
          ) : filteredTournaments.length > 0 ? (
            filteredTournaments.map((tournament, index) => (
              <TournamentCard key={tournament.id} tournament={tournament} index={index} />
            ))
          ) : (
            <div className="py-16 text-center">
              <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-full inline-block mb-4">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">没有找到活动</h3>
              <p className="text-gray-500 dark:text-gray-400">
                尝试调整筛选条件或搜索其他关键词
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSearchTerm('');
                  setSelectedStatus('all');
                  setActiveTab('all');
                }}
                className="mt-6 px-5 py-2.5 rounded-full bg-gradient-to-r from-red-500 to-orange-400 text-white font-medium hover:opacity-90 transition-opacity"
              >
                清除筛选
              </motion.button>
            </div>
          )}
        </div>
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
              className="flex flex-col items-center text-red-500 dark:text-red-400"
            >
              <Calendar className="h-6 w-6 mb-1" />
              <span className="text-xs">全部活动</span>
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
    </div >
  );
}