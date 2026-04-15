import React, { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { Loader2, Maximize2, Minimize2, MousePointer2, Keyboard, Play } from 'lucide-react';
import { Button } from '@/components/ui';

export function RemoteControlStream() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { nativeAgentStatus, sendControlEvent } = useChatStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  // Initialize MediaStream from Canvas
  useEffect(() => {
    if (canvasRef.current && videoRef.current && !streamRef.current) {
      console.log('[RemoteControlStream] Initializing Canvas-to-Video bridge');
      const stream = canvasRef.current.captureStream(30); // 30 FPS
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      // Auto-play the stream
      videoRef.current.play().catch(err => console.warn('[RemoteControlStream] Video play blocked:', err));
    }
  }, []);

  useEffect(() => {
    const handleFrame = (event: any) => {
      const base64 = event.detail;
      if (!base64 || !canvasRef.current) return;

      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize canvas to match frame if needed
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        ctx.drawImage(img, 0, 0);
        if (!hasFrame) setHasFrame(true);
      };
      img.src = base64;
    };

    window.addEventListener('remote_control_frame', handleFrame);
    return () => window.removeEventListener('remote_control_frame', handleFrame);
  }, [hasFrame]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (nativeAgentStatus.status !== 'connected' || !videoRef.current) return;

    const rect = videoRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    sendControlEvent({
      type: 'mouse_move',
      x,
      y
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (nativeAgentStatus.status !== 'connected') return;
    const buttonMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
    sendControlEvent({
      type: 'mouse_down',
      button: buttonMap[e.button] || 'left'
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (nativeAgentStatus.status !== 'connected') return;
    const buttonMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
    sendControlEvent({
      type: 'mouse_up',
      button: buttonMap[e.button] || 'left'
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (nativeAgentStatus.status !== 'connected') return;
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
    if (nativeAgentStatus.status !== 'connected') return;
    sendControlEvent({
      type: 'key_up',
      key: e.key.toLowerCase()
    });
  };

  if (nativeAgentStatus.status !== 'connected') {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-xl overflow-hidden shadow-2xl transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full h-full'
        }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Hidden bridge canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {!hasFrame ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 border border-white/10 rounded-xl">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
          <p className="text-sm text-zinc-400">Initializing stream...</p>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-w-full max-h-full w-auto h-auto cursor-none select-none shadow-2xl bg-black"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
          />
        </div>
      )}

      {/* Control Overlay */}
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
             if (videoRef.current) {
                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture();
                } else {
                    videoRef.current.requestPictureInPicture().catch(console.error);
                }
             }
          }}
          className="bg-zinc-900/80 backdrop-blur-md border border-white/10"
        >
          <Play className="w-4 h-4 mr-2" /> PiP
        </Button>
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
        <div className="flex items-center gap-1">
          <MousePointer2 className="w-3 h-3" /> Enabled
        </div>
        <div className="flex items-center gap-1">
          <Keyboard className="w-3 h-3" /> Enabled
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Live Stream
      </div>
    </div>
  );
}
