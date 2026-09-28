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
  email: {
    provider: string;
    from: string;
    resendApiKey?: string;
    sendgridApiKey?: string;
    awsSes?: {
      region: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      sessionToken?: string;
    };
    frontendUrl: string;
  };
  telephony: {
    provider: string;
    defaultCallerId: string;
    twilio?: {
      accountSid?: string;
      authToken?: string;
      apiKeySid?: string;
      apiKeySecret?: string;
    };
    telnyx?: {
      apiKey?: string;
      publicKey?: string;
      connectionId?: string;
    };
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
  email: {
    provider: process.env.EMAIL_PROVIDER || 'development',
    from: process.env.EMAIL_FROM || 'NexaVoice Security <security@nexavoice.io>',
    resendApiKey: process.env.RESEND_API_KEY,
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    awsSes: {
      region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  telephony: {
    provider: process.env.TELEPHONY_PROVIDER || 'mock',
    defaultCallerId: process.env.TELEPHONY_DEFAULT_CALLER_ID || '+14155550100',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      apiKeySid: process.env.TWILIO_API_KEY_SID,
      apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
    },
    telnyx: {
      apiKey: process.env.TELNYX_API_KEY,
      publicKey: process.env.TELNYX_PUBLIC_KEY,
      connectionId: process.env.TELNYX_CONNECTION_ID,
    },
  },
});
