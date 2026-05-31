import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Share2, Calendar, CheckCircle2 } from 'lucide-react';
import { formatTournamentDateTime, formatDate } from '@/lib/utils';
import { TournamentData } from '@/lib/types';
import TournamentShareModal from './TournamentShareModal';

export type { TournamentData };

interface TournamentCardProps {
  tournament: TournamentData;
  index?: number;
  isEnrolled?: boolean;
  customStatusLabel?: string;
}

export default function TournamentCard({ tournament, index = 0, isEnrolled = false, customStatusLabel }: TournamentCardProps) {
  // 格式化日期显示
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', weekday: 'short' };
    return new Date(dateString).toLocaleDateString('zh-CN', options);
  };

  // 获取活动状态文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pre-registration': '预报名',
      'registration': '报名中',
      'waiting-list': '可候补',
      'full': '已满员',
      'finished': '已结束',
      'cancelled': '已取消',
      'finished-pending': '待结算',
      'finished-completed': '已结束'
    };
    return statusMap[status] || status;
  };

  // 获取状态对应的颜色类名
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      'pre-registration': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'registration': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'waiting-list': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'full': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      'finished': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'finished-pending': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'finished-completed': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const calculateConsumptionValue = () => {
    // 检查是否有总金额和报名人数
    if (!tournament.totalAmount || !tournament.myRegistrationCount || !tournament.registeredCount) {
      return '0.00';
    }

    // 计算公式：(总金额/人数)*(自己1+为他人报名的人数)
    const value = (tournament.totalAmount / tournament.registeredCount) * tournament.myRegistrationCount;
    return value.toFixed(2);
  };

  const [showShareModal, setShowShareModal] = useState(false);

  return (
    <motion.div
      key={tournament.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
    >
      <Link to={`/tournaments/${tournament.id}`} className="block">
        <div className="relative aspect-[16/3] w-full">
          <img
            src={tournament.image}
            alt={tournament.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 right-3">
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getStatusColor(tournament.status)}`}>
              {getStatusText(tournament.status)}
            </span>
          </div>

          {isEnrolled && (
            <div className="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {customStatusLabel || '已报名'}
            </div>
          )}

          {!isEnrolled && tournament.isPopular && (
            <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              热门
            </div>
          )}
        </div>

        <div className="p-4 flex justify-between">
          <div className="flex-1 pr-2">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg leading-tight">{tournament.name}</h3>
            </div>

            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
              <Calendar className="h-4 w-4 mr-1" />
              <span>{formatTournamentDateTime(tournament.startDateTime || tournament.date + ' ' + tournament.startTime, tournament.endDateTime || tournament.date + ' ' + tournament.endTime)}</span>
            </div>

            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-3">
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{tournament.location}</span>
            </div>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowShareModal(true);
              }}
              className="flex items-center text-gray-400 hover:text-gray-600 transition-colors text-sm mt-1"
            >
              <Share2 className="h-4 w-4 mr-1" />
              <span>分享</span>
            </button>
          </div>

          {/* 报名人数显示 */}
          <div className="ml-4 flex flex-col justify-center items-end">
            {(() => {
              const isParticipant = isEnrolled || (tournament.myRegistrationCount || 0) > 0;

              // 预报名状态
              if (tournament.status === 'pre-registration') {
                return (
                  <div className="bg-blue-100 dark:bg-blue-900/50 px-3 py-2 rounded-lg text-center">
                    <p className="text-xs text-blue-600 dark:text-blue-300">预报名</p>
                    <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{tournament.registeredCount + (tournament.waitlistCount || 0)}</p>
                  </div>
                );
              }

              // 待结算状态
              if (tournament.status === 'finished-pending') {
                if (isParticipant) {
                  return (
                    <div className="bg-purple-100 dark:bg-purple-900/50 px-3 py-2 rounded-lg text-center">
                      <p className="text-xs text-purple-600 dark:text-purple-300">本次花费</p>
                      <p className="text-lg font-bold text-purple-800 dark:text-purple-200">￥{calculateConsumptionValue()}</p>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-green-100 dark:bg-green-900/50 px-3 py-2 rounded-lg text-center">
                      <p className="text-xs text-green-600 dark:text-green-300">报名人数</p>
                      <p className="text-lg font-bold text-green-800 dark:text-green-200">
                        {tournament.registeredCount}/{tournament.maxFieldPlayers || tournament.maxPlayers}
                      </p>
                    </div>
                  );
                }
              }

              // 已结束状态
              if (tournament.status === 'finished-completed') {
                return (
                  <div className="bg-green-100 dark:bg-green-900/50 px-3 py-2 rounded-lg text-center">
                    <p className="text-xs text-green-600 dark:text-green-300">报名人数</p>
                    <p className="text-lg font-bold text-green-800 dark:text-green-200">
                      {tournament.registeredCount}/{tournament.maxFieldPlayers || tournament.maxPlayers}
                    </p>
                  </div>
                );
              }

              // 其他状态 (registration, waiting-list, full, cancelled)
              return (
                <>
                  <div className="bg-green-100 dark:bg-green-900/50 px-3 py-2 rounded-lg text-center mb-2">
                    <p className="text-xs text-green-600 dark:text-green-300">报名人数</p>
                    <p className="text-lg font-bold text-green-800 dark:text-green-200">
                      {tournament.registeredCount}/{tournament.maxFieldPlayers || tournament.maxPlayers}
                    </p>
                  </div>

                  <div className="bg-yellow-100 dark:bg-yellow-900/50 px-3 py-2 rounded-lg text-center">
                    <p className="text-xs text-yellow-600 dark:text-yellow-300">候补人数</p>
                    <p className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                      {tournament.waitlistCount || 0}/{tournament.maxWaitlist || 5}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </Link >
      {showShareModal && (
        <TournamentShareModal
          tournament={tournament}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </motion.div >
  );
}