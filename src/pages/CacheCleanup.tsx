import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Sun,
    Moon,
    Trash2,
    FileText,
    Bell,
    MessageSquare,
    Image,
    FolderOpen,
    HardDrive,
    Loader2,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import AuthGuard from '@/components/AuthGuard';
import { api } from '@/lib/api';

interface CleanupStats {
    enrollmentLogs: number;
    notifications: number;
    wxSubscriptions: number;
    uploadedAvatars: {
        total: number;
        totalSize: number;
        unused: number;
        used: number;
    };
    tempFiles: {
        count: number;
        size: number;
    };
    serverLog: {
        size: number;
        exists: boolean;
    };
}

// 格式化文件大小
function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function CacheCleanup() {
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [stats, setStats] = useState<CleanupStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [cleaningItem, setCleaningItem] = useState<string | null>(null);

    // 加载统计数据
    const loadStats = async () => {
        setIsLoading(true);
        try {
            const data = await api.get('/cleanup/stats');
            setStats(data);
        } catch (err) {
            toast.error('加载统计数据失败');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    // 清理函数
    const handleCleanup = async (type: string, name: string) => {
        if (!window.confirm(`确定要清理「${name}」吗？此操作不可撤销。`)) {
            return;
        }

        setCleaningItem(type);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/sportsreg/api/cleanup/${type}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '清理失败');
            }

            const result = await response.json();
            // result.deleted 是删除的数量，result.clearedSize 是清空的大小（仅用于服务器日志）
            const description = result.deleted !== undefined
                ? `已清理 ${result.deleted} 项`
                : result.clearedSize ? `已清理 ${formatSize(result.clearedSize)}` : '清理完成';
            toast.success(`${name} 清理完成`, { description });

            // 刷新统计
            loadStats();
        } catch (err: any) {
            toast.error(err.message || '清理失败');
        } finally {
            setCleaningItem(null);
        }
    };

    // 清理所有
    const handleCleanupAll = async () => {
        if (!window.confirm('确定要清理所有缓存和日志吗？此操作不可撤销。\n\n注意：正在使用的头像不会被删除。')) {
            return;
        }

        setCleaningItem('all');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/sportsreg/api/cleanup/all', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '清理失败');
            }

            toast.success('全部清理完成');
            loadStats();
        } catch (err: any) {
            toast.error(err.message || '清理失败');
        } finally {
            setCleaningItem(null);
        }
    };

    // 清理项配置
    const cleanupItems = stats ? [
        {
            key: 'enrollment-logs',
            name: '报名日志',
            icon: FileText,
            iconBg: 'bg-blue-100 dark:bg-blue-900',
            iconColor: 'text-blue-500 dark:text-blue-300',
            count: stats.enrollmentLogs,
            description: '记录每次报名/取消操作的日志'
        },
        {
            key: 'notifications',
            name: '通知记录',
            icon: Bell,
            iconBg: 'bg-yellow-100 dark:bg-yellow-900',
            iconColor: 'text-yellow-500 dark:text-yellow-300',
            count: stats.notifications,
            description: '用户通知历史记录'
        },
        {
            key: 'wx-subscriptions',
            name: '微信订阅记录',
            icon: MessageSquare,
            iconBg: 'bg-green-100 dark:bg-green-900',
            iconColor: 'text-green-500 dark:text-green-300',
            count: stats.wxSubscriptions,
            description: '用户微信订阅授权记录'
        },
        {
            key: 'uploaded-avatars',
            name: '未使用的头像',
            icon: Image,
            iconBg: 'bg-purple-100 dark:bg-purple-900',
            iconColor: 'text-purple-500 dark:text-purple-300',
            count: stats.uploadedAvatars.unused,
            size: stats.uploadedAvatars.totalSize,
            description: `共 ${stats.uploadedAvatars.total} 个头像，${stats.uploadedAvatars.used} 个正在使用`
        },
        {
            key: 'temp-files',
            name: '临时文件',
            icon: FolderOpen,
            iconBg: 'bg-orange-100 dark:bg-orange-900',
            iconColor: 'text-orange-500 dark:text-orange-300',
            count: stats.tempFiles.count,
            size: stats.tempFiles.size,
            description: '上传时产生的临时文件'
        },
        {
            key: 'server-log',
            name: '服务器日志',
            icon: HardDrive,
            iconBg: 'bg-red-100 dark:bg-red-900',
            iconColor: 'text-red-500 dark:text-red-300',
            size: stats.serverLog.size,
            description: '服务器运行日志文件'
        }
    ] : [];

    return (
        <AuthGuard requiredRole="admin">
            <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
                {/* 顶部导航 */}
                <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
                    <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                        <button
                            onClick={() => navigate('/admin')}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <h1 className="text-lg font-bold">缓存日志清理</h1>

                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                        </button>
                    </div>
                </header>

                <main className="flex-1 container mx-auto px-4 py-6">
                    {/* 说明信息 */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-300 rounded-xl p-4 mb-6 flex items-start"
                    >
                        <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium">注意事项</p>
                            <p className="text-sm mt-1">
                                清理操作不可撤销。正在使用的用户头像不会被删除。
                            </p>
                        </div>
                    </motion.div>

                    {/* 加载中 */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
                            <p className="mt-4 text-gray-500">加载统计数据...</p>
                        </div>
                    ) : (
                        <>
                            {/* 清理项列表 */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="space-y-3"
                            >
                                {cleanupItems.map((item, index) => {
                                    const Icon = item.icon;
                                    const isEmpty = (item.count === 0 || item.count === undefined) && (!item.size || item.size === 0);

                                    return (
                                        <motion.div
                                            key={item.key}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-start flex-1 mr-4">
                                                    <div className={`${item.iconBg} p-3 rounded-full mr-3 flex-shrink-0`}>
                                                        <Icon className={`h-5 w-5 ${item.iconColor}`} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-medium text-base dark:text-gray-100">{item.name}</h4>
                                                            {isEmpty && (
                                                                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                                                                    已清空
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                            {item.description}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-2 text-sm">
                                                            {item.count !== undefined && (
                                                                <span className="text-gray-600 dark:text-gray-300">
                                                                    {item.count} 条
                                                                </span>
                                                            )}
                                                            {item.size !== undefined && item.size > 0 && (
                                                                <span className="text-gray-600 dark:text-gray-300">
                                                                    {formatSize(item.size)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleCleanup(item.key, item.name)}
                                                    disabled={isEmpty || cleaningItem !== null}
                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                            ${isEmpty || cleaningItem !== null
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                                            : 'bg-red-500 text-white hover:bg-red-600'
                                                        }`}
                                                >
                                                    {cleaningItem === item.key ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : isEmpty ? (
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                    <span>{isEmpty ? '已清空' : '清理'}</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>

                            {/* 一键清理 */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="mt-6"
                            >
                                <button
                                    onClick={handleCleanupAll}
                                    disabled={cleaningItem !== null}
                                    className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2
                    ${cleaningItem !== null
                                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-red-500 to-orange-400 text-white hover:opacity-90'
                                        }`}
                                >
                                    {cleaningItem === 'all' ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-5 w-5" />
                                    )}
                                    <span>一键清理全部</span>
                                </button>
                            </motion.div>
                        </>
                    )}
                </main>

                {/* 底部安全区域 */}
                <div className="h-6"></div>
            </div>
        </AuthGuard>
    );
}
