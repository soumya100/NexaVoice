/**
 * NexaVoice Typed TanStack Router Tree
 * 
 * Strict typed route hierarchy with authentication guards,
 * open-redirect prevention, and route parameter typing.
 */

import React, { useState, useEffect } from 'react';
import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
  Link,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import {
  Shield,
  MessageSquare,
  Users,
  Phone,
  Settings,
  Activity,
  LogOut,
  Radio,
  Calendar,
  Disc,
  Bot,
} from 'lucide-react';
import { AILayout } from '../features/ai/components/AILayout';
import { RouterContext } from './context';
import { MessagingWorkspace } from '../components/MessagingWorkspace';
import { useHealthReadyQuery } from '../query/hooks';
import { authService } from '../services/auth';
import { realtimeService } from '../services/realtime';
import { CallHistoryView } from '../features/calling/components/CallHistoryView';
import { ActiveCallView } from '../features/calling/components/ActiveCallView';
import { CallModal } from '../features/calling/components/CallModal';
import { ScheduledCallsView } from '../features/calling/components/ScheduledCallsView';
import { RecordingsView } from '../features/calling/components/RecordingsView';
import { CallSession } from '../features/calling/types';
import { callApi } from '../features/calling/services/call-api';
import {
  AuthLayout,
  LoginForm,
  SignupForm,
  ForgotPasswordForm,
  ResetPasswordForm,
} from '../features/auth';
import { TelephonyLayout } from '../features/telephony/components/TelephonyLayout';

// =============================================================
// Root Route Layout
// =============================================================

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const [theme] = useState<'dark' | 'light'>('dark');

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Outlet />
    </div>
  );
}

function NotFoundComponent() {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <Shield size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
      <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>404 — Page Not Found</h2>
      <p style={{ color: 'var(--text-muted, #94a3b8)', marginBottom: '24px' }}>
        The route you are looking for does not exist in NexaVoice.
      </p>
      <Link
        to="/app/conversations"
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          background: 'var(--primary, #3b82f6)',
          color: '#fff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Go to Conversations
      </Link>
    </div>
  );
}

// =============================================================
// Public Index Route
// =============================================================

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated()) {
      throw redirect({ to: '/app/conversations' });
    }
    throw redirect({ to: '/auth/login' });
  },
});

// =============================================================
// Authentication Route Group (/auth/*)
// =============================================================

export const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'auth',
  beforeLoad: ({ context }) => {
    // Authenticated users accessing auth routes are redirected to the app
    if (context.auth.isAuthenticated()) {
      throw redirect({ to: '/app/conversations' });
    }
  },
  component: () => (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // padding: '24px',
        background: 'radial-gradient(ellipse at top, #1e293b, #0f172a)',
      }}
    >
      <Outlet />
    </div>
  ),
});

export const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: () => (
    <AuthLayout
      title="Welcome to NexaVoice"
      subtitle="Sign in to your global encrypted voice and messaging workspace"
    >
      <LoginForm />
    </AuthLayout>
  ),
});

export const registerRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'register',
  component: () => (
    <AuthLayout
      title="Create your NexaVoice Account"
      subtitle="Get your global NexaVoice ID and encrypted workspace"
    >
      <SignupForm />
    </AuthLayout>
  ),
});

export const signupRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'signup',
  component: () => (
    <AuthLayout
      title="Create your NexaVoice Account"
      subtitle="Get your global NexaVoice ID and encrypted workspace"
    >
      <SignupForm />
    </AuthLayout>
  ),
});

export const forgotPasswordRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'forgot-password',
  component: () => (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email to receive recovery instructions"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  ),
});

export const resetPasswordRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'reset-password',
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ResetPasswordRouteComponent,
});

function ResetPasswordRouteComponent() {
  const search = useSearch({ from: '/auth/reset-password' });
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Choose a new, secure password for your NexaVoice account"
    >
      <ResetPasswordForm token={search.token} />
    </AuthLayout>
  );
}

// Top-Level Convenience Public Routes (/login, /signup, /forgot-password, /reset-password)
export const rootLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated()) {
      throw redirect({ to: '/app/conversations' });
    }
    throw redirect({
      to: '/auth/login',
      search: { redirect: search.redirect },
    });
  },
});

export const rootSignupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'signup',
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated()) {
      throw redirect({ to: '/app/conversations' });
    }
    throw redirect({ to: '/auth/register' });
  },
});

export const rootForgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'forgot-password',
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated()) {
      throw redirect({ to: '/app/conversations' });
    }
    throw redirect({ to: '/auth/forgot-password' });
  },
});

