import React, { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useMediaStore } from '@/stores/useMediaStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { Loader2, Maximize2, Minimize2, MousePointer2, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui';

export function RemoteControlStream() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [remoteCursor, setRemoteCursor] = useState<{ x: number, y: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { socket, sendControlEvent, controlDataChannels, nativeAgentStatus } = useChatStore();
  const { remoteControlState } = useMeetingStore();
  const { remoteScreenStreams } = useMediaStore();
  const { participants } = useParticipantsStore();
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mouseEnabled, setMouseEnabled] = useState(true);
  const [keyboardEnabled, setKeyboardEnabled] = useState(true);

  // Listen for remote frames and cursor feedback
  useEffect(() => {
    if (!socket) return;

    const handleFrame = (data: { frame: string }) => {
      setFrame(data.frame);
    };
    const handleCursorPos = (data: { x: number, y: number }) => {
      setRemoteCursor(data);
    };

    socket.on('remote_frame', handleFrame);
    socket.on('remote_cursor_pos', handleCursorPos);

    // Also listen for DataChannel events dispatched via window
    const handleDcEvent = (e: any) => {
      if (e.detail?.type === 'cursor_pos') {
        setRemoteCursor(e.detail);
      }
    };
    window.addEventListener('remote_control_event', handleDcEvent);

    return () => {
      socket.off('remote_frame', handleFrame);
      socket.off('remote_cursor_pos', handleCursorPos);
      window.removeEventListener('remote_control_event', handleDcEvent);
    };
  }, [socket]);

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

  const isDataChannelOpen = Object.values(controlDataChannels).some(ch => ch.readyState === 'open');

  const lastSentRef = useRef<number>(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseEnabled) return;
    if (!isDataChannelOpen && nativeAgentStatus.status !== 'connected') return;
    
    // 🚨 1. Throttling (Industry Level)
    const now = Date.now();
    if (now - lastSentRef.current < 15) return;
    lastSentRef.current = now;

    let rect;
    let contentWidth, contentHeight;
    let offsetX = 0, offsetY = 0;

    if (isWebRtcStream && videoRef.current) {
        rect = videoRef.current.getBoundingClientRect();
        const video = videoRef.current;
        const videoRatio = video.videoWidth / video.videoHeight;
        const elementRatio = rect.width / rect.height;

        if (elementRatio > videoRatio) {
            contentHeight = rect.height;
            contentWidth = rect.height * videoRatio;
            offsetX = (rect.width - contentWidth) / 2;
        } else {
            contentWidth = rect.width;
            contentHeight = rect.width / videoRatio;
            offsetY = (rect.height - contentHeight) / 2;
        }
    } else if (containerRef.current) {
        rect = containerRef.current.getBoundingClientRect();
        contentWidth = rect.width;
        contentHeight = rect.height;
    }
    
    if (!rect) return;

    // 🚨 2. Coordinate Mapping Issue Fix
    const clientXInElement = e.clientX - rect.left;
    const clientYInElement = e.clientY - rect.top;

    const x = (clientXInElement - offsetX) / contentWidth;
    const y = (clientYInElement - offsetY) / contentHeight;

    // Clamp values between 0 and 1
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));

    sendControlEvent({ 
      type: 'mouse_move', 
      x: clampedX, 
      y: clampedY,
      time: Date.now()
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!mouseEnabled) return;
    if (!isDataChannelOpen && nativeAgentStatus.status !== 'connected') return;
    const buttonMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
    sendControlEvent({ type: 'mouse_down', button: buttonMap[e.button] || 'left', time: Date.now() });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!mouseEnabled) return;
    if (!isDataChannelOpen && nativeAgentStatus.status !== 'connected') return;
    const buttonMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
    sendControlEvent({ type: 'mouse_up', button: buttonMap[e.button] || 'left', time: Date.now() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!keyboardEnabled) return;
    if (!isDataChannelOpen && nativeAgentStatus.status !== 'connected') return;
    sendControlEvent({
      type: 'key_down',
      key: e.key.toLowerCase(),
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey,
      time: Date.now()
    });
    if (['Tab', 'F1', 'F3', 'F5', 'F6', 'F11', 'F12'].includes(e.key)) {
        e.preventDefault();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (!keyboardEnabled) return;
    if (!isDataChannelOpen && nativeAgentStatus.status !== 'connected') return;
    sendControlEvent({ type: 'key_up', key: e.key.toLowerCase(), time: Date.now() });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!mouseEnabled) return;
    if (!isDataChannelOpen && nativeAgentStatus.status !== 'connected') return;
    sendControlEvent({ type: 'mouse_wheel', deltaX: e.deltaX, deltaY: e.deltaY, time: Date.now() });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!mouseEnabled) return;
    if (!isDataChannelOpen && nativeAgentStatus.status !== 'connected') return;
    const buttonMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
    sendControlEvent({ type: 'mouse_double_click', button: buttonMap[e.button] || 'left', time: Date.now() });
  };

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

      {/* VIRTUAL CURSOR OVERLAY */}
      {remoteCursor && (
        <div
          style={{
            position: 'absolute',
            left: `${remoteCursor.x * 100}%`,
            top: `${remoteCursor.y * 100}%`,
            width: '12px',
            height: '12px',
            backgroundColor: 'rgba(255, 0, 0, 0.6)',
            border: '2px solid white',
            borderRadius: '50%',
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
            boxShadow: '0 0 10px rgba(0,0,0,0.5)',
            transition: 'all 0.05s linear'
          }}
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
         <span className="text-white font-medium text-xs">You are controlling...</span>
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
