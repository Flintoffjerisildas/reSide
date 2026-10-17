/**
 * Authentication Service Availability Module for reSide
 *
 * Checks reachability and health of the external `auth_serv` microservice.
 * Reads base URL from VITE_AUTH_SERVICE_URL (default: http://localhost:3004).
 *
 * Uses the safe, unauthenticated, documented Swagger OpenAPI specification
 * endpoint (`/docs-json`) to confirm service availability and identity
 * without sending credentials, passwords, or tokens.
 */

export interface AuthServiceDetails {
  title?: string;
  version?: string;
  statusCode?: number;
  statusText?: string;
  corsDetected?: boolean;
  proxied?: boolean;
}

export interface AuthServiceStatus {
  isAvailable: boolean;
  lastChecked: Date | null;
  serviceUrl: string;
  endpointChecked: string;
  error: string | null;
  details?: AuthServiceDetails;
}

export interface AvailabilityCheckOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_AUTH_SERVICE_URL = 'http://localhost:3004';
const DEV_PROXY_PATH = '/auth-service-proxy';

/**
 * Gets the configured base URL for auth_serv.
 */
export function getAuthServiceBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_AUTH_SERVICE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_AUTH_SERVICE_URL;
}

/**
 * Checks whether an HTTP response comes from a legitimate auth_serv instance.
 */
function isAuthServiceSpec(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  // auth_serv swagger info title is "Auth Service API"
  const title = data.info?.title;
  if (typeof title === 'string' && title.toLowerCase().includes('auth service')) {
    return true;
  }
  // Fallback check for OpenAPI document structure
  return Boolean(data.openapi && data.paths && (data.paths['/auth/login'] || data.paths['/auth/register']));
}

/**
 * Performs a single fetch attempt with timeout.
 */
async function attemptFetch(
  url: string,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Connection timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const cleanup = () => clearTimeout(timer);

  let onExternalAbort: (() => void) | undefined;
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort(externalSignal.reason);
    } else {
      onExternalAbort = () => {
        clearTimeout(timer);
        controller.abort(externalSignal.reason);
      };
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/html, */*',
      },
      signal: controller.signal,
    });
    return res;
  } finally {
    cleanup();
    if (externalSignal && onExternalAbort) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Checks if auth_serv is reachable and operating.
 *
 * In browser environments, direct cross-origin calls from http://localhost:3000
 * to http://localhost:3004 are rejected by auth_serv's strict CORS configuration.
 * When direct fetch encounters CORS restriction, this function transparently
 * verifies reachability via the local Vite dev proxy (/auth-service-proxy).
 */
export async function checkAuthServiceAvailability(
  options: AvailabilityCheckOptions = {}
): Promise<AuthServiceStatus> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = getAuthServiceBaseUrl();
  const directEndpoint = `${baseUrl}/docs-json`;
  const proxyEndpoint = `${DEV_PROXY_PATH}/docs-json`;

  const timestamp = new Date();

  // Attempt 1: Check direct endpoint
  try {
    const directRes = await attemptFetch(directEndpoint, timeoutMs, options.signal);
    if (directRes.ok) {
      const data = await directRes.json().catch(() => null);
      if (isAuthServiceSpec(data)) {
        return {
          isAvailable: true,
          lastChecked: timestamp,
          serviceUrl: baseUrl,
          endpointChecked: directEndpoint,
          error: null,
          details: {
            title: data.info?.title,
            version: data.info?.version,
            statusCode: directRes.status,
            statusText: directRes.statusText,
            proxied: false,
          },
        };
      }
    }

    // Direct endpoint returned non-200 or unexpected content
    // A 401/403 would mean service is up, but /docs-json should be 200
    if (directRes.status === 401 || directRes.status === 403) {
      return {
        isAvailable: true,
        lastChecked: timestamp,
        serviceUrl: baseUrl,
        endpointChecked: directEndpoint,
        error: null,
        details: {
          statusCode: directRes.status,
          statusText: directRes.statusText,
          proxied: false,
        },
      };
    }
  } catch (directErr: any) {
    // If the request was aborted by the caller, rethrow/return offline
    if (options.signal?.aborted) {
      return {
        isAvailable: false,
        lastChecked: timestamp,
        serviceUrl: baseUrl,
        endpointChecked: directEndpoint,
        error: 'Availability check cancelled',
      };
    }
    // Direct fetch failed (likely network error or browser CORS restriction)
  }

  // Attempt 2: If direct fetch failed and we are running in browser with dev proxy
  if (typeof window !== 'undefined') {
    try {
      const proxyRes = await attemptFetch(proxyEndpoint, timeoutMs, options.signal);
      if (proxyRes.ok) {
        const data = await proxyRes.json().catch(() => null);
        if (isAuthServiceSpec(data)) {
          return {
            isAvailable: true,
            lastChecked: timestamp,
            serviceUrl: baseUrl,
            endpointChecked: proxyEndpoint,
            error: null,
            details: {
              title: data.info?.title,
              version: data.info?.version,
              statusCode: proxyRes.status,
              statusText: proxyRes.statusText,
              corsDetected: true,
              proxied: true,
            },
          };
        }
      } else if (proxyRes.status === 502 || proxyRes.status === 504) {
        // Vite proxy returns 502/504 when target auth_serv is stopped/offline
        return {
          isAvailable: false,
          lastChecked: timestamp,
          serviceUrl: baseUrl,
          endpointChecked: directEndpoint,
          error: `auth_serv is not running or unreachable at ${baseUrl}`,
          details: {
            statusCode: proxyRes.status,
            statusText: proxyRes.statusText,
            proxied: true,
          },
        };
      }
    } catch (proxyErr: any) {
      // Dev proxy check failed as well
    }
  }

  // Both direct and proxy attempts failed: server is unreachable/offline
  return {
    isAvailable: false,
    lastChecked: timestamp,
    serviceUrl: baseUrl,
    endpointChecked: directEndpoint,
    error: `Cannot connect to auth_serv at ${baseUrl}. Please ensure the authentication microservice is running.`,
  };
}
