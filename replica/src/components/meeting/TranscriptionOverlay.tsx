import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, User } from 'lucide-react';

/**
 * Zoom-style live captions overlay.
 */
export function TranscriptionOverlay() {
    const { currentCaption, currentSpeakerRole } = useTranscriptionStore();

    // Show captions to ALL participants if there is active speech
    const shouldShow = currentCaption.length > 0;

    return (
        <AnimatePresence mode="wait">
            {shouldShow && (
                <div className="fixed inset-x-0 bottom-[120px] z-[9999] pointer-events-none flex justify-center items-center px-4">
                    <motion.div
                        key={currentCaption}
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -5 }}
                        className="caption-overlay flex items-center gap-3"
                    >
                        <div className="flex-shrink-0">
                            {currentSpeakerRole === 'host' ? (
                                <ShieldCheck className="w-6 h-6 text-blue-400" />
                            ) : (
                                <User className="w-6 h-6 text-gray-400" />
                            )}
                        </div>
                        <span className="text-white leading-tight font-medium text-lg">
                            {currentCaption}
                        </span>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
