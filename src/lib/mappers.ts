import { TournamentData } from '@/lib/types';
import { TournamentFormData } from '@/components/TournamentForm';

export interface BackendMatch {
    id: number;
    title: string;
    description: string;
    time: string;
    location: string;
    max_players: number;
    max_waitlist: number;
    duration: number | string;
    /**
     * Start time string "HH:mm" (e.g. "08:00")
     * Note: This might not be in the raw DB row, but derived or expected by frontend if available
     */
    startTime?: string;
    /**
     * End time string "HH:mm" (e.g. "10:00")
     */
    endTime?: string;
    status: number;
    config_json: string;
    created_at: string;
    registered_count?: number;
    waitlist_count?: number;
    proxy_limit?: number;
    visibility?: 'public' | 'user_hidden' | 'fully_hidden';
}

export const statusMapReverse: Record<number, string> = {
    0: 'pre-registration',
    1: 'registration',
    2: 'waiting-list',
    3: 'full',
    4: 'finished-pending',
    5: 'finished-completed',
    6: 'cancelled'
};

export const statusMap: Record<string, number> = {
    'pre-registration': 0,
    'registration': 1,
    'waiting-list': 2,
    'full': 3,
    'finished-pending': 4,
    'finished-completed': 5,
    'cancelled': 6
};

// Default image logic is handled in the mapper or component
// const defaultImage = ...

/**
 * Maps backend match data to frontend TournamentData.
 * @param match The raw backend match object.
 * @param myRegistrationCount Optional count of how many times the current user has registered for this match.
 */
export const mapBackendToFrontend = (match: BackendMatch, myRegistrationCount: number = 0): TournamentData => {
    let config: any = {};
    try {
        config = JSON.parse(match.config_json || '{}');
    } catch (e) { }

    // Calculate start/end objects
    const startDateTimeObj = new Date(match.time);
    const durationMins = Number(match.duration) || 0;
    const endDateTimeObj = new Date(startDateTimeObj.getTime() + durationMins * 60000);

    const dateStr = startDateTimeObj.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    const startTimeStr = startDateTimeObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const endTimeStr = endDateTimeObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

    // New Fields
    // Format for datetime-local input: YYYY-MM-DDThh:mm
    const toLocalDatetimeValue = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const startDateTimeStr = toLocalDatetimeValue(startDateTimeObj);
    const endDateTimeStr = toLocalDatetimeValue(endDateTimeObj);

    // Format for display will be handled by components using startDateTime/endDateTime vs date/time legacy
    const displayTime = `${startTimeStr} - ${endTimeStr}`;

    // Explicitly cast the status to the Union Type defined in TournamentData
    // Handle both string status names (e.g., "registration") and numeric codes (e.g., 1)
    const rawStatus = match.status;
    let statusStr: string;

    if (typeof rawStatus === 'string') {
        // Check if it's a numeric string like "4" or a status name like "registration"
        const numericValue = parseInt(rawStatus, 10);
        if (!isNaN(numericValue) && statusMapReverse[numericValue]) {
            statusStr = statusMapReverse[numericValue];
        } else if (Object.values(statusMapReverse).includes(rawStatus)) {
            // It's already a valid status string
            statusStr = rawStatus;
        } else {
            statusStr = 'pre-registration';
        }
    } else if (typeof rawStatus === 'number') {
        statusStr = statusMapReverse[rawStatus] || 'pre-registration';
    } else {
        statusStr = 'pre-registration';
    }

    const rawRegistered = match.registered_count || 0;
    const rawWaitlist = match.waitlist_count || 0;
    const maxField = config.maxFieldPlayers || 0;

    let displayRegistered = rawRegistered;
    let displayWaitlist = rawWaitlist;

    // If maxFieldPlayers is set and effective, shift overflow to waitlist count for display
    // BUT SKIP this for 'pre-registration', where we want to show the total count.
    if (statusStr !== 'pre-registration' && maxField > 0 && rawRegistered > maxField) {
        displayRegistered = maxField;
        displayWaitlist = rawWaitlist + (rawRegistered - maxField);
    }

    let imageUrl = config.image || `/sportsreg/banner/defaultbanner-01.jpg`;
    if (imageUrl && !imageUrl.startsWith('/sportsreg/') && (imageUrl.startsWith('/banner/') || imageUrl.startsWith('/face/'))) {
        imageUrl = '/sportsreg' + imageUrl;
    }

    // Process description images
    const descriptionImages = (config.descriptionImages || []).map((url: string) => {
        if (url && !url.startsWith('/sportsreg/') && (url.startsWith('/images/') || url.startsWith('/banner/'))) {
            return '/sportsreg' + url;
        }
        return url;
    });

    return {
        id: String(match.id),
        name: match.title,
        date: dateStr,
        time: displayTime,
        // Legacy props kept for compatibility if needed, but updated logic should use startDateTime/endDateTime
        startTime: startTimeStr,
        endTime: endTimeStr,
        startDateTime: startDateTimeStr,
        endDateTime: endDateTimeStr,
        location: match.location,
        duration: String(match.duration) + '分钟',
        maxPlayers: match.max_players,
        description: match.description || '',
        descriptionImages,
        rules: config.rules || [],
        organizer: config.organizer || '',
        contactInfo: config.contactInfo || '',
        status: statusStr as TournamentData['status'],
        isPopular: config.isPopular || false,
        maxWaitlist: match.max_waitlist || 0,
        maxFieldPlayers: config.maxFieldPlayers || 0,
        totalCost: config.totalCost || 0,
        totalAmount: config.totalCost || 0,
        costNote: config.costNote || '',
        image: imageUrl,
        registeredCount: displayRegistered,
        waitlistCount: displayWaitlist,
        myRegistrationCount: myRegistrationCount,
        proxyLimit: match.proxy_limit === undefined ? 2 : match.proxy_limit,
        visibility: match.visibility || 'public'
    };
};

export const mapFrontendToBackend = (data: TournamentFormData): Partial<BackendMatch> & { config_json: string } => {
    // Fallback/Legacy handling
    let startISO = data.startDateTime;
    let endISO = data.endDateTime;

    // If new fields are empty, try to construct from legacy fields if they exist (though removed from interface type, they might exist in runtime or legacy)
    // But since we updated the interface, we should just rely on startDateTime/endDateTime being present.
    // If they are empty strings, we default or let it fail validation.

    if (!startISO) startISO = new Date().toISOString();
    if (!endISO) endISO = new Date().toISOString();

    const startDateObj = new Date(startISO);
    const endDateObj = new Date(endISO);

    // Calculate Duration: (End - Start)
    let durationVal = 0;
    const diffMs = endDateObj.getTime() - startDateObj.getTime();
    if (diffMs > 0) {
        durationVal = Math.floor(diffMs / 60000);
    } else {
        // Fallback default
        durationVal = 90;
    }

    const config = {
        rules: data.rules,
        organizer: data.organizer,
        contactInfo: data.contactInfo,
        maxFieldPlayers: Number(data.maxFieldPlayers),
        totalCost: Number(data.totalCost),
        costNote: data.costNote || '',
        image: data.image,
        descriptionImages: data.descriptionImages || []
    };

    return {
        title: data.name,
        description: data.description,
        time: startDateObj.toISOString(), // Backend expects Start Time
        location: data.location,
        max_players: Number(data.maxPlayers),
        max_waitlist: Number(data.maxWaitlist) || 0,
        duration: durationVal,
        status: statusMap[data.status],
        proxy_limit: data.proxyLimit === undefined ? 2 : Number(data.proxyLimit),
        visibility: data.visibility || 'public',
        config_json: JSON.stringify(config)
    };
};
