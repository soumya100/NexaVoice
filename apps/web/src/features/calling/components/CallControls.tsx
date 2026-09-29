import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Pause,
  Play,
  Users,
  Settings,
  PhoneOff,
} from 'lucide-react';

interface CallControlsProps {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isOnHold: boolean;
  participantCount: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHold: () => void;
  onOpenParticipants: () => void;
  onOpenSettings: () => void;
  onEndCall: () => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  isOnHold,
  participantCount,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHold,
  onOpenParticipants,
  onOpenSettings,
  onEndCall,
}) => {
  return (
    <nav aria-label="Call controls" className="call-controls-dock">
      <div className="call-controls-pill">
        {/* Mic Button */}
        <button
          type="button"
          onClick={onToggleAudio}
          aria-label={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          className={`call-ctrl-btn ${isAudioMuted ? 'call-ctrl-btn-muted' : ''}`}
        >
          {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Video Button */}
        <button
          type="button"
          onClick={onToggleVideo}
          aria-label={isVideoMuted ? 'Turn on Camera' : 'Turn off Camera'}
          title={isVideoMuted ? 'Turn on Camera' : 'Turn off Camera'}
          className={`call-ctrl-btn ${isVideoMuted ? 'call-ctrl-btn-muted' : ''}`}
        >
          {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
        </button>

        {/* Screen Share Button */}
        <button
          type="button"
          onClick={onToggleScreenShare}
          aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          className={`call-ctrl-btn ${isScreenSharing ? 'call-ctrl-btn-active-feature' : ''}`}
        >
          {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
        </button>

        {/* Hold Button */}
        <button
          type="button"
          onClick={onToggleHold}
          aria-label={isOnHold ? 'Resume Call' : 'Hold Call'}
          title={isOnHold ? 'Resume Call' : 'Hold Call'}
          className={`call-ctrl-btn ${isOnHold ? 'call-ctrl-btn-hold' : ''}`}
        >
          {isOnHold ? <Play size={20} /> : <Pause size={20} />}
        </button>

        {/* Participants Drawer Toggle */}
        <button
          type="button"
          onClick={onOpenParticipants}
          aria-label={`Participants (${participantCount})`}
          title={`Participants (${participantCount})`}
          className="call-ctrl-btn"
        >
          <Users size={20} />
          <span className="call-ctrl-badge">
            {participantCount}
          </span>
        </button>

        {/* Device Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Device Settings"
          title="Device Settings"
          className="call-ctrl-btn"
        >
          <Settings size={20} />
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={onEndCall}
          aria-label="End Call"
          title="End Call"
          className="call-ctrl-btn call-ctrl-btn-end"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </nav>
  );
};