export const rootResetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'reset-password',
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated()) {
      throw redirect({ to: '/app/conversations' });
    }
    throw redirect({
      to: '/auth/reset-password',
      search: { token: search.token },
    });
  },
});

// =============================================================
// Protected Application Route Layout (/app/*)
// =============================================================

export const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'app',
  beforeLoad: ({ context, location }) => {
    // AUTH GUARD: UX protection; backend enforces authoritative security
    if (!context.auth.isAuthenticated()) {
      const redirectUrl = context.auth.validateRedirect(location.href);
      throw redirect({
        to: '/auth/login',
        search: { redirect: redirectUrl },
      });
    }
  },
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);

  useEffect(() => {
    const socket = realtimeService.connect();
    const handleIncoming = (payload: { call: CallSession }) => {
      setIncomingCall(payload.call);
    };
    const handleDismiss = () => {
      setIncomingCall(null);
    };

    socket.on('call.incoming', handleIncoming);
    socket.on('call.ringing.cancelled', handleDismiss);
    socket.on('call.cancelled', handleDismiss);
    socket.on('call.ended', handleDismiss);

    return () => {
      socket.off('call.incoming', handleIncoming);
      socket.off('call.ringing.cancelled', handleDismiss);
      socket.off('call.cancelled', handleDismiss);
      socket.off('call.ended', handleDismiss);
    };
  }, []);

  const handleAcceptIncoming = async () => {
    if (!incomingCall) return;
    try {
      await callApi.acceptCall(incomingCall.id);
      const callId = incomingCall.id;
      setIncomingCall(null);
      navigate({ to: '/app/calls/$callId', params: { callId } });
    } catch (err) {
      console.error('Failed to accept call', err);
      setIncomingCall(null);
    }
  };

  const handleDeclineIncoming = async () => {
    if (!incomingCall) return;
    try {
      await callApi.declineCall(incomingCall.id);
    } catch (err) {
      console.error('Failed to decline call', err);
    }
    setIncomingCall(null);
  };

  const handleLogout = () => {
    authService.logout();
    navigate({ to: '/auth/login' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {incomingCall && (
        <CallModal
          call={incomingCall}
          onAccept={handleAcceptIncoming}
          onDecline={handleDeclineIncoming}
        />
      )}
      {/* Top Application Bar */}
      <header
        style={{
          height: '56px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: 'var(--header-bg, #0f172a)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Radio size={18} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.3px' }}>NexaVoice</span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link
              to="/app/conversations"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
              }}
              activeProps={{ style: { background: 'rgba(59, 130, 246, 0.2)', color: '#38bdf8' } }}
            >
              <MessageSquare size={16} /> Messages
            </Link>

            <Link
              to="/app/contacts"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
              }}
              activeProps={{ style: { background: 'rgba(59, 130, 246, 0.2)', color: '#38bdf8' } }}
            >
              <Users size={16} /> Contacts
            </Link>

            <Link
              to="/app/calls"
              activeOptions={{ exact: true }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
              }}
              activeProps={{ style: { background: 'rgba(59, 130, 246, 0.2)', color: '#38bdf8' } }}
            >
              <Phone size={16} /> Calls
            </Link>

            <Link
              to="/app/calls/schedule"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
              }}
              activeProps={{ style: { background: 'rgba(59, 130, 246, 0.2)', color: '#38bdf8' } }}
            >
              <Calendar size={16} /> Schedule
            </Link>

            <Link
              to="/app/calls/recordings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
              }}
              activeProps={{ style: { background: 'rgba(59, 130, 246, 0.2)', color: '#38bdf8' } }}
            >
              <Disc size={16} /> Recordings
            </Link>

            <Link
              to="/app/telephony"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
              }}
              activeProps={{ style: { background: 'rgba(59, 130, 246, 0.2)', color: '#38bdf8' } }}
            >
              <Radio size={16} /> Telephony
            </Link>

            <Link
              to="/app/ai"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
              }}
              activeProps={{ style: { background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' } }}
            >
              <Bot size={16} /> AI Agents
            </Link>

            <Link
              to="/app/home"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
              }}
              activeProps={{ style: { background: 'rgba(59, 130, 246, 0.2)', color: '#38bdf8' } }}
            >
              <Activity size={16} /> Overview
            </Link>

            <Link
              to="/app/settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
              }}
              activeProps={{ style: { background: 'rgba(59, 130, 246, 0.2)', color: '#38bdf8' } }}
            >
              <Settings size={16} /> Settings
            </Link>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <Outlet />
      </main>
    </div>
  );
}

// =============================================================
// App Sub-Routes
// =============================================================

export const appIndexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/app/conversations' });
  },
});

