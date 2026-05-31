import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import { ArrowLeft, Sun, Moon, Filter, Calendar, User, Search, X, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import AuthGuard from '@/components/AuthGuard';
import { api } from '@/lib/api';

interface LogEntry {
    id: number;
    recordTime: string;
    enrollTime: string;
    userId: number;
    username: string;
    nickname: string;
    enrolledForName: string;
    matchId: number;
    matchTitle: string;
    matchTime: string;
    matchDuration: number;
    operation: 'join' | 'cancel';
}

interface MatchOption {
    id: number;
    title: string;
    time: string;
}

export default function ActivityLog() {
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [matches, setMatches] = useState<MatchOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

    // 筛选条件
    const [filterMatchId, setFilterMatchId] = useState<string>('');
    const [filterOperation, setFilterOperation] = useState<string>('');
    const [filterKeyword, setFilterKeyword] = useState<string>('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [logsRes, matchesRes] = await Promise.all([
                api.get('/logs/enrollments'),
                api.get('/logs/matches')
            ]);
            setLogs(logsRes);
            setMatches(matchesRes);
        } catch (err) {
            toast.error('加载日志失败');
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = async () => {
        setLoading(true);
        try {
            let url = '/logs/enrollments?';
            if (filterMatchId) url += `match_id=${filterMatchId}&`;
            if (filterOperation) url += `operation=${filterOperation}&`;
            const logsRes = await api.get(url);
            setLogs(logsRes);
        } catch (err) {
            toast.error('筛选失败');
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setFilterMatchId('');
        setFilterOperation('');
        setFilterKeyword('');
        fetchData();
    };

    // 清空所有日志
    const handleClearLogs = async () => {
        if (!confirm('确定要清空所有日志吗？此操作不可恢复。')) return;
        try {
            await api.delete('/logs/enrollments');
            toast.success('日志已清空');
            setLogs([]);
        } catch (err) {
            toast.error('清空日志失败');
        }
    };

    // 格式化时间显示: 2025.12.1 17:09 (直接解析字符串，不做时区转换)
    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '-';
        // 期望格式: "2025-12-14 22:28:33" 或 "2025-12-14T22:28:33"
        const cleanStr = dateStr.replace('T', ' ').substring(0, 19);
        const [datePart, timePart] = cleanStr.split(' ');
        if (!datePart || !timePart) return dateStr;

        const [year, month, day] = datePart.split('-');
        const [hours, minutes] = timePart.split(':');
        return `${year}.${parseInt(month)}.${parseInt(day)} ${hours}:${minutes}`;
    };

    // 格式化活动时间显示
    const formatMatchTime = (timeStr: string, durationMinutes: number) => {
        if (!timeStr) return '-';
        const start = new Date(timeStr);
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

        const formatPart = (d: Date) => {
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return { month, day, time: `${hours}:${minutes}` };
        };

        const startPart = formatPart(start);
        const endPart = formatPart(end);

        // 判断是否跨天
        if (start.toDateString() === end.toDateString()) {
            return `${startPart.month}月${startPart.day}日 ${startPart.time}-${endPart.time}`;
        } else {
            return `${startPart.month}月${startPart.day}日 ${startPart.time}-${endPart.month}月${endPart.day}日 ${endPart.time}`;
        }
    };

    // 关键词过滤（客户端）
    const filteredLogs = logs.filter(log => {
        if (!filterKeyword) return true;
        const keyword = filterKeyword.toLowerCase();
        return (
            log.username.toLowerCase().includes(keyword) ||
            log.nickname.toLowerCase().includes(keyword) ||
            log.enrolledForName.toLowerCase().includes(keyword) ||
            log.matchTitle.toLowerCase().includes(keyword)
        );
    });

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

                        <h1 className="text-lg font-bold">活动日志</h1>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={fetchData}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="刷新"
                            >
                                <RefreshCw className="h-5 w-5" />
                            </button>
                            <button
                                onClick={handleClearLogs}
                                className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                                title="清空日志"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`p-2 rounded-full transition-colors ${showFilters ? 'bg-red-100 text-red-500 dark:bg-red-900 dark:text-red-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                <Filter className="h-5 w-5" />
                            </button>
                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>
                </header>

                {/* 筛选面板 */}
                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
                    >
                        <div className="container mx-auto px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                {/* 活动筛选 */}
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">活动</label>
                                    <select
                                        value={filterMatchId}
                                        onChange={(e) => setFilterMatchId(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                                    >
                                        <option value="">全部活动</option>
                                        {matches.map(m => (
                                            <option key={m.id} value={m.id}>{m.title}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 操作类型 */}
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">操作类型</label>
                                    <select
                                        value={filterOperation}
                                        onChange={(e) => setFilterOperation(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                                    >
                                        <option value="">全部</option>
                                        <option value="join">报名</option>
                                        <option value="cancel">取消报名</option>
                                    </select>
                                </div>

                                {/* 关键词搜索 */}
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">关键词搜索</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={filterKeyword}
                                            onChange={(e) => setFilterKeyword(e.target.value)}
                                            placeholder="用户名/昵称/活动名"
                                            className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                                        />
                                        <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    </div>
                                </div>

                                {/* 操作按钮 */}
                                <div className="flex items-end space-x-2">
                                    <button
                                        onClick={handleFilter}
                                        className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium"
                                    >
                                        筛选
                                    </button>
                                    <button
                                        onClick={clearFilters}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )
                }

                {/* 主内容区 */}
                <main className="flex-1 container mx-auto px-4 py-4">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            {/* 桌面端表格 */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                                            <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">记录时间</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">报名时间</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">用户名</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">昵称</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">报名人姓名</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">活动名称</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">活动时间</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">操作类型</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLogs.length > 0 ? (
                                            filteredLogs.map((log) => (
                                                <tr key={log.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDateTime(log.recordTime)}</td>
                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDateTime(log.enrollTime)}</td>
                                                    <td className="px-4 py-3">{log.username}</td>
                                                    <td className="px-4 py-3">{log.nickname}</td>
                                                    <td className="px-4 py-3">{log.enrolledForName}</td>
                                                    <td className="px-4 py-3 max-w-[200px] truncate" title={log.matchTitle}>{log.matchTitle}</td>
                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatMatchTime(log.matchTime, log.matchDuration)}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${log.operation === 'join'
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                            }`}>
                                                            {log.operation === 'join' ? '报名' : '取消报名'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                                    暂无日志数据
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* 移动端卡片列表 */}
                            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <div key={log.id} className="p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="flex items-center space-x-2">
                                                        <span className="font-medium">{log.nickname}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.operation === 'join'
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                            }`}>
                                                            {log.operation === 'join' ? '报名' : '取消报名'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        @{log.username}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                                    {formatDateTime(log.recordTime)}
                                                </div>
                                            </div>

                                            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                                <div className="flex items-center">
                                                    <User className="h-3 w-3 mr-1 text-gray-400" />
                                                    <span>报名人: {log.enrolledForName}</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                                                    <span className="truncate">{log.matchTitle}</span>
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {formatMatchTime(log.matchTime, log.matchDuration)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                                        暂无日志数据
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 数据统计 */}
                    <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        共 {filteredLogs.length} 条记录
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
