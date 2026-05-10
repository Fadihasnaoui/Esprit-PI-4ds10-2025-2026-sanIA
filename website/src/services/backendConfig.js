const DEFAULT_BACKEND_ORIGIN = 'http://127.0.0.1:8000';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const normalizeBackendOrigin = (value) => {
  const raw = trimTrailingSlash(value || DEFAULT_BACKEND_ORIGIN);
  return raw.endsWith('/api/v1') ? raw.slice(0, -'/api/v1'.length) : raw;
};

export const BACKEND_ORIGIN = normalizeBackendOrigin(
  import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL
);

/** DEV: proxied `/api/v1` (vite.config.js → FastAPI). PROD/build: explicit backend origin. */
export const API_BASE_URL = import.meta.env.DEV ? '/api/v1' : `${BACKEND_ORIGIN}/api/v1`;
export const DATA_BASE_URL = `${BACKEND_ORIGIN}/Data`;
export const WS_BASE_URL = BACKEND_ORIGIN.replace(/^http/, 'ws');

