import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { AuthContext } from '@/contexts/authContext';
import { useContext } from 'react';
import { motion } from 'framer-motion';
import TournamentCard from '@/components/TournamentCard';
import {
  Trophy,
  Calendar,
  Medal,
  Sun,
  Moon,
  CheckCircle2
} from 'lucide-react';
import MessageCenter from '@/components/MessageCenter';

// 定义新的图片URL常量


import { api } from '@/lib/api';
import { mapBackendToFrontend } from '@/lib/mappers';

export default function Home() {
  const { theme, toggleTheme, isDark } = useTheme();
  const { isAuthenticated, userInfo, logout } = useContext(AuthContext);
  const [hasUpcomingRegisteredTournaments, setHasUpcomingRegisteredTournaments] = useState(false);
  const navigate = useNavigate();

  const [upcomingTournaments, setUpcomingTournaments] = useState<any[]>([]);
  const [myRegisteredTournaments, setMyRegisteredTournaments] = useState<any[]>([]);


  // Fetch data
  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      // Fetch matches
      const matchesRes = await api.get('/matches');

      // Basic mapping without user-specific counts first
      let matches = matchesRes.map((m: any) => mapBackendToFrontend(m));

      // Fetch my enrollments if logged in
      if (isAuthenticated) {
        const enrollmentsRes = await api.get('/enrollments/my/list');

        // Fetch full enrollment details for matches I recall, to ensure accurate rank calculation
        const uniqueMatchIds = Array.from(new Set(enrollmentsRes.map((e: any) => e.match_id)));
        const detailsMap: Record<string, any[]> = {};

        await Promise.all(uniqueMatchIds.map(async (mId) => {
          try {
            const details = await api.get(`/enrollments/${mId}`);
            detailsMap[String(mId)] = details;
          } catch (e) { console.error(e); }
        }));

        const myRealCountsMap: Record<string, number> = {};

        // Calculate counts based on details
        uniqueMatchIds.forEach((mId) => {
          const mIdStr = String(mId);
          const allEnrollments = detailsMap[mIdStr] || [];

          // Find match config to determine max players
          // We use the basic matches list which has the info
          const matchInfo = matches.find((m: any) => m.id === mIdStr);
          let limit = 0;
          if (matchInfo) {
            limit = matchInfo.maxFieldPlayers || matchInfo.maxPlayers;
          } else {
            // Fallback if not found in open matches (e.g. historical)
            const e = enrollmentsRes.find((x: any) => String(x.match_id) === mIdStr);
            limit = e?.max_players || 0;
            try {
              const c = JSON.parse(e?.config_json || '{}');
              if (c.maxFieldPlayers) limit = c.maxFieldPlayers;
            } catch (err) { }
          }

          // Valid players logic from TournamentDetail
          const sorted = [...allEnrollments].sort((a: any, b: any) => parseInt(a.id) - parseInt(b.id));
          const activePlayers = sorted.slice(0, limit);

          // Count how many of these are ME (or owned by ME)
          // Warning: /enrollments/:id returns generic user info. 
          // We verify ownership by checking user_id === userInfo.id
          const myCount = activePlayers.filter((p: any) => String(p.user_id) === String(userInfo?.id)).length;
          myRealCountsMap[mIdStr] = myCount;
        });

        // Update matches with my counts
        matches = matches.map((m: any) => ({
          ...m,
          myRegistrationCount: myRealCountsMap[m.id] || 0
        }));

        // Get IDs of matches I'm enrolled in to filter from upcoming
        const myEnrolledMatchIds = new Set(enrollmentsRes.map((e: any) => String(e.match_id)));

        setUpcomingTournaments(matches.filter((m: any) =>
          ['pre-registration', 'registration'].includes(m.status) &&
          !myEnrolledMatchIds.has(String(m.id))
        ));

        // Map my enrollments list (Grouped by match_id)
        const groupedEnrollments: Record<string, any[]> = {};
        enrollmentsRes.forEach((e: any) => {
          const mId = String(e.match_id);
          if (!groupedEnrollments[mId]) {
            groupedEnrollments[mId] = [];
          }
          groupedEnrollments[mId].push(e);
        });

        const myDefaults = Object.values(groupedEnrollments).map((group) => {
          const e = group[0]; // Use first enrollment for match details

          // Construct a backend match object from enrollment data
          const backendMatch = {
            id: e.match_id,
            title: e.title,
            description: e.description || '',
            time: e.match_time || e.time,
            location: e.location,
            max_players: e.max_players,
            max_waitlist: e.max_waitlist,
            duration: e.duration || 90,
            status: e.match_status,
            config_json: e.config_json,
            created_at: '',
            registered_count: e.registered_count,
            waitlist_count: e.waitlist_count
          };

          const frontendMatch = mapBackendToFrontend(backendMatch, group.length);

          // Calculate Status Label
          const selfEnrollment = group.find((item: any) => !item.enrolled_for_name);
          const proxyEnrollments = group.filter((item: any) => item.enrolled_for_name);
          const proxyCount = proxyEnrollments.length;

          let label = '已报名';
          if (selfEnrollment && proxyCount > 0) {
            label = `已报名 代报名${proxyCount}人`;
          } else if (!selfEnrollment && proxyCount > 0) {
            label = `代报名${proxyCount}人`;
          } else if (selfEnrollment && proxyCount === 0) {
            label = '已报名';
          }

          return {
            ...frontendMatch,
            enrollmentId: e.id,
            myRegistrationCount: myRealCountsMap[String(e.match_id)] || 0,
            customStatusLabel: label
          };
        }).filter(t => ['pre-registration', 'registration', 'finished-pending'].includes(t.status));
        setMyRegisteredTournaments(myDefaults);
        setHasUpcomingRegisteredTournaments(myDefaults.length > 0);
      } else {
        setUpcomingTournaments(matches.filter((m: any) => ['pre-registration', 'registration'].includes(m.status)));
        setMyRegisteredTournaments([]);
        setHasUpcomingRegisteredTournaments(false);
      }
    } catch (err) {
      console.error(err);
    }
  };



  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center space-x-2"
          >
            <Trophy className="h-8 w-8 text-red-500" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">有熊来集</h1>
          </motion.div>

          <div className="flex items-center space-x-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                {userInfo?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="px-3 py-1.5 rounded-full bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors"
                    aria-label="管理中心"
                  >
                    管理中心
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  退出
                </button>
                <div className="ml-1">
                  <MessageCenter />
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-400 text-white font-medium text-sm hover:opacity-90 transition-opacity"
              >
                登录/注册
              </Link>
            )}
          </div>
        </div>
      </header >

      {/* 移除了下拉菜单，直接在顶部导航栏显示管理中心和退出登录按钮 */}

      < main className="container mx-auto px-4 py-6 pb-20" >
        {/* 欢迎横幅 - 显示用户积分 */}
        < motion.div
          initial={{ opacity: 0, y: 20 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 rounded-2xl overflow-hidden relative"
        >
          <div className="bg-gradient-to-r from-red-500 to-orange-400 p-6 rounded-2xl relative overflow-hidden aspect-[16/5] flex flex-col justify-center">
            <div className="absolute right-0 top-0 -mt-6 -mr-6 w-32 h-32 bg-white opacity-10 rounded-full"></div>
            <div className="absolute right-8 bottom-0 -mb-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>

            <div className="relative z-10 flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
                    <img
                      src={userInfo?.avatar || '/sportsreg/face/defaultface-user (1).jpg'}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white mb-1">欢迎回来，{userInfo?.nickname || '用户'}</h2>
                    <div className="flex items-center justify-between mb-0">
                      <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-white text-sm font-medium">
                        积分: {userInfo?.points || 0}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-2">欢迎来到有熊来集</h2>
                </>
              )}

              <div className="flex flex-wrap gap-2">
                {!isAuthenticated && (
                  <Link
                    to="/register"
                    className="px-4 py-2 bg-transparent text-white border border-white rounded-full text-sm font-medium hover:bg-white hover:bg-opacity-10 transition-colors"
                  >
                    立即注册
                  </Link>
                )}
              </div>
            </div>
          </div>
        </motion.div >

        {/* 我报名的活动 - 仅对已报名即将开始活动的用户显示 */}
        {
          isAuthenticated && hasUpcomingRegisteredTournaments && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
                  我报名的活动
                </h2>

              </div>

              <div className="space-y-4">
                {myRegisteredTournaments.map((tournament, index) => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    index={index}
                    isEnrolled={true}
                    customStatusLabel={tournament.customStatusLabel}
                  />
                ))}
              </div>
            </section>
          )
        }

        {/* 即将开始的活动 */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-red-500" />
              即将开始的活动
            </h2>

          </div>

          <div className="space-y-4">
            {upcomingTournaments.map((tournament, index) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                index={index}
              />
            ))}
          </div>
        </section>


      </main >

      {/* 底部导航栏 */}
      < footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-3 z-50 shadow-lg" >
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-2">
            <Link
              to="/"
              className="flex flex-col items-center text-red-500 dark:text-red-400"
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
              className="flex flex-col items-center text-gray-500 dark:text-gray-400"
            >
              <Medal className="h-6 w-6 mb-1" />
              <span className="text-xs">我的</span>
            </Link>
          </div>
        </div>
      </footer >
    </div >
  );
}