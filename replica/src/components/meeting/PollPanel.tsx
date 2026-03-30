import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ListTodo, Plus, Send, Trash2, CheckCircle2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { usePollStore, Poll } from '@/stores/usePollStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useChatStore } from '@/stores/useChatStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

export function PollPanel() {
    const { 
        polls, 
        isPollPanelOpen, 
        setPollPanelOpen, 
        createPoll, 
        votePoll, 
        closePoll, 
        fetchPolls 
    } = usePollStore();
    const { meeting, isJoinedAsHost } = useMeetingStore();
    const { user } = useAuthStore();
    const { localUserId } = useChatStore();
    const { participants } = useParticipantsStore();
    
    // Robust host check
    const currentUserId = user?.id || localUserId;
    const currentParticipant = participants.find(p => p.id === currentUserId);
    const isHostOrCoHost = isJoinedAsHost || 
                           currentParticipant?.role === 'host' || 
                           currentParticipant?.role === 'co-host';
    
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        if (!meeting) return;
        if (!meeting.endTime && (!meeting.startTime || !meeting.duration)) return;

        const updateTimer = () => {
            let endTime = 0;
            if (meeting.endTime) {
                endTime = Number(meeting.endTime);
            } else if (meeting.startTime && meeting.duration) {
                const start = new Date(meeting.startTime).getTime();
                endTime = start + (meeting.duration * 60 * 1000);
            }

            const now = Date.now();
            const diff = endTime - now;

            if (diff <= 0) {
                setTimeLeft("00:00");
            } else {
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [meeting]);
    
    const [isCreating, setIsCreating] = useState(false);
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [isQuiz, setIsQuiz] = useState(false);
    const [correctIndex, setCorrectIndex] = useState<number | null>(null);

    useEffect(() => {
        if (isPollPanelOpen && meeting?.id) {
            fetchPolls(meeting.id);
        }
    }, [isPollPanelOpen, meeting?.id, fetchPolls]);

    const handleAddOption = () => {
        if (options.length < 6) {
            setOptions([...options, '']);
        }
    };

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = options.filter((_, i) => i !== index);
            setOptions(newOptions);
            if (correctIndex === index) setCorrectIndex(null);
        }
    };

    const handleCreate = () => {
        if (!question.trim() || options.some(o => !o.trim())) {
            toast.error("Please fill in all fields");
            return;
        }
        
        const currentUserId = user?.id || localUserId;
        if (meeting?.id && currentUserId) {
            createPoll(meeting.id, currentUserId, {
                question,
                options: options.filter(o => o.trim()),
                is_quiz: isQuiz,
                correct_option_index: isQuiz ? correctIndex : null
            });
            setIsCreating(false);
            setQuestion('');
            setOptions(['', '']);
            setIsQuiz(false);
            setCorrectIndex(null);
            toast.success("Poll launched!");
        }
    };

    const handleVote = (pollId: number, optionIndex: number) => {
        const currentUserId = user?.id || localUserId;
        if (meeting?.id && currentUserId) {
            votePoll(meeting.id, pollId, currentUserId, optionIndex);
        }
    };

    return (
        <AnimatePresence>
            {isPollPanelOpen && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="
            fixed right-0 top-0 bottom-20
            w-full md:w-80 lg:w-96
            bg-[#1C1C1C]
            border-l border-[#404040]
            z-50 flex flex-col shadow-2xl
          "
                >
                    <div className="shrink-0 flex items-center justify-between p-4 border-b border-[#404040]">
                        <div className="flex items-center gap-2">
                            <ListTodo className="w-5 h-5 text-blue-400" />
                            <h3 className="text-lg font-semibold">Polls & Quizzes</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            {timeLeft && (
                                <div className="bg-black/40 backdrop-blur px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="text-[11px] font-mono font-medium text-white/90">{timeLeft}</span>
                                </div>
                            )}
                            <button 
                                onClick={() => setPollPanelOpen(false)}
                                className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {isHostOrCoHost && !isCreating && (
                        <div className="p-4 border-b border-[#404040] shrink-0">
                            <Button 
                                onClick={() => setIsCreating(true)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9 text-sm"
                            >
                                <Plus className="w-4 h-4" /> Create Poll
                            </Button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

                        {isCreating && (
                            <div className="bg-[#232323] p-4 rounded-xl border border-blue-500/30 space-y-4">
                                <Input 
                                    placeholder="Ask a question..." 
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    className="bg-[#1A1A1A] border-[#333]"
                                />
                                <div className="space-y-2">
                                    {options.map((opt, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Input 
                                                    placeholder={`Option ${idx + 1}`}
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const newOpts = [...options];
                                                        newOpts[idx] = e.target.value;
                                                        setOptions(newOpts);
                                                    }}
                                                    className={cn(
                                                        "bg-[#1A1A1A] border-[#333] pr-10",
                                                        isQuiz && correctIndex === idx && "border-green-500 ring-1 ring-green-500"
                                                    )}
                                                />
                                                {isQuiz && (
                                                    <button 
                                                        onClick={() => setCorrectIndex(idx)}
                                                        className={cn(
                                                            "absolute right-2 top-1/2 -translate-y-1/2",
                                                            correctIndex === idx ? "text-green-500" : "text-gray-600 hover:text-green-400"
                                                        )}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            {options.length > 2 && (
                                                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => handleRemoveOption(idx)}>
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {options.length < 6 && (
                                        <Button variant="ghost" size="sm" onClick={handleAddOption} className="text-blue-400 text-xs">
                                            + Add Option
                                        </Button>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        checked={isQuiz} 
                                        onChange={(e) => setIsQuiz(e.target.checked)}
                                        id="isQuiz"
                                        className="rounded border-gray-700 bg-gray-900"
                                    />
                                    <label htmlFor="isQuiz" className="text-xs text-gray-400 cursor-pointer">Mark as Quiz (select a correct answer)</label>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button variant="ghost" className="flex-1" onClick={() => setIsCreating(false)}>Cancel</Button>
                                    <Button className="flex-1 bg-blue-600" onClick={handleCreate}>Launch</Button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {polls.slice().reverse().map((poll) => {
                                const totalVotes = poll.votes.length;
                                const hasVoted = poll.votes.some(v => v.user_id === (user?.id || localUserId));
                                const userVote = poll.votes.find(v => v.user_id === (user?.id || localUserId))?.option_index;
                                
                                return (
                                    <div key={poll.id} className="bg-[#232323] border border-[#333] p-4 rounded-xl space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <span className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded uppercase font-bold mb-2 inline-block",
                                                    poll.is_quiz ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                                                )}>
                                                    {poll.is_quiz ? 'Quiz' : 'Poll'}
                                                </span>
                                                <h4 className="text-sm font-semibold">{poll.question}</h4>
                                            </div>
                                            {isHostOrCoHost && poll.status === 'open' && (
                                                <Button size="sm" variant="ghost" className="text-red-400 h-7 px-2 hover:bg-red-500/10" onClick={() => meeting?.id && closePoll(meeting.id, poll.id)}>
                                                    End
                                                </Button>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {poll.options.map((opt, idx) => {
                                                const optVotes = poll.votes.filter(v => v.option_index === idx).length;
                                                const percentage = totalVotes > 0 ? (optVotes / totalVotes) * 100 : 0;
                                                const isCorrect = poll.is_quiz && poll.correct_option_index === idx;
                                                const isUserChoice = userVote === idx;

                                                return (
                                                    <div key={idx} className="space-y-1">
                                                        <button
                                                            disabled={poll.status === 'closed' || hasVoted}
                                                            onClick={() => handleVote(poll.id, idx)}
                                                            className={cn(
                                                                "w-full text-left p-2 rounded-lg text-sm border transition-all relative overflow-hidden group",
                                                                isUserChoice ? "border-blue-500 bg-blue-500/10" : "border-[#333] hover:border-gray-500 bg-[#1A1A1A]",
                                                                poll.status === 'closed' && isCorrect && "border-green-500 bg-green-500/10"
                                                            )}
                                                        >
                                                            {/* Result Bar */}
                                                            {(hasVoted || poll.status === 'closed') && (
                                                                <div 
                                                                    className={cn(
                                                                        "absolute left-0 top-0 bottom-0 opacity-10 transition-all duration-1000",
                                                                        isCorrect ? "bg-green-500" : (isUserChoice ? "bg-blue-500" : "bg-gray-400")
                                                                    )}
                                                                    style={{ width: `${percentage}% ` }}
                                                                />
                                                            )}
                                                            
                                                            <div className="relative flex justify-between items-center z-10">
                                                                <span className="flex items-center gap-2">
                                                                    {opt}
                                                                    {poll.status === 'closed' && isCorrect && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                                                </span>
                                                                {(hasVoted || poll.status === 'closed') && (
                                                                    <span className="text-[10px] text-gray-400">{Math.round(percentage)}%</span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-[#333]">
                                            <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
                                            {poll.status === 'closed' && <span className="text-red-400 font-bold">Closed</span>}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {polls.length === 0 && !isCreating && (
                                <div className="h-40 flex flex-col items-center justify-center opacity-20 text-center px-8">
                                    <ListTodo className="w-12 h-12 mb-2" />
                                    <p className="text-xs">No active polls yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
