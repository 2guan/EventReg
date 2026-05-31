import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { ArrowLeft, Search, User, PlusCircle, MinusCircle, Save, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import AuthGuard from '@/components/AuthGuard';

interface UserData {
    id: number;
    username: string;
    nickname: string;
    role: 'admin' | 'user' | 'pending';
    avatar: string;
    total_points: number;
    created_at: string;
}

type ActionType = 'edit_profile' | 'add_points' | 'deduct_points';

export default function AdminUsers() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [actionType, setActionType] = useState<ActionType | null>(null);

    // Settings Modal
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [defaultRole, setDefaultRole] = useState<'pending' | 'user'>('pending');

    // Form Values
    const [nickname, setNickname] = useState('');
    const [role, setRole] = useState<'admin' | 'user' | 'pending'>('user');
    const [pointsDiff, setPointsDiff] = useState<string>('');
    const [password, setPassword] = useState('');
    const [avatar, setAvatar] = useState('');
    const [showAvatarSelection, setShowAvatarSelection] = useState(false);

    // Avatars
    const AVATAR_COUNT = 30;
    const avatars = Array.from({ length: AVATAR_COUNT }, (_, i) => `/sportsreg/face/defaultface-user (${i + 1}).jpg`);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const data = await api.get('/users');
            setUsers(data);
        } catch (error) {
            toast.error('获取用户列表失败');
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const data = await api.get('/settings/registration');
            setDefaultRole(data.default_role);
            setShowSettingsModal(true);
        } catch (error) {
            toast.error('获取设置失败');
        }
    };

    const saveSettings = async () => {
        try {
            await api.put('/settings/registration', { default_role: defaultRole });
            toast.success('设置已保存');
            setShowSettingsModal(false);
        } catch (error) {
            toast.error('保存设置失败');
        }
    };

    const openAction = (user: UserData, type: ActionType) => {
        setSelectedUser(user);
        setActionType(type);

        // Init values
        if (type === 'edit_profile') {
            setNickname(user.nickname);
            setRole(user.role);
            setAvatar(user.avatar || avatars[0]);
            setPassword(''); // Reset password field
        }
        if (type === 'add_points' || type === 'deduct_points') setPointsDiff('');
    };

    const handleSave = async () => {
        if (!selectedUser || !actionType) return;

        try {
            if (actionType === 'edit_profile') {
                await api.put(`/users/${selectedUser.id}`, {
                    nickname,
                    role,
                    avatar,
                    password: password || undefined // Only send if not empty
                });
                toast.success('用户信息更新成功');
            }

            else if (actionType === 'add_points' || actionType === 'deduct_points') {
                const val = parseInt(pointsDiff);
                if (isNaN(val) || val <= 0) {
                    toast.error('请输入有效的积分数值');
                    return;
                }

                // Calculate adjustment
                const adjustment = actionType === 'add_points' ? val : -val;

                await api.put(`/users/${selectedUser.id}/points`, {
                    adjustment: adjustment
                });
                toast.success('积分调整成功');
            }

            // Reset and Refresh
            setSelectedUser(null);
            setActionType(null);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.message || '操作失败');
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        if (!window.confirm(`确定要永久删除用户 "${selectedUser.nickname}" 吗？此操作不可恢复！`)) return;

        try {
            await api.delete(`/users/${selectedUser.id}`);
            toast.success('用户已删除');
            setSelectedUser(null);
            setActionType(null);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.message || '删除失败');
        }
    };


    const filteredUsers = users.filter(user =>
        user.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getModalTitle = () => {
        switch (actionType) {
            case 'edit_profile': return '编辑用户信息';
            case 'add_points': return '增加积分';
            case 'deduct_points': return '扣除积分';
            default: return '';
        }
    };

    return (
        <AuthGuard requiredRole="admin">
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white pb-10">
                {/* Header */}
                <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/admin')}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-xl font-bold">用户管理</h1>
                        </div>
                        <button
                            onClick={fetchSettings}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Settings className="w-4 h-4" />
                            <span>注册设置</span>
                        </button>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-6">
                    {/* Search */}
                    <div className="mb-6 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索用户名或昵称..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                        />
                    </div>

                    {/* List */}
                    {loading ? (
                        <div className="text-center py-10">加载中...</div>
                    ) : (
                        <>
                            {/* Mobile Card Layout */}
                            <div className="md:hidden space-y-4">
                                {filteredUsers.map(user => (
                                    <div key={user.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <img src={user.avatar} className="w-10 h-10 rounded-full object-cover bg-gray-200" alt={user.nickname} />
                                                <div>
                                                    <div className="font-medium">{user.nickname}</div>
                                                    <div className="text-xs text-gray-500">@{user.username}</div>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                                ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                    user.role === 'pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                                                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                                {user.role === 'admin' ? '管理员' : user.role === 'pending' ? '待审核' : '正式用户'}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mb-4">
                                            <span className="text-sm text-gray-500">当前积分</span>
                                            <span className="font-mono font-bold text-orange-500">{user.total_points}</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                onClick={() => openAction(user, 'edit_profile')}
                                                className="flex flex-col items-center justify-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
                                            >
                                                <User className="w-4 h-4 mb-1 text-gray-600 dark:text-gray-400" />
                                                <span className="text-[10px] text-gray-500">编辑资料</span>
                                            </button>
                                            <button
                                                onClick={() => openAction(user, 'add_points')}
                                                className="flex flex-col items-center justify-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"
                                            >
                                                <PlusCircle className="w-4 h-4 mb-1 text-green-600 dark:text-green-400" />
                                                <span className="text-[10px] text-green-600 dark:text-green-400">加分</span>
                                            </button>
                                            <button
                                                onClick={() => openAction(user, 'deduct_points')}
                                                className="flex flex-col items-center justify-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg"
                                            >
                                                <MinusCircle className="w-4 h-4 mb-1 text-red-600 dark:text-red-400" />
                                                <span className="text-[10px] text-red-600 dark:text-red-400">扣分</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table Layout */}
                            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-700">
                                        <tr>
                                            <th className="p-4 font-medium text-gray-500 text-sm">用户</th>
                                            <th className="p-4 font-medium text-gray-500 text-sm">角色</th>
                                            <th className="p-4 font-medium text-gray-500 text-sm text-right">积分</th>
                                            <th className="p-4 font-medium text-gray-500 text-sm text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {filteredUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <img src={user.avatar} className="w-10 h-10 rounded-full object-cover bg-gray-200" alt={user.nickname} />
                                                        <div>
                                                            <div className="font-medium">{user.nickname}</div>
                                                            <div className="text-xs text-gray-500">@{user.username}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                              ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                            user.role === 'pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                                        {user.role === 'admin' ? '管理员' : user.role === 'pending' ? '待审核' : '正式用户'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-medium font-mono text-orange-500">
                                                    {user.total_points}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => openAction(user, 'edit_profile')}
                                                            className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                            title="编辑资料"
                                                        >
                                                            <User className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => openAction(user, 'add_points')}
                                                            className="p-2 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                            title="增加积分"
                                                        >
                                                            <PlusCircle className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => openAction(user, 'deduct_points')}
                                                            className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            title="扣除积分"
                                                        >
                                                            <MinusCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                {/* Dynamic Action Modal */}
                <AnimatePresence>
                    {selectedUser && actionType && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
                            >
                                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                    <h3 className="text-lg font-bold">{getModalTitle()}</h3>
                                    <button onClick={() => { setSelectedUser(null); setActionType(null); }} className="text-gray-400 hover:text-gray-600">
                                        ✕
                                    </button>
                                </div>

                                <div className="p-6">
                                    <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                                        正在操作用户: <span className="font-bold text-gray-900 dark:text-white">@{selectedUser.username}</span>
                                    </div>

                                    {actionType === 'edit_profile' && (
                                        <div className="space-y-4">
                                            {/* Avatar Selection */}
                                            <div className="flex flex-col items-center mb-4">
                                                <div className="relative group cursor-pointer" onClick={() => setShowAvatarSelection(!showAvatarSelection)}>
                                                    <img src={avatar} className="w-20 h-20 rounded-full object-cover border-4 border-gray-100 dark:border-gray-700" alt="Avatar" />
                                                    <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold">
                                                        更换
                                                    </div>
                                                </div>
                                                {showAvatarSelection && (
                                                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl grid grid-cols-5 gap-2 w-full">
                                                        {avatars.map((url, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => { setAvatar(url); setShowAvatarSelection(false); }}
                                                                className={`aspect-square rounded-full overflow-hidden border-2 transition-all ${avatar === url ? 'border-red-500 scale-110' : 'border-transparent hover:border-gray-300'}`}
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
                                                    value={nickname}
                                                    onChange={e => setNickname(e.target.value)}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-1">角色</label>
                                                <select
                                                    value={role}
                                                    onChange={e => setRole(e.target.value as any)}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                                >
                                                    <option value="user">正式用户</option>
                                                    <option value="admin">管理员</option>
                                                    <option value="pending">待审核</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-1">重置密码 (留空则不修改)</label>
                                                <input
                                                    type="text"
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                    placeholder="输入新密码"
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                                                />
                                            </div>

                                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
                                                <button
                                                    onClick={handleDeleteUser}
                                                    className="w-full py-2 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors text-sm font-medium"
                                                >
                                                    删除该用户
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {(actionType === 'add_points' || actionType === 'deduct_points') && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1">
                                                {actionType === 'add_points' ? '增加点数 (正整数)' : '扣除点数 (正整数)'}
                                            </label>
                                            <input
                                                type="number"
                                                value={pointsDiff}
                                                onChange={e => setPointsDiff(e.target.value)}
                                                placeholder="输入数值"
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent font-mono text-lg"
                                                min="1"
                                                autoFocus
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-gray-700 flex justify-end gap-3">
                                    <button
                                        onClick={() => { setSelectedUser(null); setActionType(null); }}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2
                                            ${actionType === 'deduct_points' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}
                                        `}
                                    >
                                        <Save className="w-4 h-4" />
                                        确认{actionType === 'deduct_points' ? '扣除' : '保存'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                {/* Settings Modal */}
                <AnimatePresence>
                    {showSettingsModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
                            >
                                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                    <h3 className="text-lg font-bold">新用户注册设置</h3>
                                    <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600">
                                        ✕
                                    </button>
                                </div>

                                <div className="p-6">
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-2">默认状态</label>
                                        <p className="text-xs text-gray-500 mb-3">设置新用户注册后的初始状态。</p>

                                        <div className="space-y-2">
                                            <label className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <input
                                                    type="radio"
                                                    name="defaultRole"
                                                    value="pending"
                                                    checked={defaultRole === 'pending'}
                                                    onChange={() => setDefaultRole('pending')}
                                                    className="w-4 h-4 text-red-500 focus:ring-red-500"
                                                />
                                                <div className="ml-3">
                                                    <span className="block font-medium text-sm">待审核 (需管理员批准)</span>
                                                </div>
                                            </label>

                                            <label className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <input
                                                    type="radio"
                                                    name="defaultRole"
                                                    value="user"
                                                    checked={defaultRole === 'user'}
                                                    onChange={() => setDefaultRole('user')}
                                                    className="w-4 h-4 text-red-500 focus:ring-red-500"
                                                />
                                                <div className="ml-3">
                                                    <span className="block font-medium text-sm">正式用户 (自动批准)</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-gray-700 flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowSettingsModal(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={saveSettings}
                                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        保存设置
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </AuthGuard>
    );
}
