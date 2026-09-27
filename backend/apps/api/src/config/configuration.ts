export interface AppConfig {
  nodeEnv: string;
  appName: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  jwt: {
    secret: string;
    accessExpiration: number;
    refreshSecret: string;
    refreshExpiration: number;
  };
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  graphql: {
    playground: boolean;
    debug: boolean;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'NexaVoice',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((o) => o.trim()),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-32-chars-long-minimum!',
    accessExpiration: parseInt(process.env.JWT_ACCESS_EXPIRATION_SECONDS || '900', 10),
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-32-chars-long!',
    refreshExpiration: parseInt(process.env.JWT_REFRESH_EXPIRATION_SECONDS || '604800', 10),
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://nexavoice:nexavoice_dev_secret@localhost:5432/nexavoice?schema=public',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  graphql: {
    playground: process.env.GRAPHQL_PLAYGROUND === 'true' || process.env.NODE_ENV !== 'production',
    debug: process.env.GRAPHQL_DEBUG === 'true' || process.env.NODE_ENV !== 'production',
  },
});
