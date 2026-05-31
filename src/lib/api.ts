const BASE_URL = '/sportsreg/api';
console.log('Current API BASE_URL:', BASE_URL);

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
    const { timeout = 8000 } = options as any;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export const api = {
    get: async (url: string) => {
        try {
            const res = await fetchWithTimeout(`${BASE_URL}${url}`, {
                headers: getHeaders(),
            });
            if (!res.ok) {
                if (res.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/sportsreg/login';
                }
                throw new Error(res.statusText);
            }
            return res.json();
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时，请检查后端服务是否启动');
            }
            throw error;
        }
    },
    post: async (url: string, body: any) => {
        try {
            const res = await fetchWithTimeout(`${BASE_URL}${url}`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(body),
            });
            return res;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                // Return a mock response structure for timeout to be handled by caller or throw?
                // Login.tsx expects .json(), so let's throw manageable error 
                throw new Error('请求超时，后端服务可能未启动');
            }
            throw error;
        }
    },
    put: async (url: string, body: any) => {
        const res = await fetchWithTimeout(`${BASE_URL}${url}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        return res;
    },
    delete: async (url: string) => {
        const res = await fetchWithTimeout(`${BASE_URL}${url}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        return res;
    },
    patch: async (url: string, body: any) => {
        const res = await fetchWithTimeout(`${BASE_URL}${url}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw data;
        }
        return res.json();
    }
};
