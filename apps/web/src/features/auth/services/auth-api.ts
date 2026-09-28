import { executeGraphQL } from '../../../services/api';
import {
  AuthResponsePayload,
  LoginFormData,
  PasswordResetResponse,
  SignupFormData,
} from '../types';

export const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      tokenType
      expiresIn
      user {
        id
        username
        displayName
        nexaVoiceId
        email
        phone
        avatarUrl
        status
        accountState
        roles
        permissions
        createdAt
      }
    }
  }
`;

export const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      tokenType
      expiresIn
      user {
        id
        username
        displayName
        nexaVoiceId
        email
        phone
        avatarUrl
        status
        accountState
        roles
        permissions
        createdAt
      }
    }
  }
`;

export const REQUEST_PASSWORD_RESET_MUTATION = `
  mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
    requestPasswordReset(input: $input) {
      success
      message
      resetToken
    }
  }
`;

export const RESET_PASSWORD_MUTATION = `
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
      success
      message
    }
  }
`;

export const authApi = {
  async login(data: LoginFormData): Promise<AuthResponsePayload> {
    const res = await executeGraphQL<{ login: AuthResponsePayload }>(LOGIN_MUTATION, {
      input: {
        identifier: data.identifier,
        password: data.password,
        device: {
          deviceId: `web-client-${navigator.userAgent.slice(0, 16).replace(/[^a-zA-Z0-9]/g, '') || 'browser'}`,
          deviceType: 'WEB',
          deviceName: 'NexaVoice Web Portal',
        },
      },
    });
    return res.login;
  },

  async register(data: SignupFormData): Promise<AuthResponsePayload> {
    const res = await executeGraphQL<{ register: AuthResponsePayload }>(REGISTER_MUTATION, {
      input: {
        username: data.username,
        displayName: data.displayName,
        email: data.email,
        password: data.password,
        device: {
          deviceId: `web-client-${navigator.userAgent.slice(0, 16).replace(/[^a-zA-Z0-9]/g, '') || 'browser'}`,
          deviceType: 'WEB',
          deviceName: 'NexaVoice Web Portal',
        },
      },
    });
    return res.register;
  },

  async requestPasswordReset(email: string): Promise<PasswordResetResponse> {
    const res = await executeGraphQL<{ requestPasswordReset: PasswordResetResponse }>(
      REQUEST_PASSWORD_RESET_MUTATION,
      { input: { email } },
    );
    return res.requestPasswordReset;
  },

  async resetPassword(token: string, newPassword: string): Promise<PasswordResetResponse> {
    const res = await executeGraphQL<{ resetPassword: PasswordResetResponse }>(
      RESET_PASSWORD_MUTATION,
      { input: { token, newPassword } },
    );
    return res.resetPassword;
  },
};