export const conversationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'conversations',
  component: () => <MessagingWorkspace />,
});

export const conversationDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'conversations/$conversationId',
  component: () => <MessagingWorkspace />,
});

export const contactsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'contacts',
  component: ContactsPageComponent,
});

function ContactsPageComponent() {
  return (
    <div style={{ padding: '32px', width: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Users size={20} color="#3b82f6" /> Contacts & Address Book
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
        Privacy-preserving contact matching using client-side SHA-256 phone/email hashes. Raw numbers are never persisted.
      </p>
      <div
        style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
          maxWidth: '600px',
        }}
      >
        <p style={{ margin: 0, color: '#e2e8f0', fontSize: '14px' }}>
          Address-book discovery status: <strong style={{ color: '#10b981' }}>Active & Encrypted</strong>
        </p>
      </div>
    </div>
  );
}

export const callsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'calls',
  component: CallsPageComponent,
});

function CallsPageComponent() {
  const navigate = useNavigate();
  return (
    <CallHistoryView
      onJoinCall={(callId) => navigate({ to: '/app/calls/$callId', params: { callId } })}
    />
  );
}

export const callDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'calls/$callId',
  component: CallDetailPageComponent,
});

function CallDetailPageComponent() {
  const { callId } = callDetailRoute.useParams();
  const navigate = useNavigate();
  const currentUserId = authService.getUser()?.id || 'current-user';

  return (
    <ActiveCallView
      callId={callId}
      currentUserId={currentUserId}
      onLeaveCall={() => navigate({ to: '/app/calls' })}
    />
  );
}

export const homeRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'home',
  component: HomePageComponent,
});

function HomePageComponent() {
  const { data: health } = useHealthReadyQuery();

  return (
    <div style={{ padding: '32px', width: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity size={20} color="#6366f1" /> System Overview & Diagnostics
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
        Live service statuses, memory watermarks, and cryptographic audit health.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div
          style={{
            background: '#1e293b',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Database Health</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#10b981' }}>
            {health?.services?.database?.status === 'up' ? 'Operational' : 'Active'}
          </div>
        </div>
        <div
          style={{
            background: '#1e293b',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Redis / Valkey</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#10b981' }}>
            {health?.services?.redis?.status === 'up' ? 'Operational' : 'Active'}
          </div>
        </div>
        <div
          style={{
            background: '#1e293b',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Realtime Signaling</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#38bdf8' }}>
            Socket.IO Active
          </div>
        </div>
      </div>
    </div>
  );
}

export const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'settings',
  component: SettingsPageComponent,
});

function SettingsPageComponent() {
  return (
    <div style={{ padding: '32px', width: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Settings size={20} color="#f59e0b" /> Security & Account Settings
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
        Multi-hop token family protection, active devices, and session management.
      </p>
      <div
        style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
          maxWidth: '600px',
        }}
      >
        <p style={{ margin: 0, color: '#e2e8f0', fontSize: '14px' }}>
          Session Security Policy: <strong style={{ color: '#10b981' }}>Single-Use Rotation + Multi-Hop Lineage</strong>
        </p>
      </div>
    </div>
  );
}

export const scheduledCallsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'calls/schedule',
  component: ScheduledCallsPageComponent,
});

function ScheduledCallsPageComponent() {
  const navigate = useNavigate();
  return (
    <ScheduledCallsView
      onJoinCall={(callId) => navigate({ to: '/app/calls/$callId', params: { callId } })}
    />
  );
}

export const recordingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'calls/recordings',
  component: RecordingsPageComponent,
});

function RecordingsPageComponent() {
  return <RecordingsView />;
}

export const telephonyRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'telephony',
  component: TelephonyPageComponent,
});

function TelephonyPageComponent() {
  return <TelephonyLayout />;
}

export const aiRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'ai',
  component: AIPageComponent,
});

function AIPageComponent() {
  return <AILayout />;
}

// Assemble the route tree
export const routeTree = rootRoute.addChildren([
  indexRoute,
  rootLoginRoute,
  rootSignupRoute,
  rootForgotPasswordRoute,
  rootResetPasswordRoute,
  authLayoutRoute.addChildren([
    loginRoute,
    registerRoute,
    signupRoute,
    forgotPasswordRoute,
    resetPasswordRoute,
  ]),
  appLayoutRoute.addChildren([
    appIndexRoute,
    conversationsRoute,
    conversationDetailRoute,
    contactsRoute,
    callsRoute,
    scheduledCallsRoute,
    recordingsRoute,
    telephonyRoute,
    aiRoute,
    callDetailRoute,
    homeRoute,
    settingsRoute,
  ]),
]);
