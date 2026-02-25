import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Zoom-style live captions overlay.
 *
 * Behavior:
 * - Renders ONLY when `isTranscriptionEnabled` AND there is an active `currentCaption`
 * - Shows a single floating pill at the bottom-center of the meeting screen
 * - Caption automatically disappears after 3 s of silence (handled in TranscriptionManager)
 * - Does NOT embed into the video element; uses fixed/absolute positioning as an overlay
 * - Pointer events disabled so it never blocks UI interactions
 */
export function TranscriptionOverlay() {
    const { isTranscriptionEnabled, currentCaption } = useTranscriptionStore();

    // Nothing to show if captions are off OR no active speech
    const shouldShow = isTranscriptionEnabled && currentCaption.length > 0;

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    key="caption-overlay"
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="captions-overlay"
                    aria-live="polite"
                    aria-label="Live captions"
                >
                    {currentCaption}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
