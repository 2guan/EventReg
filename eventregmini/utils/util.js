/**
 * 格式化日期时间显示
 * 与网页版 formatTournamentDateTime 保持一致
 * @param {string} startDateTime - 开始时间
 * @param {string} endDateTime - 结束时间
 * @returns {string} 格式化后的字符串
 */
function formatTournamentDateTime(startDateTime, endDateTime) {
    if (!startDateTime) return '';

    // 解析日期时间字符串为Date对象
    function parseDateTime(str) {
        if (!str) return null;
        // 处理各种格式
        let s = str;
        if (s.includes(' ') && !s.includes('T')) {
            s = s.replace(' ', 'T');
        }
        return new Date(s);
    }

    // 格式化为两位数
    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    // 获取星期几
    function getWeekday(date) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekdays[date.getDay()];
    }

    const startDate = parseDateTime(startDateTime);
    const endDate = parseDateTime(endDateTime);

    if (!startDate || isNaN(startDate.getTime())) {
        return startDateTime; // 无法解析，返回原始字符串
    }

    // 提取日期和时间部分
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const startWeekday = getWeekday(startDate);
    const startHour = pad(startDate.getHours());
    const startMinute = pad(startDate.getMinutes());

    // 格式化开始日期: "12月20日 周六"
    const startDateStr = `${startMonth}月${startDay}日 ${startWeekday}`;
    const startTimeStr = `${startHour}:${startMinute}`;

    if (endDate && !isNaN(endDate.getTime())) {
        const endMonth = endDate.getMonth() + 1;
        const endDay = endDate.getDate();
        const endHour = pad(endDate.getHours());
        const endMinute = pad(endDate.getMinutes());

        // 判断是否同一天
        const isSameDay = startDate.getFullYear() === endDate.getFullYear() &&
            startDate.getMonth() === endDate.getMonth() &&
            startDate.getDate() === endDate.getDate();

        if (isSameDay) {
            // 同一天：12月20日 周六 06:30-08:30
            return `${startDateStr} ${startTimeStr}-${endHour}:${endMinute}`;
        } else {
            // 跨天：12月20日 06:30-12月21日 08:30
            return `${startMonth}月${startDay}日 ${startTimeStr}-${endMonth}月${endDay}日 ${endHour}:${endMinute}`;
        }
    }

    // 只有开始时间
    return `${startDateStr} ${startTimeStr}`;
}

/**
 * 格式化日期
 * @param {string} dateString - 日期字符串
 * @param {object} options - 格式化选项
 * @returns {string} 格式化后的日期
 */
function formatDate(dateString, options = {}) {
    if (!dateString) return '';

    // 处理SQLite时间格式
    let safeDate = dateString;
    if (safeDate && !safeDate.includes('T') && !safeDate.includes('Z')) {
        safeDate = safeDate.replace(' ', 'T') + 'Z';
    }

    const defaultOptions = {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...options
    };

    try {
        return new Date(safeDate).toLocaleDateString('zh-CN', defaultOptions);
    } catch (e) {
        return dateString;
    }
}

/**
 * 格式化时间
 * @param {string} dateString - 日期时间字符串
 * @returns {string} 格式化后的时间
 */
function formatTime(dateString) {
    if (!dateString) return '';

    let safeDate = dateString;
    if (safeDate && !safeDate.includes('T') && !safeDate.includes('Z')) {
        safeDate = safeDate.replace(' ', 'T') + 'Z';
    }

    try {
        return new Date(safeDate).toLocaleTimeString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (e) {
        return dateString;
    }
}

/**
 * 格式化相对时间（如：2小时前）
 * @param {string} dateString - 日期时间字符串
 * @returns {string} 相对时间
 */
function formatRelativeTime(dateString) {
    if (!dateString) return '';

    let safeDate = dateString;
    if (safeDate && !safeDate.includes('T') && !safeDate.includes('Z')) {
        safeDate = safeDate.replace(' ', 'T') + 'Z';
    }

    const now = new Date();
    const date = new Date(safeDate);
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    return formatDate(dateString, { year: undefined, month: 'short', day: 'numeric' });
}

/**
 * 格式化货币
 * @param {number} value - 金额
 * @returns {string} 格式化后的金额
 */
function formatCurrency(value) {
    if (typeof value !== 'number') return '¥0.00';
    return `¥${value.toFixed(2)}`;
}

/**
 * 计算费用 (向上取整,去掉小数点)
 * @param {number} totalCost - 总费用
 * @param {number} playerCount - 上场人数
 * @param {number} myCount - 我的报名数（包含代报名）
 * @returns {string} 我的费用
 */
function calculateMyCost(totalCost, playerCount, myCount) {
    if (!totalCost || !playerCount || playerCount === 0) return '0';
    const perPerson = totalCost / playerCount;
    return Math.ceil(perPerson * myCount).toString();
}

/**
 * 防抖函数
 * @param {function} fn - 要执行的函数
 * @param {number} delay - 延迟时间(ms)
 * @returns {function}
 */
function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

/**
 * 节流函数
 * @param {function} fn - 要执行的函数
 * @param {number} interval - 间隔时间(ms)
 * @returns {function}
 */
function throttle(fn, interval = 300) {
    let lastTime = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastTime >= interval) {
            lastTime = now;
            fn.apply(this, args);
        }
    };
}

/**
 * 深拷贝对象
 * @param {object} obj - 要拷贝的对象
 * @returns {object}
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));

    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * 检查是否为空对象
 * @param {object} obj - 要检查的对象
 * @returns {boolean}
 */
function isEmpty(obj) {
    if (!obj) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
}

module.exports = {
    formatTournamentDateTime,
    formatDate,
    formatTime,
    formatRelativeTime,
    formatCurrency,
    calculateMyCost,
    debounce,
    throttle,
    deepClone,
    isEmpty
};
