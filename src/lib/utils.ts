import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string) {
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
}

/**
 * Formats tournament start and end times.
 * If same day: "YYYY-MM-DD HH:mm - HH:mm"
 * If different days: "YYYY-MM-DD HH:mm - YYYY-MM-DD HH:mm"
 */
export function formatTournamentDateTime(start: string | Date, end: string | Date): string {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const isSameDay = startDate.toDateString() === endDate.toDateString();

    if (isSameDay) {
      // Example: "12月10日 周二 08:00 - 10:00"
      const datePart = startDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
      const startTimeStr = startDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
      const endTimeStr = endDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${datePart} ${startTimeStr} - ${endTimeStr}`;
    } else {
      // Example: "12月10日 08:00 - 12月11日 10:00"
      const startDatePart = startDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      const endDatePart = endDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      const startTimeStr = startDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
      const endTimeStr = endDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${startDatePart} ${startTimeStr} - ${endDatePart} ${endTimeStr}`;
    }
  } catch (e) {
    return `${start} - ${end}`;
  }
}
