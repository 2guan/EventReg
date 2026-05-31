import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import { toPng } from 'html-to-image';

// ... (keep other imports unchanged)

// Previous handleDownload implementation removed to avoid duplication.

import { X, Download, Share2, Calendar, MapPin, Loader2 } from 'lucide-react';
import { formatTournamentDateTime } from '@/lib/utils';
import { TournamentData } from '@/lib/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface TournamentShareModalProps {
    tournament: TournamentData;
    onClose: () => void;
}

export default function TournamentShareModal({ tournament, onClose }: TournamentShareModalProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [participants, setParticipants] = useState<{ players: any[], waitingList: any[] }>({ players: [], waitingList: [] });
    const [loadingParticipants, setLoadingParticipants] = useState(false);

    // Status check
    const showParticipants = tournament.status === 'registration';

    useEffect(() => {
        if (showParticipants) {
            fetchParticipants();
        }
    }, [tournament.id]);

    const fetchParticipants = async () => {
        setLoadingParticipants(true);
        try {
            const res = await api.get(`/enrollments/${tournament.id}`);
            // Simple logic to separate players and waitlist
            // Ideally should match Detail page logic, but for share card simpler is okay or we reuse logic.
            // Reuse logic roughly:
            // Reuse logic roughly:
            const allActive = res.filter((e: any) => e.status === 'active').sort((a: any, b: any) => {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                if (timeA === timeB) return a.id - b.id;
                return timeA - timeB;
            });

            const limit = tournament.maxFieldPlayers || tournament.maxPlayers || allActive.length;

            const players = allActive.slice(0, limit);
            const waitingList = allActive.slice(limit);

            setParticipants({ players, waitingList });
        } catch (err) {
            console.error(err);
            // Fail silently for share card
        } finally {
            setLoadingParticipants(false);
        }
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsGenerating(true);
        try {
            const dataUrl = await toPng(cardRef.current, {
                cacheBust: true,
                pixelRatio: 3,
            });
            const link = document.createElement('a');
            link.download = `${tournament.name}-分享卡片.png`;
            link.href = dataUrl;
            link.click();
            toast.success('图片已下载');
        } catch (err) {
            console.error(err);
            toast.error('生成图片失败');
        } finally {
            setIsGenerating(false);
        }
    };

    const getStatusText = (status: string) => {
        const map: any = {
            'pre-registration': '预报名',
            'registration': '报名中',
            'waiting-list': '可候补',
            'full': '已满员',
            'finished': '已结束',
            'finished-pending': '待结算',
            'finished-completed': '已结束',
            'cancelled': '已取消'
        };
        return map[status] || status;
    };

    const getStatusColor = (status: string) => {
        const map: any = {
            'pre-registration': 'bg-blue-100 text-blue-800',
            'registration': 'bg-green-100 text-green-800',
            'waiting-list': 'bg-yellow-100 text-yellow-800',
            'full': 'bg-gray-100 text-gray-800',
            'finished': 'bg-purple-100 text-purple-800',
            'cancelled': 'bg-red-100 text-red-800',
            'finished-pending': 'bg-orange-100 text-orange-800',
            'finished-completed': 'bg-indigo-100 text-indigo-800'
        };
        return map[status] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="relative bg-transparent"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute -top-10 right-0 p-2 text-white bg-white/20 hover:bg-white/30 rounded-full"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* The Card to Capture */}
                <div ref={cardRef} className="w-[85vw] max-w-[320px] shadow-2xl rounded-2xl bg-transparent">
                    {/* Banner as Background Image for correct sizing */}
                    <div
                        className="relative h-[120px] w-full rounded-t-2xl overflow-hidden bg-cover bg-center bg-no-repeat bg-gray-100"
                        style={{ backgroundImage: `url(${tournament.image})` }}
                    >
                        <div className="absolute top-3 right-3">
                            <span className={`text-xs font-bold px-2 py-1.5 rounded-full ${getStatusColor(tournament.status)} shadow-sm`}>
                                {getStatusText(tournament.status)}
                            </span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 bg-white rounded-b-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1 pr-3 min-w-0">
                                <h2 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{tournament.name}</h2>
                                <div className="space-y-1.5">
                                    <div className="flex items-center text-xs text-gray-500 leading-normal">
                                        <Calendar className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                                        <span>{formatTournamentDateTime(tournament.startDateTime || tournament.date + ' ' + tournament.startTime, tournament.endDateTime || tournament.date + ' ' + tournament.endTime)}</span>
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500 leading-normal">
                                        <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                                        <span>{tournament.location}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-shrink-0 bg-white p-1.5 rounded-lg border border-gray-100 shadow-sm mt-0.5">
                                <QRCodeCanvas
                                    value={`${window.location.origin}/sportsreg/tournaments/${tournament.id}`}
                                    size={60}
                                    level="M"
                                />
                            </div>
                        </div>

                        {/* Conditional Participants */}
                        {showParticipants && (
                            <>
                                {loadingParticipants ? (
                                    <div className="py-6 flex justify-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                    </div>
                                ) : (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        {/* Stats - Flex Layout */}
                                        <div className="flex gap-2 mb-4">
                                            <div className="flex-1 bg-emerald-50 rounded-lg p-2 text-center">
                                                <div className="text-[10px] text-emerald-600 mb-0.5">报名人数</div>
                                                <div className="text-base font-bold text-emerald-700 leading-none">
                                                    {participants.players.length}/{tournament.maxFieldPlayers || tournament.maxPlayers}
                                                </div>
                                            </div>
                                            <div className="flex-1 bg-amber-50 rounded-lg p-2 text-center">
                                                <div className="text-[10px] text-amber-600 mb-0.5">候补人数</div>
                                                <div className="text-base font-bold text-amber-700 leading-none">
                                                    {participants.waitingList.length}/{tournament.maxWaitlist || 0}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Players */}
                                        <div className="mb-3">
                                            <div className="text-[10px] font-medium text-gray-500 mb-2 flex justify-between">
                                                <span>上场人员 ({participants.players.length})</span>
                                            </div>
                                            <div className="flex flex-wrap gap-y-3 gap-x-1.5">
                                                {participants.players.slice(0, 10).map((p: any) => (
                                                    <div key={p.id} className="flex flex-col items-center w-[18%]">
                                                        <img
                                                            src={p.avatar}
                                                            className="w-8 h-8 rounded-full object-cover mb-1 border border-gray-100 shadow-sm"
                                                            crossOrigin="anonymous"
                                                        />
                                                        <span className="text-[9px] text-gray-600 w-full text-center block px-0.5 leading-tight pb-0.5 truncate">
                                                            {p.enrolled_for_name || p.nickname}
                                                        </span>
                                                    </div>
                                                ))}
                                                {participants.players.length === 0 && <span className="text-[10px] text-gray-400 w-full text-center py-1">暂无报名</span>}
                                            </div>
                                        </div>

                                        {/* Waitlist (if any) */}
                                        {participants.waitingList.length > 0 && (
                                            <div>
                                                <div className="text-[10px] font-medium text-gray-500 mb-2">
                                                    候补人员 ({participants.waitingList.length})
                                                </div>
                                                <div className="flex flex-wrap gap-y-3 gap-x-1.5">
                                                    {participants.waitingList.slice(0, 5).map((p: any) => (
                                                        <div key={p.id} className="flex flex-col items-center w-[18%]">
                                                            <img
                                                                src={p.avatar}
                                                                className="w-8 h-8 rounded-full object-cover mb-1 border border-gray-100 shadow-sm"
                                                                crossOrigin="anonymous"
                                                            />
                                                            <span className="text-[9px] text-gray-500 w-full text-center block px-0.5 leading-tight pb-0.5 truncate">
                                                                {p.enrolled_for_name || p.nickname}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="mt-4 w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 flex items-center justify-center transition-all active:scale-95"
                >
                    {isGenerating ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                        <Download className="w-5 h-5 mr-2" />
                    )}
                    {isGenerating ? '生成中...' : '保存图片'}
                </button>

            </motion.div>
        </div>
    );
}
