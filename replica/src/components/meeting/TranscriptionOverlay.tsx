import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, User } from 'lucide-react';

/**
 * Zoom-style live captions overlay.
 */
export function TranscriptionOverlay() {
    const { currentCaption, currentSpeakerRole, isTranscriptionEnabled, fontType, fontSize, captionColor, captionPosition } = useTranscriptionStore();
    const { meeting } = useMeetingStore();

    // Show captions only if the user has enabled them, there is active speech, AND the host allows it
    const isCaptionsAllowed = meeting?.settings?.captionsAllowed !== false;
    const shouldShow = isTranscriptionEnabled && isCaptionsAllowed && currentCaption.length > 0;

    const sizeClass = fontSize === 'small' ? 'text-sm md:text-base' : fontSize === 'large' ? 'text-xl md:text-3xl' : 'text-lg md:text-2xl';
    const colorClass = captionColor === 'yellow' ? 'text-yellow-400' : captionColor === 'green' ? 'text-green-400' : captionColor === 'black' ? 'text-black' : 'text-white';
    const fontClass = fontType === 'Serif' ? 'font-serif' : fontType === 'Mono' ? 'font-mono' : 'font-sans';
    const bgClass = captionColor === 'black' ? 'bg-white/80' : 'bg-black/80';
    const positionClass = captionPosition === 'floating' ? 'top-24 items-start' : 'bottom-[120px] items-end';

    return (
        <AnimatePresence mode="wait">
            {shouldShow && (
                <div className={`fixed inset-x-0 ${positionClass} z-[9999] pointer-events-none flex justify-center px-4`}>
                    <motion.div
                        key={currentCaption}
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -5 }}
                        className={`caption-overlay flex items-center gap-3 ${bgClass} px-5 py-3 rounded-2xl backdrop-blur-md shadow-2xl border border-white/10`}
                    >
                        <div className="flex-shrink-0 bg-[#333] p-2 rounded-full border border-gray-600 shadow-inner">
                            {currentSpeakerRole === 'host' ? (
                                <ShieldCheck className="w-5 h-5 text-blue-400 fill-blue-500/20" />
                            ) : (
                                <User className="w-5 h-5 text-gray-300" />
                            )}
                        </div>
                        <span className={`${fontClass} ${sizeClass} ${colorClass} leading-snug font-bold drop-shadow-md`}>
                            {currentCaption}
                        </span>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
