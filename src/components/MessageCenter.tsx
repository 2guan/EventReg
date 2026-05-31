import { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function MessageCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications');
            setNotifications(res);
            // 计算未读数量
            setUnreadCount(res.filter((n: any) => !n.is_read).length);
        } catch (err) {
            console.error('Failed to fetch notifications');
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        } else {
            // Poll count periodically or just fetch on mount
            fetchNotifications();
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [containerRef]);

    const handleMarkAsRead = async (id: number, isRead: boolean) => {
        if (isRead) return;
        try {
            await api.post(`/notifications/${id}/read`, {});
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark as read');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.post('/notifications/read-all', {});
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);
            toast.success('全部已读');
        } catch (err) {
            toast.error('操作失败');
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm('确定要删除所有消息吗？')) return;
        try {
            await api.delete('/notifications/delete-all');
            setNotifications([]);
            setUnreadCount(0);
            toast.success('全部已删除');
        } catch (err) {
            toast.error('删除失败');
        }
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const deletedNotification = notifications.find(n => n.id === id);
            await api.delete(`/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
            // 如果删除的是未读消息,减少未读计数
            if (deletedNotification && !deletedNotification.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
            toast.success('消息已删除');
        } catch (err) {
            toast.error('删除失败');
        }
    };

    const formatDate = (dateString: string) => {
        // SQLite CURRENT_TIMESTAMP is UTC 'YYYY-MM-DD HH:MM:SS'
        // Treat as UTC by replacing space with T and appending Z if needed
        let safeDate = dateString;
        if (safeDate && !safeDate.includes('T') && !safeDate.includes('Z')) {
            safeDate = safeDate.replace(' ', 'T') + 'Z';
        }

        try {
            return new Date(safeDate).toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
            >
                <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white border-2 border-white dark:border-gray-800">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden"
                    >
                        <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-bold text-gray-800 dark:text-gray-200">消息中心</h3>
                            {/* 操作按钮（放在头部） */}
                            {notifications.length > 0 && (
                                <div className="flex gap-1.5 ml-auto mr-2">
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="px-2 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        ✓ 全部已读
                                    </button>
                                    <button
                                        onClick={handleDeleteAll}
                                        className="px-2 py-0.5 text-[10px] rounded bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                        × 清空
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>


                        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2">
                            {notifications.length > 0 ? (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        onClick={() => handleMarkAsRead(n.id, n.is_read)}
                                        className={`p-3 bg-white dark:bg-gray-700/50 rounded-lg border relative group hover:shadow-sm transition-all cursor-pointer ${n.is_read
                                            ? 'border-gray-100 dark:border-gray-700 opacity-60'
                                            : 'border-l-4 border-l-blue-500 border-gray-100 dark:border-gray-700'
                                            }`}
                                    >
                                        <div className="pr-10">
                                            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{n.content}</p>
                                            <p className="text-xs text-gray-400 mt-2">{formatDate(n.created_at)}</p>
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(n.id, e)}
                                            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                                            title="删除消息"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                                    暂无新消息
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

