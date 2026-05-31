import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import {
  Calendar,
  MapPin,
  // Users, (removed unused)
  Shield,
  UserPlus,
  ArrowLeft,
  Sun,
  Moon,
  Share2,
  Download,
  Info,
  AlertCircle,
  Plus,
  X,
  MoreHorizontal,
  Medal,
  Lock,
  Unlock,
  LockKeyhole
} from 'lucide-react';
import { toast } from 'sonner';
import { formatTournamentDateTime } from '@/lib/utils';
import TournamentShareModal from '@/components/TournamentShareModal';
import MessageCenter from '@/components/MessageCenter';
// 活动状态类型
type TournamentStatus = 'pre-registration' | 'registration' | 'finished-pending' | 'finished-completed' | 'cancelled';

// 报名人员类型
interface Participant {
  id: string;
  name: string;
  avatar: string;
  isMe?: boolean;      // Correctly identifies "Self" registration
  isOwner?: boolean;   // Identifies any registration created by this user
  score?: number;      // Added score field
  proxyName?: string;  // Name of the user who registered this participant (if proxy)
  joinedAt?: string;   // Registration timestamp
  userId: string;      // Owner ID
  enrolledForName?: string; // If proxy
}

// 定义新的图片URL常量


import { api } from '@/lib/api';
import { mapBackendToFrontend } from '@/lib/mappers';

// ... (keep Participant interface)

