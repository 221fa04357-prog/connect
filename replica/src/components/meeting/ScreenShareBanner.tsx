import { StopCircle, MousePointer2 } from 'lucide-react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function ScreenShareBanner() {
    const { isScreenSharing, toggleScreenShare, screenShareStream, setScreenShareStream } = useMeetingStore();

    const handleStopShare = () => {
        if (screenShareStream) {
            screenShareStream.getTracks().forEach(track => track.stop());
            setScreenShareStream(null);
        }
        if (isScreenSharing) {
            toggleScreenShare();
        }
    };

    return (
        <AnimatePresence>
            {isScreenSharing && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-[60] flex justify-center pointer-events-none"
                >
                    <div className="bg-transparent pt-4 flex flex-col items-center pointer-events-auto">
                        <div className="flex items-center bg-[#10B981] text-white rounded-t-lg px-6 py-2 shadow-lg gap-3">
                            <span className="font-semibold text-lg flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                </span>
                                You are screen sharing
                            </span>
                        </div>
                        <div className="bg-[#1C1C1C] border border-t-0 border-[#333] rounded-b-lg px-6 py-2 flex items-center gap-4 shadow-xl">
                            <span className="text-sm text-gray-400">
                                Stop sharing to switch windows
                            </span>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleStopShare}
                                className="bg-[#E53935] hover:bg-[#D32F2F] text-white h-8 px-4 flex items-center gap-2"
                            >
                                <StopCircle className="w-4 h-4" />
                                Stop Share
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
