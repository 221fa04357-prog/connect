import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { motion, AnimatePresence } from 'framer-motion';

export function TranscriptionOverlay() {
    const { transcripts, isTranscriptionEnabled } = useTranscriptionStore();

    if (!isTranscriptionEnabled || transcripts.length === 0) return null;

    // Show last 3 segments to avoid clutter but give context
    const recentTranscripts = transcripts.slice(-3);

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-2xl px-4 pointer-events-none">
            <div className="flex flex-col items-center gap-2">
                <AnimatePresence mode="popLayout">
                    {recentTranscripts.map((segment, idx) => (
                        <motion.div
                            key={`${segment.timestamp}-${idx}`}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-lg shadow-xl text-center"
                        >
                            <div className="flex items-center justify-center gap-2 mb-0.5">
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                                    {segment.participantName}
                                </span>
                            </div>
                            <p className="text-sm text-gray-100 font-medium leading-relaxed">
                                {segment.text}
                            </p>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
