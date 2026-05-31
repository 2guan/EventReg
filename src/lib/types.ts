
export interface TournamentData {
    id: string;
    name: string;
    date: string;
    time: string;
    startTime?: string;
    endTime?: string;
    startDateTime?: Date | string;
    endDateTime?: Date | string;
    location: string;
    status: 'pre-registration' | 'registration' | 'waiting-list' | 'full' | 'finished' | 'cancelled' | 'finished-pending' | 'finished-completed';
    registeredCount: number;
    maxPlayers: number;
    maxFieldPlayers?: number;
    waitlistCount?: number;
    maxWaitlist?: number;
    image: string;
    isPopular?: boolean;
    totalAmount?: number; // 总金额/总费用
    myRegistrationCount?: number; // 自己+为他人报名的人数

    // Extra fields from TournamentFormData that might be useful
    description?: string;
    descriptionImages?: string[];
    rules?: string[];
    organizer?: string;
    contactInfo?: string;
    duration?: string;
    totalCost?: number; // Backend/Config field often mapped to totalAmount
    costNote?: string; // 费用说明
    proxyLimit?: number;
    visibility?: 'public' | 'user_hidden' | 'fully_hidden';
}
