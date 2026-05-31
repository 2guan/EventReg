import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  PlusCircle,
  UserCheck,
  LogOut,
  Calendar,
  BarChart3,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sun,
  Moon,
  Medal,
  Settings,
  Image,
  Filter
} from 'lucide-react';
import MessageCenter from '@/components/MessageCenter';
import { toast } from 'sonner';
import AuthGuard from '@/components/AuthGuard';


// 活动状态类型
type TournamentStatus = 'pre-registration' | 'registration' | 'waiting-list' | 'full' | 'finished' | 'finished-pending' | 'finished-completed' | 'cancelled';



import { api } from '@/lib/api';
import { mapBackendToFrontend } from '@/lib/mappers';

export default function Admin() {
  const { theme, toggleTheme } = useTheme();
  const { userInfo, logout } = useContext(AuthContext);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('tournaments');
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [showTournamentActions, setShowTournamentActions] = useState(false);
  // const [showUserActions, setShowUserActions] = useState(false); // Unused for now, or used in JSX? wait.
  const [_selectedUser, _setSelectedUser] = useState<any>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [wxPushEnabled, setWxPushEnabled] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all' | specific status
  const navigate = useNavigate();

  // Load data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [matchesRes, usersRes, settingsRes] = await Promise.all([
        api.get('/matches?source=admin'),
        api.get('/users'),
        api.get('/notifications/settings')
      ]);

      // Map matches
      const mappedMatches = matchesRes.map((m: any) => mapBackendToFrontend(m));
      setTournaments(mappedMatches);

      // Filter pending users
      const pending = usersRes.filter((u: any) => u.role === 'pending');
      setPendingUsers(pending);

      // Set settings
      if (settingsRes && settingsRes.enabled !== undefined) {
        setNotificationEnabled(settingsRes.enabled);
      }

      // Fetch wx push setting
      try {
        const wxPushRes = await api.get('/notifications/wx-push');
        if (wxPushRes && wxPushRes.enabled !== undefined) {
          setWxPushEnabled(wxPushRes.enabled);
        }
      } catch (e) {
        console.error('Failed to fetch wx push setting', e);
      }

    } catch (err) {
      toast.error('Failed to load data');
    }
  };

  // 格式化日期显示
  // const formatDate = ... (Removed)

  // 获取活动状态文本
  const getStatusText = (status: TournamentStatus) => {
    const statusMap: Record<TournamentStatus, string> = {
      'pre-registration': '预报名',
      'registration': '报名中',
      'waiting-list': '可候补',
      'full': '已满员',
      'finished': '已结束',
      'finished-pending': '待结算',
      'finished-completed': '已结束',
      'cancelled': '已取消'
    };
    return statusMap[status];
  };

  // 获取状态对应的颜色类名
  const getStatusColor = (status: TournamentStatus) => {
    const colorMap: Record<TournamentStatus, string> = {
      'pre-registration': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'registration': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'waiting-list': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'full': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      'finished': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'finished-pending': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'finished-completed': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return colorMap[status];
  };

  // 处理用户审核
  const handleUserApproval = async (userId: string, approve: boolean) => {
    const user = pendingUsers.find(u => u.id === userId);
    if (!user) return;

    try {
      if (approve) {
        // Approve: Set role to 'user'
        await api.put(`/users/${userId}`, {
          nickname: user.nickname,
          avatar: user.avatar,
          role: 'user'
        });
        toast.success(`已批准 ${user.nickname} 注册`);
      } else {
        // Reject: Delete user
        await api.delete(`/users/${userId}`);
        toast.success(`已拒绝并删除 ${user.nickname}`);
      }

      // Update local state
      const updatedUsers = pendingUsers.filter(u => u.id !== userId);
      setPendingUsers(updatedUsers);
      // setShowUserActions(false);

    } catch (err: any) {
      toast.error(err.error || '操作失败');
    }
  };

  // 处理删除活动
  const handleDeleteTournament = async (tournamentId: string) => {
    if (window.confirm('确定要删除这场活动吗？此操作不可撤销。')) {
      try {
        await api.delete(`/matches/${tournamentId}`);
        const updatedTournaments = tournaments.filter(tournament => tournament.id !== tournamentId);
        setTournaments(updatedTournaments);
        toast.success('活动已删除');
        setShowTournamentActions(false);
      } catch (err: any) {
        console.error('Failed to delete tournament:', err);
        toast.error(err.error || '删除失败，请重试');
      }
    }
  };

  // 处理登出
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 跳转到创建活动页面
  const handleCreateTournament = () => {
    navigate('/create-tournament');
  };

  // 跳转到编辑活动页面
  const handleEditTournament = (tournament: any) => {
    navigate(`/edit-tournament/${tournament.id}`);
    setShowTournamentActions(false);
  };

  const handleToggleNotification = async () => {
    try {
      const newState = !notificationEnabled;
      await api.post('/notifications/settings', { enabled: newState });
      setNotificationEnabled(newState);
      toast.success(newState ? '已开启全局通知' : '已关闭全局通知');
    } catch (err) {
      toast.error('设置失败');
    }
  };

  return (
    <AuthGuard requiredRole="admin">
      <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        {/* 顶部导航 */}
        <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <h1 className="text-lg font-bold">管理中心</h1>

            <div className="flex items-center space-x-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </button>

              <button
                onClick={handleLogout}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
              <MessageCenter />
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-6">
          {/* 管理员信息 */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl p-5 mb-6 text-white relative overflow-hidden"
          >
            <div className="absolute right-0 top-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full"></div>
            <div className="absolute right-10 bottom-0 -mb-10 w-32 h-32 bg-white opacity-10 rounded-full"></div>

            <div className="relative z-10">
              <div className="flex items-center">
                <div className="bg-white bg-opacity-20 p-3 rounded-full mr-4">
                  <UserCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">管理员中心</h2>
                  <p className="text-white text-opacity-80">欢迎回来，{userInfo?.nickname || '管理员'}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 数据概览 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-4 mb-6"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full mr-3">
                  <Calendar className="h-5 w-5 text-blue-500 dark:text-blue-300" />
                </div>
                <div><p className="text-sm text-gray-500 dark:text-gray-400">总活动数</p>
                  <p className="text-xl font-bold">{tournaments.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center">
                <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full mr-3">
                  <UserCheck className="h-5 w-5 text-red-500 dark:text-red-300" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">待审核用户</p>
                  <p className="text-xl font-bold">{pendingUsers.length}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 管理功能标签页 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 overflow-hidden"
          >
            {/* 标签切换 */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('tournaments')}
                className={`flex-1 py-3 px-4 text-center font-medium ${activeTab === 'tournaments'
                  ? 'border-b-2 border-red-500 text-red-500'
                  : 'text-gray-500 dark:text-gray-400'
                  }`}
              >
                活动管理
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`flex-1 py-3 px-4 text-center font-medium ${activeTab === 'users'
                  ? 'border-b-2 border-red-500 text-red-500'
                  : 'text-gray-500 dark:text-gray-400'
                  }`}
              >
                用户管理
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-3 px-4 text-center font-medium ${activeTab === 'settings'
                  ? 'border-b-2 border-red-500 text-red-500'
                  : 'text-gray-500 dark:text-gray-400'
                  }`}
              >
                系统设置
              </button>
            </div>

            {/* 内容区域 */}
            <div className="p-4">
              {/* 活动管理 */}
              {activeTab === 'tournaments' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">活动列表</h3>
                      <div className="relative">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="appearance-none pl-7 pr-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-none cursor-pointer focus:ring-2 focus:ring-red-500"
                        >
                          <option value="all">状态筛选</option>
                          <option value="pre-registration">预报名</option>
                          <option value="registration">正式报名</option>
                          <option value="finished-pending">待结算</option>
                          <option value="finished-completed">已结束</option>
                          <option value="cancelled">已取消</option>
                        </select>
                        <Filter className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCreateTournament}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-500 text-white"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>创建活动</span>
                    </motion.button>
                  </div>

                  <div className="space-y-3">
                    {(() => {
                      // 排序：按开始时间降序（最未来到最过去）
                      const sortedTournaments = [...tournaments].sort((a, b) => {
                        const dateA = new Date(a.startDateTime || a.date || 0).getTime();
                        const dateB = new Date(b.startDateTime || b.date || 0).getTime();
                        return dateB - dateA; // 降序
                      });
                      // 筛选
                      const filteredTournaments = statusFilter === 'all'
                        ? sortedTournaments
                        : sortedTournaments.filter(t => t.status === statusFilter);

                      return filteredTournaments.length > 0 ? (
                        filteredTournaments.map((tournament) => (
                          <div
                            key={tournament.id}
                            onClick={() => handleEditTournament(tournament)}
                            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium dark:text-gray-100">{tournament.name}</h4>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getStatusColor(tournament.status)}`}>
                                  {getStatusText(tournament.status)}
                                </span>
                              </div>
                              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                                <Calendar className="h-3 w-3 mr-1" />
                                <span className="mr-3">
                                  {(() => {
                                    const start = new Date(tournament.startDateTime);
                                    const end = new Date(tournament.endDateTime);
                                    const isSameDay = start.toDateString() === end.toDateString();

                                    if (isSameDay) {
                                      return `${start.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })} ${start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                                    } else {
                                      return `${start.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} ${start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${end.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} ${end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>

                            <div
                              className="ml-3 relative"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setSelectedTournament(tournament);
                                  setShowTournamentActions(!showTournamentActions);
                                }}
                                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                              >
                                <MoreHorizontal className="h-5 w-5" />
                              </button>

                              {showTournamentActions && selectedTournament?.id === tournament.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg z-20 border border-gray-200 dark:border-gray-700"
                                >
                                  <div className="py-1">
                                    <button
                                      onClick={() => handleDeleteTournament(tournament.id)}
                                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    ><Trash2 className="h-4 w-4 inline mr-2" />
                                      删除活动
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center">
                          <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-full inline-block mb-4">
                            <Calendar className="h-8 w-8 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-medium mb-2">暂无活动</h3>
                          <p className="text-gray-500 dark:text-gray-400">点击"创建活动"按钮添加新的活动</p>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* 用户管理 */}
              {activeTab === 'users' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">待审核用户</h3>
                  </div>

                  <div className="space-y-3">
                    {pendingUsers.length > 0 ? (
                      pendingUsers.map((user) => (
                        <div key={user.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                              <img
                                src={user.avatar}
                                alt={user.nickname}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="font-medium">{user.nickname}</h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{user.username}</p>
                            </div>
                          </div>

                          <div className="ml-3 flex space-x-2">
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleUserApproval(user.id, true)}
                              className="p-1.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </motion.button>

                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleUserApproval(user.id, false)}
                              className="p-1.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200"
                            >
                              <XCircle className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center">
                        <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-full inline-block mb-4">
                          <UserCheck className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium mb-2">暂无待审核用户</h3>
                        <p className="text-gray-500 dark:text-gray-400">所有用户均已审核</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate('/admin/users')}
                      className="w-full py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      查看所有用户
                    </motion.button>
                  </div>
                </div>
              )}

              {/* 数据统计 */}
              {activeTab === 'statistics' && (
                <div className="py-12 text-center">
                  <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-full inline-block mb-4">
                    <BarChart3 className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">数据统计功能</h3>
                  <p className="text-gray-500 dark:text-gray-400">数据统计功能开发中，敬请期待</p>
                </div>
              )}

              {/* 系统设置 */}
              {activeTab === 'settings' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">系统设置</h3>
                  </div>

                  <div className="space-y-3 max-w-2xl">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-start flex-1 mr-4">
                        <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full mr-3 flex-shrink-0">
                          <Settings className="h-5 w-5 text-blue-500 dark:text-blue-300" />
                        </div>
                        <div>
                          <h4 className="font-medium text-base dark:text-gray-100">全局通知开关</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            开启后，系统将在活动状态变更、候补成功等重要时刻向用户发送通知。
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleToggleNotification}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex-shrink-0 ${notificationEnabled ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-600'
                          }`}
                      >
                        <span
                          className={`${notificationEnabled ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </button>
                    </div>

                    {/* 微信推送开关 */}
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-start flex-1 mr-4">
                        <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full mr-3 flex-shrink-0">
                          <svg className="h-5 w-5 text-green-500 dark:text-green-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.99 1.16 5.65 3.04 7.51L4.05 23l3.76-2.34c1.29.47 2.7.73 4.17.73 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-medium text-base dark:text-gray-100">微信消息推送</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            开启后，系统将通过微信订阅消息向用户推送重要通知。需用户授权后生效。
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const newState = !wxPushEnabled;
                            await api.post('/notifications/wx-push', { enabled: newState });
                            setWxPushEnabled(newState);
                            toast.success(newState ? '已开启微信推送' : '已关闭微信推送');
                          } catch (err) {
                            toast.error('设置失败');
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex-shrink-0 ${wxPushEnabled ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                          }`}
                      >
                        <span
                          className={`${wxPushEnabled ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </button>
                    </div>

                    {/* 活动日志入口 */}
                    <div
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      onClick={() => navigate('/admin/log')}
                    >
                      <div className="flex items-start flex-1 mr-4">
                        <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full mr-3 flex-shrink-0">
                          <BarChart3 className="h-5 w-5 text-purple-500 dark:text-purple-300" />
                        </div>
                        <div>
                          <h4 className="font-medium text-base dark:text-gray-100">活动日志</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            查看所有活动的报名记录和操作日志。
                          </p>
                        </div>
                      </div>
                      <ArrowLeft className="h-5 w-5 text-gray-400 transform rotate-180" />
                    </div>

                    {/* 活动图片配置入口 */}
                    <div
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      onClick={() => navigate('/admin/banners')}
                    >
                      <div className="flex items-start flex-1 mr-4">
                        <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full mr-3 flex-shrink-0">
                          <Image className="h-5 w-5 text-green-500 dark:text-green-300" />
                        </div>
                        <div>
                          <h4 className="font-medium text-base dark:text-gray-100">活动图片配置</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            配置活动封面的默认 Banner 图片。
                          </p>
                        </div>
                      </div>
                      <ArrowLeft className="h-5 w-5 text-gray-400 transform rotate-180" />
                    </div>

                    {/* 缓存日志清理入口 */}
                    <div
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      onClick={() => navigate('/admin/cleanup')}
                    >
                      <div className="flex items-start flex-1 mr-4">
                        <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full mr-3 flex-shrink-0">
                          <Trash2 className="h-5 w-5 text-orange-500 dark:text-orange-300" />
                        </div>
                        <div>
                          <h4 className="font-medium text-base dark:text-gray-100">缓存日志清理</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            清理系统日志、通知记录、临时文件等缓存数据。
                          </p>
                        </div>
                      </div>
                      <ArrowLeft className="h-5 w-5 text-gray-400 transform rotate-180" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* 系统通知 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-start">
              <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-full mr-3 mt-0.5">
                <AlertCircle className="h-5 w-5 text-orange-500 dark:text-orange-300" />
              </div>
              <div>
                <h3 className="font-bold mb-2">系统通知</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  请定期检查待审核用户，确保新用户能够及时参与活动。当前有 <span className="font-bold text-orange-500">{pendingUsers.length}</span> 位用户等待审核。
                </p>
              </div>
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
                className="flex flex-col items-center text-gray-500 dark:text-gray-400"
              >
                <Medal className="h-6 w-6 mb-1" />
                <span className="text-xs">我的</span>
              </Link>
            </div>
          </div>
        </footer>

      </div>
    </AuthGuard >
  );
}