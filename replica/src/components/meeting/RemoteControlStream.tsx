import React, { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useMediaStore } from '@/stores/useMediaStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { Loader2, Maximize2, Minimize2, MousePointer2, Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui';

export function RemoteControlStream() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { sendControlEvent, controlDataChannel, nativeAgentStatus } = useChatStore();
  const { remoteControlState } = useMeetingStore();
  const { remoteScreenStreams } = useMediaStore();
  const { participants } = useParticipantsStore();
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [mouseEnabled, setMouseEnabled] = useState(true);
  const [keyboardEnabled, setKeyboardEnabled] = useState(true);

  // Fallback for native agent frames if still used
  useEffect(() => {
    const handleFrame = (event: any) => {
      setFrame(event.detail);
    };
    window.addEventListener('remote_control_frame', handleFrame);
    return () => window.removeEventListener('remote_control_frame', handleFrame);
  }, []);

  const targetParticipant = participants.find(p => p.id === remoteControlState.targetId);
  const targetWebRtcStream = targetParticipant?.socketId ? remoteScreenStreams[targetParticipant.socketId] : null;
  const hasStream = !!targetWebRtcStream || !!frame;
  const isWebRtcStream = !!targetWebRtcStream;

  // Auto-focus on mount or stream change to capture keyboard
  useEffect(() => {
    if (hasStream && videoRef.current) {
      videoRef.current.focus();
    }
  }, [hasStream]);

  useEffect(() => {
    if (targetWebRtcStream && videoRef.current) {
        if (videoRef.current.srcObject !== targetWebRtcStream) {
            videoRef.current.srcObject = targetWebRtcStream;
        }
    }
  }, [targetWebRtcStream]);

  const isDataChannelOpen = controlDataChannel && controlDataChannel.readyState === 'open';

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseEnabled) return;
    const video = videoRef.current;
    if (!video || !isWebRtcStream) return;

    const { videoWidth, videoHeight, clientWidth, clientHeight } = video;
    if (videoWidth === 0 || videoHeight === 0) return;

    const rect = video.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Letterboxing logic (object-contain)
    const videoRatio = videoWidth / videoHeight;
    const elementRatio = clientWidth / clientHeight;
    let renderedWidth, renderedHeight, offsetX, offsetY;

    if (elementRatio > videoRatio) {
        renderedHeight = clientHeight;
        renderedWidth = clientHeight * videoRatio;
        offsetX = (clientWidth - renderedWidth) / 2;
        offsetY = 0;
    } else {
        renderedWidth = clientWidth;
        renderedHeight = clientWidth / videoRatio;
        offsetX = 0;
        offsetY = (clientHeight - renderedHeight) / 2;
    }

    // Focus Guard: ignore moves outside actual video area
    if (clickX < offsetX || clickX > offsetX + renderedWidth || 
        clickY < offsetY || clickY > offsetY + renderedHeight) return;

    const x = Math.round(((clickX - offsetX) / renderedWidth) * videoWidth);
    const y = Math.round(((clickY - offsetY) / renderedHeight) * videoHeight);

    sendControlEvent({ 
      type: 'mouse_move', 
      x, y, 
      screenWidth: videoWidth, 
      screenHeight: videoHeight,
      displayId: 1
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!mouseEnabled) return;
    const buttonMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
    sendControlEvent({ type: 'mouse_down', button: buttonMap[e.button] || 'left' });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!mouseEnabled) return;
    const buttonMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
    sendControlEvent({ type: 'mouse_up', button: buttonMap[e.button] || 'left' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!keyboardEnabled) return;
    sendControlEvent({
      type: 'key_down',
      key: e.key.toLowerCase(),
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey
    });
    if (['Tab', 'F1', 'F3', 'F5', 'F6', 'F11', 'F12'].includes(e.key)) {
        e.preventDefault();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (!keyboardEnabled) return;
    sendControlEvent({ type: 'key_up', key: e.key.toLowerCase() });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!mouseEnabled) return;
    sendControlEvent({ type: 'mouse_wheel', deltaX: e.deltaX, deltaY: e.deltaY });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!mouseEnabled) return;
    const buttonMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
    sendControlEvent({ type: 'mouse_double_click', button: buttonMap[e.button] || 'left' });
  };

  // UI Fix Requirement: show "You are controlling..." ONLY if stream is available AND data channel or agent is open
  const canControl = isDataChannelOpen || nativeAgentStatus.status === 'connected';

  if (!canControl || !hasStream) {
    return (
        <div className="flex items-center justify-center w-full h-full bg-zinc-900 border border-white/10 rounded-xl">
            <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                <p className="text-sm text-zinc-400">Waiting for remote control stream...</p>
            </div>
        </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black rounded-xl overflow-hidden shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full h-full'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isWebRtcStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain cursor-pointer select-none"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onLoadedMetadata={(e) => e.currentTarget.play()}
        />
      ) : (
        <img
          src={frame!}
          alt="Remote Screen"
          className="w-full h-full object-contain cursor-pointer select-none"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
        />
      )}

      {/* Control Overlay */}
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="bg-zinc-900/80 backdrop-blur-md border border-white/10"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
      </div>

      <div className="absolute bottom-4 left-4 p-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/5 text-[10px] text-zinc-400 flex items-center gap-3">
        <button 
          onClick={() => setMouseEnabled(!mouseEnabled)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${mouseEnabled ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-zinc-800/50 text-zinc-500 border border-transparent'}`}
        >
          <MousePointer2 className="w-3 h-3" /> {mouseEnabled ? 'Mouse ON' : 'Mouse OFF'}
        </button>
        <button 
          onClick={() => setKeyboardEnabled(!keyboardEnabled)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${keyboardEnabled ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-zinc-800/50 text-zinc-500 border border-transparent'}`}
        >
          <Keyboard className="w-3 h-3" /> {keyboardEnabled ? 'Keys ON' : 'Keys OFF'}
        </button>

        <div className="flex items-center gap-1.5 ml-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[9px] uppercase tracking-wider font-bold">Live</span>
        </div>
      </div>
    </div>
  );
}