export default function TournamentDetail() {
  const { id } = useParams();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, userInfo } = useContext(AuthContext);
  const [tournament, setTournament] = useState<any>(null);
  const [participants, setParticipants] = useState<{ players: Participant[], waitingList: Participant[] }>({ players: [], waitingList: [] });
  const [isMeRegistered, setIsMeRegistered] = useState(false);
  const [myProxyCount, setMyProxyCount] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerType, setRegisterType] = useState<'self' | 'other'>('self');
  const [otherPersonName, setOtherPersonName] = useState('');
  const [showAdminActions, setShowAdminActions] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  // ... newParticipant inputs ... (keep them if needed)
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantType, setNewParticipantType] = useState<'player' | 'waiting'>('player');

  // Lock state (0=未锁定, 1=基本锁定, 2=完全锁定)
  const [lockState, setLockState] = useState(0);

  // Score state
  const [scores, setScores] = useState<Record<string, string>>({}); // id -> score string

  const navigate = useNavigate();

  // Helper function

  const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    // Handle SQLite UTC string "YYYY-MM-DD HH:mm:ss"
    let safeDateStr = dateString;
    if (typeof dateString === 'string' && !dateString.includes('T') && !dateString.includes('Z')) {
      safeDateStr = dateString.replace(' ', 'T') + 'Z';
    }
    const date = new Date(safeDateStr);

    // Force Asia/Shanghai
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai'
    }).format(date).replace(/\//g, '.');
  };

  // Load data
  useEffect(() => {
    fetchData();
  }, [id, isAuthenticated]);

  const fetchData = async () => {
    if (!id) return;
    try {
      const matchRes = await api.get(`/matches/${id}`);
      const frontendMatch = mapBackendToFrontend(matchRes);

      const enrollmentsRes = await api.get(`/enrollments/${id}`);

      const players: Participant[] = [];
      const waitingList: Participant[] = [];
      let meRegistered = false;
      // let myEnrId = null;

      enrollmentsRes.forEach((e: any) => {
        const isSelf = e.user_id === userInfo?.id && !e.enrolled_for_name;
        const isOwner = e.user_id === userInfo?.id;

        const p: Participant = {
          id: String(e.id), // enrollment id
          name: e.enrolled_for_name || e.nickname,
          avatar: e.avatar,
          isMe: isSelf,     // Only true for specific SELF enrollment
          isOwner: isOwner, // True for ALL enrollments by this user
          score: e.score, // Map score
          proxyName: e.enrolled_for_name ? e.nickname : undefined,
          joinedAt: e.created_at,
          userId: String(e.user_id),
          enrolledForName: e.enrolled_for_name
        };

        if (isSelf) {
          // Track if "Self" is registered so we can disable that option in modal
          meRegistered = true;
          // myEnrId = String(e.id);
        }

        if (e.type === 'player') players.push(p);
        else waitingList.push(p);
      });

      // Calculate my proxy count
      const proxyCount = enrollmentsRes.filter((e: any) => e.user_id === userInfo?.id && e.enrolled_for_name).length;
      setMyProxyCount(proxyCount);

      // Update registered count based on actual enrollments
      frontendMatch.registeredCount = players.length; // Waitlist doesn't count towards 'participants' usually? Or does it?
      // Usually full means players full. The prompt UI shows X/Y. 
      // Home page showed registeredCount which seemed to include verified players.

      // 获取锁定状态 (0=未锁定, 1=基本锁定, 2=完全锁定)
      let lockStateValue = 0;
      try {
        const config = JSON.parse(matchRes.config_json || '{}');
        // 兼容旧数据：布尔值转换为数字
        lockStateValue = typeof config.locked === 'number' ? config.locked : (config.locked ? 1 : 0);
      } catch (e) { }
      setLockState(lockStateValue);

      setTournament(frontendMatch);

      // Logic to split players vs waitlist:
      // If Pre-registration: All active are "Players". (Waitlist concept not strictly enforced visually yet)
      // If Registration/Finished/etc: Use maxFieldPlayers to slice.

      let finalPlayers: Participant[] = [];
      let finalWaitlist: Participant[] = [];

      // Merge all 'active' enrollments first (assuming backend 'type' might not be perfectly sync with new config yet)
      // Note: Backend /matches/:id returns all 'active' enrollments sorted by time.
      // So we can re-evaluate who is in the field.
      // Merge all 'active' enrollments first
      // Sort by joinedAt time (ascending) to respect the custom time we set for manually added players
      const allActive = [...players, ...waitingList].sort((a, b) => {
        const timeA = new Date(a.joinedAt || 0).getTime();
        const timeB = new Date(b.joinedAt || 0).getTime();
        // If times are equal, fallback to ID (though unlikely with our -1s logic)
        if (timeA === timeB) {
          return parseInt(a.id) - parseInt(b.id);
        }
        return timeA - timeB;
      });

      if (frontendMatch.status === 'pre-registration') {
        finalPlayers = allActive;
        finalWaitlist = [];
      } else {
        // Status: registration, finished-pending, etc.
        // Limit by maxFieldPlayers
        const limit = frontendMatch.maxFieldPlayers || frontendMatch.maxPlayers;
        finalPlayers = allActive.slice(0, limit);
        finalWaitlist = allActive.slice(limit);
      }

      // Init scores for admin input
      // Init scores for admin input
      if (frontendMatch.status === 'finished-pending' || frontendMatch.status === 'finished-completed') {
        const initialScores: Record<string, string> = {};
        finalPlayers.forEach(p => {
          if (p.score !== undefined && p.score !== null) {
            initialScores[p.id] = String(p.score);
          }
        });
        setScores(initialScores);
      }

      setParticipants({ players: finalPlayers, waitingList: finalWaitlist });
      setIsMeRegistered(meRegistered);
      // setMyEnrollmentId(myEnrId);

    } catch (err) {
      toast.error('Load failed');
      navigate('/tournaments');
    }
  };

  // 循环切换锁定状态 (Admin Only): 0 -> 1 -> 2 -> 0
  const cycleLockState = async () => {
    if (!id || !isAdmin) return;
    try {
      const newLockState = (lockState + 1) % 3; // 0 -> 1 -> 2 -> 0
      await api.patch(`/matches/${id}/lock`, { lockState: newLockState });
      setLockState(newLockState);
      const stateText = newLockState === 0 ? '未锁定' : newLockState === 1 ? '基本锁定' : '完全锁定';
      toast.success(`活动已设置为${stateText}`);
      fetchData(); // Refresh to get latest state
    } catch (err: any) {
      toast.error(err.error || '操作失败');
    }
  };

  // 判断是否应隐藏取消按钮
  const shouldHideCancelButton = (participant: Participant) => {
    // 管理员始终可以操作
    if (isAdmin) return false;
    // 不是自己的报名
    if (!participant.isOwner) return true;

    // 根据锁定状态判断
    if (lockState === 0) {
      // 未锁定：允许取消
      return false;
    } else if (lockState === 1) {
      // 基本锁定：有候补时允许取消，无候补时不允许
      return participants.waitingList.length === 0;
    } else if (lockState === 2) {
      // 完全锁定：不允许取消
      return true;
    }
    return false;
  };

  // ... (keep handleRegister check logic) ...
  const handleRegister = () => {
    if (!isAuthenticated) {
      toast.info('请先登录后再报名');
      navigate('/login');
      return;
    }
    // Just show modal
    setShowRegisterModal(true);
  };

  const confirmRegister = async () => {
    if (registerType === 'other' && !otherPersonName.trim()) {
      toast.error('请输入代报名人的姓名');
      return;
    }

    try {
      await api.post('/enrollments/join', {
        match_id: id,
        enrolled_for_name: registerType === 'other' ? otherPersonName : undefined
      });
      toast.success('报名成功');
      setShowRegisterModal(false);
      setOtherPersonName('');
      fetchData(); // Reload
    } catch (err: any) {
      toast.error(err.error || '报名失败');
    }
  };



  // Admin delete
  const handleDeleteParticipant = async (participantId: string) => {
    if (!window.confirm('确定要移除该报名者吗？')) return;
    try {
      await api.post('/enrollments/cancel', { enrollment_id: participantId });
      toast.success('已移除');
      setShowAdminActions(false);
      fetchData();
    } catch (err) {
      toast.error('移除失败');
    }
  };

  // Add participant manually (Admin)
  // My backend API /enrollments/join uses req.userId. 
  // If admin adds someone, they become the "creator".
  // So admin can "enroll for others".
  const handleAddParticipant = async () => {
    if (!newParticipantName.trim()) return;
    try {
      let customCreatedAt: string | undefined = undefined;

      // If adding as 'player' (active), ensure they are at the top
      // Logic: Find earliest joinedAt of current players, subtract 1 second
      // participants.players is already sorted or we can find min
      if (participants.players.length > 0) {
        // Find min joinedAt
        // Note: joinedAt string from backend is usually UTC or specific format.
        // We need to parse safely.

        const timestamps = participants.players
          .map(p => p.joinedAt ? new Date(p.joinedAt.replace(' ', 'T') + (p.joinedAt.includes('Z') ? '' : 'Z')).getTime() : Date.now());

        const minTime = Math.min(...timestamps);
        const newTime = minTime - 1000; // 1 second earlier

        // Format back to string expected by backend (ISO-like)
        customCreatedAt = new Date(newTime).toISOString().replace('T', ' ').substring(0, 19);
      }

      await api.post('/enrollments/join', {
        match_id: id,
        enrolled_for_name: newParticipantName,
        created_at: customCreatedAt
      });
      toast.success('添加成功');
      setShowAddParticipantModal(false);
      setNewParticipantName('');
      fetchData();
    } catch (err: any) {
      toast.error(err.error || '添加失败');
    }
  };
  const handleOneClickScore = () => {
    if (!window.confirm('确定要给所有上场人员给10积分吗？')) return;
    const newScores: Record<string, string> = {};
    participants.players.forEach(p => {
      newScores[p.id] = "10";
    });
    setScores(newScores);
    toast.success('已全部设置为10积分，请点击保存');
  };


  const handleSaveScores = async () => {
    try {
      const updates = Object.entries(scores).map(([id, score]) => ({
        id,
        score: parseFloat(score)
      })).filter(item => !isNaN(item.score));

      if (updates.length === 0) {
        toast.info('没有有效的分数需要保存');
        return;
      }

      await api.post('/enrollments/scores', { scores: updates });
      toast.success('积分已保存');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('保存失败');
    }
  };

  // ... (keep rest) ...

  // 显示管理员操作菜单
  const showParticipantActions = (participant: Participant) => {
    const isOwner = participant.isOwner;
    const isRestricted = ['finished-pending', 'finished-completed', 'cancelled'].includes(tournament?.status);

    // Logic: 
    // 1. Not admin AND not owner => Return
    // 2. Not admin AND isOwner AND isRestricted => Return
    if ((!userInfo?.role || userInfo.role !== 'admin')) {
      if (!isOwner) return;
      if (isRestricted) return;
    }

    setSelectedParticipant(participant);
    setShowAdminActions(!showAdminActions);
  };

  // 获取用户角色
  const isAdmin = userInfo?.role === 'admin';

  // Helper functions
  const getStatusText = (status: TournamentStatus | string) => {
    const statusMap: Record<string, string> = {
      'pre-registration': '预报名',
      'registration': '报名中',
      'waiting-list': '可候补',
      'full': '已满员',
      'finished': '已结束',
      'finished-pending': '待结算',
      'finished-completed': '已结束',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: TournamentStatus | string) => {
    const colorMap: Record<string, string> = {
      'pre-registration': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'registration': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'waiting-list': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'full': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      'finished': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const handleShare = () => {
    setShowShareModal(true);
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

          <h1 className="text-lg font-bold">活动详情</h1>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <MessageCenter />
          </div>
        </div>
      </header>

      {tournament ? (
        <main className="flex-1 container mx-auto px-4 py-6 pb-32">
          {/* 活动图片和基本信息 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-xl overflow-hidden mb-6"
          >
            <img
              src={tournament.image}
              alt={tournament.name}
              className="w-full aspect-[16/3] object-cover"
            />
            <div className="absolute top-3 right-3 flex space-x-2">
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getStatusColor(tournament.status)}`}>
                {getStatusText(tournament.status)}
              </span>
              {tournament.isPopular && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-500 text-white">
                  热门
                </span>
              )}
            </div>
          </motion.div>

          {/* 活动标题和操作按钮 */}
          {/* 活动标题和操作按钮 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex justify-between items-start"
          >
            <div className="flex-1 pr-4">
              <h2 className="text-2xl font-bold">{tournament.name}</h2>

              <div className="flex flex-col space-y-2 mt-2 text-gray-500 dark:text-gray-400">
                <div className="flex items-center text-sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>{formatTournamentDateTime(tournament.startDateTime || tournament.date + ' ' + tournament.startTime, tournament.endDateTime || tournament.date + ' ' + tournament.endTime)}</span>
                </div>

                <div className="flex items-center text-sm">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span>{tournament.location}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end space-y-2">
              <button
                onClick={handleShare}
                className="flex items-center text-gray-400 hover:text-gray-600 transition-colors text-sm"
              >
                <Share2 className="h-4 w-4 mr-1" />
                <span>分享</span>
              </button>
              {isAdmin && (
                <a
                  href={`/sportsreg/api/enrollments/${id}/export`}
                  download
                  className="flex items-center text-gray-400 hover:text-gray-600 transition-colors text-sm"
                >
                  <Download className="h-4 w-4 mr-1" />
                  <span>下载</span>
                </a>
              )}
            </div>
          </motion.div>

          {/* 费用结算 - 仅已报名用户或管理员可见 */}
          {(tournament.status === 'finished-pending' || tournament.status === 'finished-completed') &&
            (isMeRegistered || isAdmin) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6"
              >
                <h3 className="text-lg font-bold mb-4 flex items-center">
                  <Shield className="h-5 w-5 text-green-500 mr-2" />
                  费用结算
                </h3>

                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mb-4">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-500 dark:text-gray-400">总费用</span>
                    <span className="font-bold text-lg">¥{tournament.totalCost || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-500 dark:text-gray-400">上场人数</span>
                    <span className="font-medium">{participants.players.length} 人</span>
                  </div>
                  <div className="border-t border-green-200 dark:border-green-800 my-2"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">人均费用</span>
                    <span className="font-bold text-red-500">
                      ¥{participants.players.length > 0 ? (tournament.totalCost / participants.players.length).toFixed(2) : 0}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const unitCost = participants.players.length > 0 ? (tournament.totalCost || 0) / participants.players.length : 0;
                    // Group by User
                    const payers: Record<string, { info: Participant, count: number }> = {};
                    participants.players.forEach(p => {
                      if (!payers[p.userId]) {
                        payers[p.userId] = { info: p, count: 0 };
                      }
                      // If we found the "Self" record, update info to use it (better avatar/name source)
                      if (!p.enrolledForName) {
                        payers[p.userId].info = p;
                      }
                      payers[p.userId].count++;
                    });

                    return Object.values(payers).map(({ info, count }) => (
                      <div key={info.userId} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center">
                          <img
                            src={info.avatar || `https://space.coze.cn/api/coze_space/gen_image?image_size=square&prompt=Avatar%20placeholder&sign=b839f11cd37666ac24a66c9bfaafdb67`}
                            className="w-10 h-10 rounded-full object-cover mr-3"
                            alt={info.name}
                          />
                          <div>
                            <p className="font-medium text-sm">
                              {info.proxyName || info.name}
                              {info.isMe && <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded ml-2">我</span>}
                            </p>
                            <p className="text-xs text-gray-500">负责 {count} 人{count > 1 ? ' (含代报)' : ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${info.isMe ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
                            ¥{(unitCost * count).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* 费用说明 */}
                {tournament.costNote && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-400 rounded-md">
                    <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                      <span>📝</span>
                      <span>费用说明</span>
                    </div>
                    <p className="text-sm text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap break-words">
                      {tournament.costNote}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

          {/* 报名人员列表 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">报名人员 ({participants.players.length + participants.waitingList.length})</h3>
              <div className="flex items-center space-x-2">
                {isAdmin && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowAddParticipantModal(true)}
                    className="flex items-center space-x-1 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full"
                  >
                    <Plus className="h-4 w-4" />
                    <span>管理员加人</span>
                  </motion.button>
                )}
                {isAdmin && tournament.status === 'registration' && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={cycleLockState}
                    className={`flex items-center space-x-1 text-sm px-3 py-1 rounded-full transition-colors ${lockState === 0
                      ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      : lockState === 1
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    title={
                      lockState === 0
                        ? '未锁定：用户可自由取消报名'
                        : lockState === 1
                          ? '基本锁定：有候补时可取消，无候补时不可取消'
                          : '完全锁定：用户无法取消报名'
                    }
                  >
                    {lockState === 0 ? (
                      <Unlock className="h-4 w-4" />
                    ) : lockState === 1 ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <LockKeyhole className="h-4 w-4" />
                    )}
                    <span>
                      {lockState === 0 ? '未锁定' : lockState === 1 ? '基本锁定' : '完全锁定'}
                    </span>
                  </motion.button>
                )}
              </div>
            </div>

            {tournament.status === 'pre-registration' ? (
              <div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-3">
                  <p className="text-sm text-blue-600 dark:text-blue-300 flex items-center">
                    <Info className="h-4 w-4 mr-1" />
                    当前为预报名，会根据预报名情况预订场地 ({participants.players.length})
                  </p>
                </div>

                {/* 响应式网格布局，最少一行显示2个 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {[...participants.players, ...participants.waitingList].map((participant, index) => {
                    return (
                      <motion.div
                        key={participant.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * index }}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5 relative"
                      >
                        <div className="flex items-center">
                          <div className="relative mr-2">
                            <img
                              src={participant.avatar || `https://space.coze.cn/api/coze_space/gen_image?image_size=square&prompt=Avatar%20placeholder&sign=b839f11cd37666ac24a66c9bfaafdb67`}
                              alt={participant.name}
                              className={`h-10 w-10 rounded-full object-cover ${participant.isMe ? 'ring-2 ring-red-500' : ''}`}
                            />
                            {participant.isMe && (
                              <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold">我</span>
                              </div>
                            )}
                            {participant.proxyName && (
                              <div className={`absolute -top-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap border text-[10px] px-1.5 py-0.5 rounded-full shadow-sm z-10 ${participant.isOwner
                                ? 'bg-red-100 dark:bg-red-900 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
                                : 'bg-blue-100 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                                }`}>
                                {participant.proxyName}代报
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm ${participant.isMe ? 'text-red-500' : ''} truncate`}>{participant.name}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatDateTime(participant.joinedAt)}</p>
                          </div>
                        </div>
                        {!shouldHideCancelButton(participant) && !['finished-pending', 'finished-completed', 'cancelled'].includes(tournament.status) && (
                          <button
                            onClick={() => showParticipantActions(participant)}
                            className="absolute right-1.5 top-1.5 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}

                  {tournament.registeredCount < tournament.maxPlayers && (
                    <div className="h-16 w-full rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                      <UserPlus className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {participants.players.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">上场人员 ({participants.players.length} / {tournament.maxFieldPlayers || tournament.maxPlayers})</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {participants.players.map((participant, index) => {
                        return (
                          <motion.div
                            key={participant.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * index }}
                            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5 relative"
                          >
                            <div className="flex items-center">
                              <div className="relative mr-2">
                                <img
                                  src={participant.avatar || `https://space.coze.cn/api/coze_space/gen_image?image_size=square&prompt=Avatar%20placeholder&sign=b839f11cd37666ac24a66c9bfaafdb67`}
                                  alt={participant.name}
                                  className={`h-10 w-10 rounded-full object-cover ${participant.isMe ? 'ring-2 ring-red-500' : ''}`}
                                />
                                {participant.isMe && (
                                  <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-red-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-[10px] font-bold">我</span>
                                  </div>
                                )}
                                {participant.proxyName && (
                                  <div className={`absolute -top-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap border text-[10px] px-1.5 py-0.5 rounded-full shadow-sm z-10 ${participant.isOwner
                                    ? 'bg-red-100 dark:bg-red-900 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
                                    : 'bg-blue-100 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                                    }`}>
                                    {participant.proxyName}代报
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm ${participant.isMe ? 'text-red-500' : ''} truncate`}>{participant.name}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatDateTime(participant.joinedAt)}</p>
                              </div>
                            </div>
                            {!shouldHideCancelButton(participant) && !['finished-pending', 'finished-completed', 'cancelled'].includes(tournament.status) && (
                              <button
                                onClick={() => showParticipantActions(participant)}
                                className="absolute right-2 top-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {participants.waitingList.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">候补人员 ({participants.waitingList.length})</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {participants.waitingList.map((participant, index) => {
                        return (
                          <motion.div
                            key={participant.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * index }}
                            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5 relative"
                          >
                            <div className="flex items-center">
                              <div className="relative mr-2">
                                <img
                                  src={participant.avatar || `https://space.coze.cn/api/coze_space/gen_image?image_size=square&prompt=Avatar%20placeholder&sign=b839f11cd37666ac24a66c9bfaafdb67`}
                                  alt={participant.name}
                                  className={`h-10 w-10 rounded-full object-cover ${participant.isMe ? 'ring-2 ring-red-500' : ''}`}
                                />
                                {participant.isMe && (
                                  <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-red-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-[10px] font-bold">我</span>
                                  </div>
                                )}
                                {participant.proxyName && (
                                  <div className={`absolute -top-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap border text-[10px] px-1.5 py-0.5 rounded-full shadow-sm z-10 ${participant.isOwner
                                    ? 'bg-red-100 dark:bg-red-900 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
                                    : 'bg-blue-100 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                                    }`}>
                                    {participant.proxyName}代报
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm ${participant.isMe ? 'text-red-500' : ''} truncate`}>{participant.name}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatDateTime(participant.joinedAt)}</p>
                              </div>
                            </div>
                            {!shouldHideCancelButton(participant) && !['finished-pending', 'finished-completed', 'cancelled'].includes(tournament.status) && (
                              <button
                                onClick={() => showParticipantActions(participant)}
                                className="absolute right-2 top-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* 参加人员积分 (待结算/已结束状态) */}
          {(tournament.status === 'finished-pending' || tournament.status === 'finished-completed') && participants.players.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center">
                  <Medal className="h-5 w-5 text-yellow-500 mr-2" />
                  本次积分
                </h3>
                {isAdmin && (
                  <div className="flex items-center space-x-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleOneClickScore}
                      className="bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                      一键给分
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSaveScores}
                      className="bg-red-500 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      保存
                    </motion.button>
                  </div>
                )}
              </div>

              {!isAdmin && tournament.status === 'finished-pending' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg mb-4">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    活动已结束，等待管理员录入积分。如果您已上场，可以在此查看您获得的积分。
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {participants.players.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <div className="flex items-center">
                      <img
                        src={participant.avatar || `https://space.coze.cn/api/coze_space/gen_image?image_size=square&prompt=Avatar%20placeholder&sign=b839f11cd37666ac24a66c9bfaafdb67`}
                        alt={participant.name}
                        className="h-8 w-8 rounded-full object-cover mr-3"
                      />
                      <span className={`font-medium ${participant.isMe ? 'text-red-500' : ''}`}>
                        {participant.name}
                        {participant.isMe && ' (我)'}
                      </span>
                    </div>
                    <div>
                      {isAdmin ? (
                        <div className="flex items-center">
                          <input
                            type="number"
                            step="0.1"
                            value={scores[participant.id] || ''}
                            onChange={(e) => setScores(prev => ({ ...prev, [participant.id]: e.target.value }))}
                            className="w-20 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500 text-right"
                            placeholder="0"
                          />
                          <span className="ml-2 text-sm text-gray-500">分</span>
                        </div>
                      ) : (
                        <span className="font-bold text-lg text-yellow-600 dark:text-yellow-400">
                          {participant.score !== undefined ? (participant.score > 0 ? `+${participant.score}` : participant.score) : '-'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 活动基本信息卡片 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6"
          >
            {/* 报名人数显示 */}
            <div className="flex space-x-4">
              {tournament.status === 'pre-registration' ? (
                // 预报名状态：显示一个矩形框
                <div className="flex-1 bg-blue-100 dark:bg-blue-900/50 px-3 py-2 rounded-lg text-center">
                  <p className="text-xs text-blue-600 dark:text-blue-300">预报名人数</p>
                  <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{participants.players.length}</p>
                </div>
              ) : (
                // 其他状态：显示两个矩形框
                <>
                  <div className="flex-1 bg-green-100 dark:bg-green-900/50 px-3 py-2 rounded-lg text-center">
                    <p className="text-xs text-green-600 dark:text-green-300">报名人数</p>
                    <p className="text-lg font-bold text-green-800 dark:text-green-200">{participants.players.length}/{tournament.maxFieldPlayers || tournament.maxPlayers}</p>
                  </div>
                  <div className="flex-1 bg-yellow-100 dark:bg-yellow-900/50 px-3 py-2 rounded-lg text-center">
                    <p className="text-xs text-yellow-600 dark:text-yellow-300">候补人数</p>
                    <p className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                      {participants.waitingList.length}/{tournament.maxWaitlist}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 费用显示 (待结算/已结束) */}
            {(tournament.status === 'finished-pending' || tournament.status === 'finished-completed') && (
              <div className="flex space-x-4 mt-4">
                <div className="flex-1 bg-purple-100 dark:bg-purple-900/50 px-3 py-2 rounded-lg text-center">
                  <p className="text-xs text-purple-600 dark:text-purple-300">总花费</p>
                  <p className="text-lg font-bold text-purple-800 dark:text-purple-200">
                    ¥{tournament.totalCost || 0}
                  </p>
                </div>
                <div className="flex-1 bg-indigo-100 dark:bg-indigo-900/50 px-3 py-2 rounded-lg text-center">
                  <p className="text-xs text-indigo-600 dark:text-indigo-300">本人花费</p>
                  <p className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                    ¥{(() => {
                      const totalCost = tournament.totalCost || 0;
                      // Use actual displayed players length for calculation to be consistent with "My Count"
                      const playerCount = participants.players.length || 1;
                      const myCount = participants.players.filter(p => p.isOwner).length;
                      return ((totalCost / playerCount) * myCount).toFixed(2);
                    })()}
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* 活动详情和规则 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6"
          >
            <h3 className="text-lg font-bold mb-3 flex items-center">
              <Info className="h-5 w-5 text-red-500 mr-2" />
              活动详情
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed whitespace-pre-wrap">{tournament.description}</p>
            
            {tournament.descriptionImages && tournament.descriptionImages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {tournament.descriptionImages.map((img, idx) => (
                  <div key={idx} className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
                    <img 
                      src={img} 
                      alt={`Description ${idx + 1}`} 
                      className="w-full h-auto object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                      onClick={() => window.open(img, '_blank')}
                    />
                  </div>
                ))}
              </div>
            )}

            {tournament.rules && tournament.rules.length > 0 && (
              <>
                <h3 className="text-lg font-bold mb-3 flex items-center">
                  <Shield className="h-5 w-5 text-red-500 mr-2" />
                  活动规则
                </h3>
                <ul className="space-y-2 mb-4">
                  {tournament.rules.map((rule: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <div className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-900 text-red-500 flex items-center justify-center text-xs mr-2 mt-0.5">
                        {index + 1}
                      </div>
                      <span className="text-gray-600 dark:text-gray-300">{rule}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {tournament.contactInfo && (
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <AlertCircle className="h-4 w-4 mr-2" />
                <span>如有疑问，请联系：{tournament.contactInfo}</span>
              </div>
            )}
          </motion.div>

          {/* 操作按钮 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="fixed bottom-[69px] left-0 right-0 z-30 p-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 shadow-lg"
          >
            <div className="container mx-auto px-4">
              {(tournament.status === 'pre-registration' || tournament.status === 'registration' || tournament.status === 'waiting-list' || tournament.status === 'full') && (
                (() => {
                  const totalRegistered = participants.players.length + participants.waitingList.length;
                  let buttonText = '';
                  let isDisabled = false;
                  let bgClass = 'bg-gradient-to-r from-red-500 to-orange-400 text-white hover:opacity-90';

                  if (tournament.status === 'pre-registration') {
                    const a = tournament.maxPlayers - totalRegistered;
                    if (a > 0) {
                      buttonText = `预报名 (剩余${a}个名额)`;
                    } else {
                      buttonText = '当前预报名已满';
                      isDisabled = true;
                    }
                  } else {
                    const maxField = tournament.maxFieldPlayers || tournament.maxPlayers;
                    const b = maxField - totalRegistered;

                    if (b > 0) {
                      buttonText = `报名 (剩余${b}个名额)`;
                    } else {
                      const maxWait = tournament.maxWaitlist || 0;
                      const c = (maxField + maxWait) - totalRegistered;
                      if (c > 0) {
                        buttonText = `报名已满，还可以候补${c}人`;
                      } else {
                        buttonText = '当前报名已满';
                        isDisabled = true;
                      }
                    }
                  }

                  if (isDisabled) {
                    bgClass = 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-not-allowed';
                  }

                  return (
                    <motion.button
                      whileTap={!isDisabled ? { scale: 0.98 } : {}}
                      onClick={(e) => {
                        if (isDisabled) {
                          e.preventDefault();
                          return;
                        }
                        handleRegister();
                      }}
                      className={`w-full py-3 rounded-xl font-medium transition-colors ${bgClass}`}
                      disabled={isDisabled}
                    >
                      {buttonText}
                    </motion.button>
                  );
                })()
              )}
            </div>
          </motion.div>
        </main>
      ) : (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
        </div>
      )
      }

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

      {/* 报名模态框 */}
      {
        showRegisterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
            onClick={() => setShowRegisterModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white dark:bg-gray-800 rounded-t-xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4">选择报名方式</h3>

              <div className="flex space-x-4 mb-6">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => !isMeRegistered && setRegisterType('self')}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors ${registerType === 'self'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    } ${isMeRegistered ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={isMeRegistered}
                >
                  {isMeRegistered ? '已报名' : '为自己报名'}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const limit = tournament?.proxyLimit ?? 2;
                    if (limit > 0 && myProxyCount < limit) {
                      setRegisterType('other');
                    }
                  }}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors ${registerType === 'other'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    } ${(tournament?.proxyLimit === 0 || (tournament?.proxyLimit > 0 && myProxyCount >= tournament.proxyLimit)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={tournament?.proxyLimit === 0 || (tournament?.proxyLimit > 0 && myProxyCount >= tournament.proxyLimit)}
                  style={{ display: tournament?.proxyLimit === 0 ? 'none' : 'block' }}
                >
                  {tournament?.proxyLimit > 0 && myProxyCount >= tournament.proxyLimit ? `代报已达上限(${tournament.proxyLimit})` : '为他人报名'}
                </motion.button>
              </div>

              {registerType === 'other' && (
                <div className="mb-6">
                  <label htmlFor="otherName" className="block text-sm font-medium mb-1">
                    被报名人姓名<span className="text-red-500 dark:text-yellow-400">(为他人报名无法获得活动积分)</span>
                  </label>
                  <input
                    type="text"
                    id="otherName"
                    value={otherPersonName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtherPersonName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 transition-colors"
                    placeholder="请输入被报名人的姓名"
                  />
                </div>
              )}

              <div className="flex space-x-4"><motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowRegisterModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                取消
              </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={confirmRegister}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-400 text-white font-medium hover:opacity-90 transition-opacity"
                >
                  确认报名
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )
      }

      {/* 分享模态框 */}
      {showShareModal && (
        <TournamentShareModal
          tournament={tournament}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* 管理员：添加人员模态框 */}
      {
        showAddParticipantModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
            onClick={() => setShowAddParticipantModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white dark:bg-gray-800 rounded-t-xl w-full max-w-md p-6"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4">管理员加人(强制上场)</h3>

              <div className="mb-4">
                <label htmlFor="participantName" className="block text-sm font-medium mb-1">
                  姓名
                </label>
                <input
                  type="text"
                  id="participantName"
                  value={newParticipantName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewParticipantName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 transition-colors"
                  placeholder="请输入报名人员姓名"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  类型
                </label>
                <div className="flex space-x-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setNewParticipantType('player')}
                    className={`flex-1 py-2 rounded-xl font-medium text-sm transition-colors ${newParticipantType === 'player'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}
                  >
                    上场人员
                  </motion.button>


                </div>
              </div>

              <div className="flex space-x-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAddParticipantModal(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  取消
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddParticipant}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-400 text-white font-medium hover:opacity-90 transition-opacity"
                >
                  确认添加
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )
      }

      {/* 管理员：操作菜单 */}
      {
        showAdminActions && selectedParticipant && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-lg z-50 border border-gray-200 dark:border-gray-700 w-48"
          >
            <div className="py-1">
              <button
                onClick={() => {
                  handleDeleteParticipant(selectedParticipant.id);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X className="h-4 w-4 inline mr-2" />
                {isAdmin ? '删除人员' : '取消报名'}
              </button>
              <button
                onClick={() => setShowAdminActions(false)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                取消
              </button>
            </div>
          </motion.div>
        )
      }
    </div >
  );
}