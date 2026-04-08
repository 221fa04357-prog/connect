import React, { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { Loader2, Maximize2, Minimize2, MousePointer2, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui';

export function RemoteControlStream() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { nativeAgentStatus, sendControlEvent } = useChatStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);

  useEffect(() => {
    const handleFrame = (event: any) => {
      console.log('[RemoteControlStream] Received frame event, size:', event.detail?.length || 0);
      setFrame(event.detail);
    };

    window.addEventListener('remote_control_frame', handleFrame);
    return () => window.removeEventListener('remote_control_frame', handleFrame);
  }, []);

  useEffect(() => {
    if (!isControlActive) return;

    const getNormalizedCoords = (e: MouseEvent) => {
      const img = imgRef.current;
      if (!img || img.naturalWidth === 0) return null;

      const rect = img.getBoundingClientRect();
      
      // Calculate the scale and actual displayed dimensions (object-contain)
      const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
      const displayWidth = img.naturalWidth * scale;
      const displayHeight = img.naturalHeight * scale;

      // Offsets of the displayed image within the rect
      const offsetX = (rect.width - displayWidth) / 2;
      const offsetY = (rect.height - displayHeight) / 2;

      // Normalized coordinates relative only to the actual content
      const x = (e.clientX - rect.left - offsetX) / displayWidth;
      const y = (e.clientY - rect.top - offsetY) / displayHeight;

      return { x, y };
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastMouseMoveRef.current < 33) return; // ~30fps

      const coords = getNormalizedCoords(e);
      if (!coords) return;

      const { x, y } = coords;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;

      console.log('[RemoteControlStream] Captured mouse_move', { x, y });
      sendControlEvent({ type: 'mouse_move', x, y });
      lastMouseMoveRef.current = now;
    };

    const handleWindowMouseDown = (e: MouseEvent) => {
      const coords = getNormalizedCoords(e);
      if (!coords) return;
      
      const { x, y } = coords;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;

      const buttonMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
      console.log('[RemoteControlStream] Captured mouse_down', { button: buttonMap[e.button] || 'left', x, y });
      sendControlEvent({
        type: 'mouse_down',
        button: buttonMap[e.button] || 'left',
        x, y
      });
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      const coords = getNormalizedCoords(e);
      if (!coords) return;
      
      const { x, y } = coords;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;

      const buttonMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
      console.log('[RemoteControlStream] Captured mouse_up', { button: buttonMap[e.button] || 'left', x, y });
      sendControlEvent({
        type: 'mouse_up',
        button: buttonMap[e.button] || 'left',
        x, y
      });
    };

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      // Prevent sending keys if user is typing in an input/textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

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
      className={`relative bg-black rounded-xl overflow-hidden shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full h-full'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!frame ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 border border-white/10 rounded-xl">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
          <p className="text-sm text-zinc-400">Initializing stream...</p>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={frame}
          alt="Remote Screen"
          className="w-full h-full object-cover cursor-none select-none"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
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
        <div className="flex items-center gap-1">
          <MousePointer2 className="w-3 h-3" /> Enabled
        </div>
        <div className="flex items-center gap-1">
          <Keyboard className="w-3 h-3" /> Enabled
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Live
      </div>
    </div>
  );
}
