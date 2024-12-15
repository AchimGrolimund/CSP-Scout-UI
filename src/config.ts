// Environment variable types
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT?: string;
  readonly VITE_API_MAX_RETRIES?: string;
  readonly VITE_API_RETRY_DELAY?: string;
  readonly VITE_API_CACHE_DURATION?: string;
  readonly VITE_API_RATE_LIMIT_REQUESTS?: string;
  readonly VITE_API_RATE_LIMIT_WINDOW_MS?: string;
  readonly VITE_ALLOWED_ORIGINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// API Configuration types
interface ApiEndpoints {
  readonly REPORTS: string;
}

interface SecurityConfig {
  readonly CSP: {
    readonly directives: {
      readonly 'default-src': string[];
      readonly 'script-src': string[];
      readonly 'style-src': string[];
      readonly 'img-src': string[];
      readonly 'connect-src': string[];
      readonly 'font-src': string[];
      readonly 'frame-src': string[];
      readonly 'frame-ancestors': string[];
    };
  };
  readonly RATE_LIMIT: {
    readonly MAX_REQUESTS: number;
    readonly WINDOW_MS: number;
  };
  readonly CORS: {
    readonly ALLOWED_ORIGINS: string[];
    readonly ALLOWED_METHODS: string[];
    readonly ALLOWED_HEADERS: string[];
    readonly EXPOSE_HEADERS: string[];
    readonly MAX_AGE: number;
    readonly CREDENTIALS: boolean;
  };
  readonly XSS: {
    readonly SANITIZE_OPTIONS: {
      readonly ALLOWED_TAGS: string[];
      readonly ALLOWED_ATTR: string[];
      readonly ALLOW_DATA_ATTR: boolean;
    };
  };
}

interface ApiConfig {
  readonly BASE_URL: string;
  readonly ENDPOINTS: ApiEndpoints;
  readonly VERSION: string;
  readonly TIMEOUT_MS: number;
  readonly RETRY_CONFIG: {
    readonly MAX_RETRIES: number;
    readonly RETRY_DELAY_MS: number;
  };
  readonly CACHE_CONFIG: {
    readonly ENABLED: boolean;
    readonly DURATION_MS: number;
  };
  readonly SECURITY: SecurityConfig;
}

// Default values
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000; // 1 second
const DEFAULT_CACHE_DURATION_MS = 300000; // 5 minutes
const DEFAULT_RATE_LIMIT_REQUESTS = 100;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 900000; // 15 minutes

// Parse allowed origins from environment variable or use default
const allowedOrigins = import.meta.env.VITE_ALLOWED_ORIGINS
  ? import.meta.env.VITE_ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:8081'];

// Configuration object
export const API_CONFIG: ApiConfig = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081',
  VERSION: 'v1',
  ENDPOINTS: {
    REPORTS: '/api/v1/reports'
  },
  TIMEOUT_MS: parseInt(import.meta.env.VITE_API_TIMEOUT || '') || DEFAULT_TIMEOUT_MS,
  RETRY_CONFIG: {
    MAX_RETRIES: parseInt(import.meta.env.VITE_API_MAX_RETRIES || '') || DEFAULT_MAX_RETRIES,
    RETRY_DELAY_MS: parseInt(import.meta.env.VITE_API_RETRY_DELAY || '') || DEFAULT_RETRY_DELAY_MS
  },
  CACHE_CONFIG: {
    ENABLED: true,
    DURATION_MS: parseInt(import.meta.env.VITE_API_CACHE_DURATION || '') || DEFAULT_CACHE_DURATION_MS
  },
  SECURITY: {
    CSP: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"], // Required for Svelte
        'style-src': ["'self'", "'unsafe-inline'"], // Required for Tailwind
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", ...allowedOrigins],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'frame-src': ["'none'"],
        'frame-ancestors': ["'none'"]
      }
    },
    RATE_LIMIT: {
      MAX_REQUESTS: parseInt(import.meta.env.VITE_API_RATE_LIMIT_REQUESTS || '') || DEFAULT_RATE_LIMIT_REQUESTS,
      WINDOW_MS: parseInt(import.meta.env.VITE_API_RATE_LIMIT_WINDOW_MS || '') || DEFAULT_RATE_LIMIT_WINDOW_MS
    },
    CORS: {
      ALLOWED_ORIGINS: allowedOrigins,
      ALLOWED_METHODS: ['GET', 'POST', 'OPTIONS'],
      ALLOWED_HEADERS: ['Content-Type', 'Authorization'],
      EXPOSE_HEADERS: ['Content-Length', 'X-Rate-Limit-Remaining'],
      MAX_AGE: 86400, // 24 hours
      CREDENTIALS: true
    },
    XSS: {
      SANITIZE_OPTIONS: {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ALLOW_DATA_ATTR: false
      }
    }
  }
};

// Utility functions for security
export function sanitizeInput(input: string): string {
  // Remove any potentially dangerous characters
  return input.replace(/[<>'"]/g, '');
}

export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization (in a real app, use DOMPurify or similar)
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Rate limiting implementation
const requestCounts = new Map<string, number[]>();

export function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const windowMs = API_CONFIG.SECURITY.RATE_LIMIT.WINDOW_MS;
  const maxRequests = API_CONFIG.SECURITY.RATE_LIMIT.MAX_REQUESTS;

  // Get or initialize request timestamps for this client
  let timestamps = requestCounts.get(clientId) || [];
  
  // Remove timestamps outside the current window
  timestamps = timestamps.filter(timestamp => now - timestamp < windowMs);
  
  // Check if we're over the limit
  if (timestamps.length >= maxRequests) {
    return false;
  }

  // Add current timestamp and update the map
  timestamps.push(now);
  requestCounts.set(clientId, timestamps);
  
  return true;
}

// CORS validation
export function isOriginAllowed(origin: string): boolean {
  return API_CONFIG.SECURITY.CORS.ALLOWED_ORIGINS.includes(origin);
}
