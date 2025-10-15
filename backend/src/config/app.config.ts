export interface AppConfig {
  port: number;
  environment: 'development' | 'staging' | 'production';
  database: {
    url: string;
    maxConnections: number;
    connectionTimeout: number;
  };
  cors: {
    origin: string[] | string;
    credentials: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enabled: boolean;
  };
  security: {
    jwtSecret?: string;
    bcryptRounds: number;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  features: {
    registration: boolean;
    passwordReset: boolean;
    emailVerification: boolean;
  };
}

function getConfig(): AppConfig {
  const env = process.env.NODE_ENV || 'development';
  
  const baseConfig: AppConfig = {
    port: Number(process.env.PORT) || 3000,
    environment: env as AppConfig['environment'],
    database: {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/ttue_dev',
      maxConnections: Number(process.env.DB_MAX_CONNECTIONS) || 10,
      connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT) || 5000,
    },
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:4200'],
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
    logging: {
      level: (process.env.LOG_LEVEL as AppConfig['logging']['level']) || 'info',
      enabled: process.env.LOG_ENABLED !== 'false',
    },
    security: {
      jwtSecret: process.env.JWT_SECRET,
      bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
      rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    },
    features: {
      registration: process.env.FEATURE_REGISTRATION !== 'false',
      passwordReset: process.env.FEATURE_PASSWORD_RESET !== 'false',
      emailVerification: process.env.FEATURE_EMAIL_VERIFICATION !== 'false',
    },
  };

  // Environment-specific overrides
  if (env === 'production') {
    baseConfig.logging.level = 'warn';
    baseConfig.security.rateLimitMaxRequests = 50; // Stricter rate limiting in production
    baseConfig.cors.origin = process.env.CORS_ORIGIN?.split(',') || ['https://yourdomain.com'];
  } else if (env === 'development') {
    baseConfig.logging.level = 'debug';
    baseConfig.security.rateLimitMaxRequests = 1000; // More lenient in development
    baseConfig.cors.origin = ['http://localhost:4200', 'http://localhost:3000'];
  } else if (env === 'staging') {
    baseConfig.logging.level = 'info';
    baseConfig.cors.origin = process.env.CORS_ORIGIN?.split(',') || ['https://staging.yourdomain.com'];
  }

  return baseConfig;
}

export const config = getConfig();

// Log configuration on startup (excluding sensitive data)
export function logConfig() {
  const safeConfig = {
    ...config,
    security: {
      ...config.security,
      jwtSecret: config.security.jwtSecret ? '[REDACTED]' : undefined,
    },
    database: {
      ...config.database,
      url: config.database.url.replace(/\/\/.*@/, '//[REDACTED]@'),
    },
  };
  
  if (config.logging.enabled) {
    console.log('🔧 Application Configuration:', JSON.stringify(safeConfig, null, 2));
  }
}