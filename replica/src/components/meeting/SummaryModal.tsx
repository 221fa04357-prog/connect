import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, FileText, Check, Copy, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn } from '@/lib/utils';

interface SummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const API = import.meta.env.VITE_API_URL || '';

export default function SummaryModal({ isOpen, onClose }: SummaryModalProps) {
    const { transcripts } = useTranscriptionStore();
    const [summary, setSummary] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateSummary = async () => {
        if (transcripts.length === 0) {
            setError('No transcription data available yet. Please talk more!');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            // Combine transcripts into a single text block
            const fullText = transcripts
                .map(t => `${t.participantName}: ${t.text}`)
                .join('\n');

            const response = await fetch(`${API}/api/ai/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: fullText })
            });

            if (!response.ok) throw new Error('Failed to generate summary');

            const data = await response.json();
            setSummary(data.summary);
        } catch (err) {
            console.error('Summary Error:', err);
            setError('Failed to generate summary. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-2xl bg-[#1C1C1C] border border-[#333] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                >
                    <div className="p-4 border-b border-[#333] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-blue-400" />
                            <h2 className="text-xl font-bold text-white">Meeting Summary</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {!summary && !isGenerating && (
                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                                    <FileText className="w-8 h-8 text-blue-400" />
                                </div>
                                <div className="max-w-sm">
                                    <h3 className="text-lg font-semibold text-white">Generate Live Summary</h3>
                                    <p className="text-sm text-gray-400 mt-2">
                                        Our AI will analyze the current transcript and provide a concise summary of the meeting so far.
                                    </p>
                                </div>
                                <Button
                                    onClick={generateSummary}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 h-12 rounded-xl shadow-lg shadow-blue-500/20"
                                >
                                    Generate Now
                                </Button>
                                {error && (
                                    <p className="text-red-400 text-sm flex items-center gap-1.5 justify-center mt-2 font-medium">
                                        <AlertCircle className="w-4 h-4" />
                                        {error}
                                    </p>
                                )}
                            </div>
                        )}

                        {isGenerating && (
                            <div className="flex flex-col items-center justify-center py-20 space-y-6">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                    <Sparkles className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-white animate-pulse">AI is thinking...</p>
                                    <p className="text-sm text-gray-500 mt-1 italic">Analyzing discussions and identifying key points</p>
                                </div>
                            </div>
                        )}

                        {summary && !isGenerating && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-6"
                            >
                                <div className="bg-[#252525] border border-[#404040] rounded-xl p-6 shadow-inner">
                                    <div className="prose prose-invert max-w-none text-gray-200 leading-relaxed whitespace-pre-wrap">
                                        {summary}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Button
                                        onClick={handleCopy}
                                        variant="outline"
                                        className={cn(
                                            "flex-1 h-11 transition-all rounded-xl",
                                            copied ? "bg-green-500/10 text-green-400 border-green-500/30" : "border-[#404040] text-gray-300"
                                        )}
                                    >
                                        {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                        {copied ? 'Copied' : 'Copy to Clipboard'}
                                    </Button>
                                    <Button
                                        onClick={generateSummary}
                                        variant="ghost"
                                        className="h-11 px-6 text-blue-400 hover:text-blue-300 hover:bg-blue-500/5 rounded-xl border border-transparent hover:border-blue-500/20 transition-all font-semibold"
                                    >
                                        Regenerate
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    <div className="p-4 bg-[#161616] border-t border-[#333] text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">
                        ConnectPro AI Companion • Powered by llama-3.3-70b
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
