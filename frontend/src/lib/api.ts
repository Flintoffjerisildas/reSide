import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add a request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    const msg = error?.response?.data?.msg || error?.response?.data?.message || '';

    // Only clear credentials and trigger forced logout on genuine authentication failure:
    // 1) The authentication verification endpoint (/auth/me) returns 401 or 403
    // 2) Status is 401 AND the response explicitly indicates token invalidity/expiry
    // Never logout on resource authorization errors (403 or non-token 401s like ownership checks)
    const isAuthEndpoint = typeof url === 'string' && (url.includes('/auth/me') || url.includes('/auth/verify'));
    const isTokenError =
      status === 401 && (
        isAuthEndpoint ||
        msg === 'Token is not valid' ||
        msg === 'No token, authorization denied' ||
        msg === 'jwt expired' ||
        (typeof msg === 'string' && msg.toLowerCase().includes('token'))
      );

    if (isTokenError) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('reside:logout'));
    }
    return Promise.reject(error);
  }
);

export default api;

type TranslateResponse = {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  englishText?: string;
  tamilText?: string;
};

const translateCache = new Map<string, TranslateResponse>();

export async function translateText(text: string, targetLanguage?: 'en' | 'ta'): Promise<TranslateResponse> {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return { originalText: '', translatedText: '', detectedLanguage: 'unknown', englishText: '', tamilText: '' };
  }

  const target = targetLanguage || 'en';
  const cacheKey = `${target}::${normalized}`;
  const cached = translateCache.get(cacheKey);
  if (cached) return cached;

  const res = await api.post('/translate', { text: normalized, targetLanguage: target });
  const data = (res?.data || {}) as TranslateResponse;

  const result: TranslateResponse = {
    originalText: typeof data.originalText === 'string' ? data.originalText : normalized,
    translatedText: typeof data.translatedText === 'string' ? data.translatedText : normalized,
    detectedLanguage: typeof data.detectedLanguage === 'string' ? data.detectedLanguage : 'unknown',
    englishText: typeof data.englishText === 'string' ? data.englishText : undefined,
    tamilText: typeof data.tamilText === 'string' ? data.tamilText : undefined
  };

  translateCache.set(cacheKey, result);
  return result;
}
