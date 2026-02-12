import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    Sparkles, Send, X, Copy, ThumbsUp, ThumbsDown, Bot,
    ListTodo, FileText, MessageSquare, Check, Plus, AlertCircle, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { jsPDF } from 'jspdf';

/* ---------------- TYPES ---------------- */

interface AIMessage {
    id: string;
    sender: 'user' | 'ai';
    content: string;
    timestamp: Date;
    isThinking?: boolean;
}

interface ActionItem {
    id: string;
    text: string;
    completed: boolean;
}

/* ---------------- MOCK DATA ---------------- */
const MOCK_RESPONSES = [
    "Based on the discussion so far, the key action items are: 1) Update the frontend layout, 2) Fix the mobile media issues, and 3) Verify the deployment.",
    "I'm listening to the meeting. It seems like the team is discussing the Q3 roadmap.",
    "Sure! Here's a summary: The team agreed to prioritize the new dashboard features over the legacy report refactor.",
    "That's a great point. I've noted that down.",
    "I can help with that. Let me analyze the transcript...",
    "The sentiment of the meeting seems positive and collaborative.",
];

const MOCK_SUMMARY_POINTS = [
    "Meeting started at 10:00 AM.",
    "Discussed Q3 Roadmap priorities.",
    "Agreed to delay the legacy refactor.",
    "Identified mobile responsiveness issues on iOS.",
    "Proposed new design for the settings panel.",
    "Reviewing user feedback from the beta launch.",
    "Decided to increase server capacity for the upcoming event.",
    "Action items assigned to the frontend team.",
];

const MOCK_INSIGHTS = [
    "Discussion focused on UI performance.",
    "Potential blocker identified: API latency.",
    "Consensus reached on design system.",
    "Action item: Alice to check logs."
];

export default function AICompanionPanel() {
    const { isAICompanionOpen, toggleAICompanion, meeting } = useMeetingStore();
    const [activeTab, setActiveTab] = useState('chat');

    /* ---------------- STATE: CHAT ---------------- */
    const [messages, setMessages] = useState<AIMessage[]>([
        {
            id: 'welcome',
            sender: 'ai',
            content: "Hi! I'm your AI Companion. I can help you catch up, summarize discussions, or answer questions about the meeting.",
            timestamp: new Date(),
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    /* ---------------- STATE: SUMMARY ---------------- */
    const [summaryPoints, setSummaryPoints] = useState<string[]>([MOCK_SUMMARY_POINTS[0]]);

    /* ---------------- STATE: ACTION ITEMS ---------------- */
    const [actionItems, setActionItems] = useState<ActionItem[]>([
        { id: '1', text: 'Review PR #123', completed: false },
        { id: '2', text: 'Update documentation', completed: true },
    ]);
    const [newItemText, setNewItemText] = useState('');

    /* ---------------- STATE: INSIGHTS TICKER ---------------- */
    const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

    const [copiedSummary, setCopiedSummary] = useState(false);

    /* ---------------- EFFECTS: MOCK LIVE UPDATES ---------------- */

    // Simulate Live Summary Updates
    useEffect(() => {
        if (!isAICompanionOpen) return;

        const interval = setInterval(() => {
            setSummaryPoints(prev => {
                if (prev.length < MOCK_SUMMARY_POINTS.length) {
                    return [...prev, MOCK_SUMMARY_POINTS[prev.length]];
                }
                return prev;
            });
        }, 8000);

        return () => clearInterval(interval);
    }, [isAICompanionOpen]);

    // Simulate Insights Ticker
    useEffect(() => {
        if (!isAICompanionOpen) return;

        const interval = setInterval(() => {
            setCurrentInsightIndex(prev => (prev + 1) % MOCK_INSIGHTS.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [isAICompanionOpen]);

    /* ---------------- LOGIC: CHAT ---------------- */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping, activeTab]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: AIMessage = {
            id: Date.now().toString(),
            sender: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        setTimeout(() => {
            const responseText = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
            const aiMsg: AIMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                content: responseText,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMsg]);
            setIsTyping(false);
        }, 1500);
    };

    const handleQuickAction = (action: string) => {
        setInput(action);
    };

    /* ---------------- LOGIC: ACTION ITEMS ---------------- */
    const toggleActionItem = (id: string) => {
        setActionItems(prev => prev.map(item =>
            item.id === id ? { ...item, completed: !item.completed } : item
        ));
    };

    const addActionItem = () => {
        if (!newItemText.trim()) return;
        setActionItems(prev => [...prev, { id: Date.now().toString(), text: newItemText, completed: false }]);
        setNewItemText('');
    };

    const suggestActionItems = () => {
        const newItems = [
            { id: Date.now().toString(), text: 'Schedule follow-up meeting', completed: false },
            { id: (Date.now() + 1).toString(), text: 'Email summary to stakeholders', completed: false }
        ];
        setActionItems(prev => [...prev, ...newItems]);
    };

    /* ---------------- LOGIC: SUMMARY ---------------- */
    const handleCopySummary = async () => {
        const fullSummary = summaryPoints.map(p => `• ${p}`).join('\n');
        try {
            await navigator.clipboard.writeText(fullSummary);
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2000);
        } catch (err) {
            console.error('Failed to copy summary:', err);
        }
    };

    const handleDownloadSummary = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPos = 20;

        const meetingTitle = meeting?.title || "Untitled Meeting";
        const meetingId = meeting?.id || "N/A";

        // Find Host Name
        const allParticipants = useParticipantsStore.getState().participants;
        const hostParticipant = allParticipants.find(p => p.id === meeting?.hostId);
        const hostName = hostParticipant?.name || "N/A";

        // Branding
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Generated by ConnectPro AI Companion", margin, yPos);
        yPos += 10;

        // Header Rect
        doc.setFillColor(248, 250, 252);
        doc.rect(margin - 5, yPos - 5, pageWidth - (margin * 2) + 10, 45, 'F');

        // Title
        doc.setFontSize(22);
        doc.setTextColor(11, 92, 255); // Blue
        doc.setFont("helvetica", "bold");
        doc.text("Meeting Summary", margin, yPos + 10);
        yPos += 22;

        // Specific Meeting Info
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        const splitTitle = doc.splitTextToSize(meetingTitle, pageWidth - (margin * 2));
        doc.text(splitTitle, margin, yPos);
        yPos += (splitTitle.length * 8) + 4;

        // Metadata Grid
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");

        doc.text(`Meeting ID: ${meetingId}`, margin, yPos);
        doc.text(`Host: ${hostName}`, margin + 80, yPos);
        yPos += 6;

        const now = new Date();
        doc.text(`Export Date: ${now.toLocaleDateString()} | ${now.toLocaleTimeString()}`, margin, yPos);
        yPos += 20;

        // Summary Section Header
        doc.setFontSize(14);
        doc.setTextColor(11, 92, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Live Summary Points", margin, yPos);
        yPos += 10;

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);

        // Content
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "normal");

        summaryPoints.forEach(point => {
            const lines = doc.splitTextToSize(`• ${point}`, pageWidth - (margin * 2));
            doc.text(lines, margin, yPos);
            yPos += (lines.length * 7) + 2;

            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
                doc.setFontSize(11);
                doc.setTextColor(51, 65, 85);
            }
        });

        doc.save(`${meetingTitle.replace(/\s+/g, '_').toLowerCase()}_summary.pdf`);
    };


    return (
        <AnimatePresence>
            {isAICompanionOpen && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="
            fixed top-0 right-0 bottom-0
            w-full sm:w-[380px]
            bg-[#1C1C1C]
            border-l border-[#404040]
            z-30
            flex flex-col
            shadow-2xl
            pb-[80px]
          "
                >
                    {/* HEADER */}
                    <div className="shrink-0 flex items-center justify-between p-4 border-b border-[#404040] bg-[#232323]">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-blue-400 fill-blue-400/20" />
                            <h3 className="text-lg font-semibold text-white">AI Companion</h3>
                        </div>
                        <Button variant="ghost" size="icon" onClick={toggleAICompanion} className="hover:bg-[#333] text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                        <div className="px-4 pt-2 bg-[#1C1C1C]">
                            <TabsList className="w-full bg-[#2A2A2A] border border-[#333]">
                                <TabsTrigger value="chat" className="flex-1 data-[state=active]:bg-[#333] data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none transition-all">
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Chat
                                </TabsTrigger>
                                <TabsTrigger value="summary" className="flex-1 data-[state=active]:bg-[#333] data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none transition-all">
                                    <FileText className="w-4 h-4 mr-2" />
                                    Summary
                                </TabsTrigger>
                                <TabsTrigger value="actions" className="flex-1 data-[state=active]:bg-[#333] data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none transition-all">
                                    <ListTodo className="w-4 h-4 mr-2" />
                                    Actions
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* --- TAB: CHAT --- */}
                        {activeTab === 'chat' && (
                            <TabsContent value="chat" forceMount className="flex-1 flex flex-col min-h-0 mt-0">
                                {/* Chat Insights Ticker - Auto Scroll Mock */}
                                <div className="bg-blue-950/20 border-b border-blue-500/10 py-1.5 px-4 flex items-center gap-2 overflow-hidden h-8 shrink-0">
                                    <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
                                    <AnimatePresence mode='wait'>
                                        <motion.span
                                            key={currentInsightIndex}
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            exit={{ y: -20, opacity: 0 }}
                                            className="text-xs text-blue-200 truncate font-medium"
                                        >
                                            {MOCK_INSIGHTS[currentInsightIndex]}
                                        </motion.span>
                                    </AnimatePresence>
                                </div>
                                {/* Message List */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                                    {messages.map(msg => {
                                        const isAi = msg.sender === 'ai';
                                        return (
                                            <div key={msg.id} className={cn('flex flex-col gap-1.5', isAi ? 'items-start' : 'items-end')}>
                                                <div className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5 font-semibold px-1">
                                                    {isAi ? (
                                                        <>
                                                            <Sparkles className="w-3 h-3 text-blue-400" />
                                                            <span>AI Companion</span>
                                                        </>
                                                    ) : <span>You</span>}
                                                    <span className="font-normal opacity-50">• {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <div className={cn(
                                                    "px-4 py-2.5 rounded-2xl text-sm max-w-[90%] md:max-w-[85%] relative group shadow-sm",
                                                    isAi
                                                        ? "bg-[#2A2A2A] text-gray-100 rounded-tl-none border border-[#333]"
                                                        : "bg-[#0B5CFF] text-white rounded-tr-none"
                                                )}>
                                                    {msg.content}
                                                    {isAi && (
                                                        <div className="absolute -bottom-7 left-0 hidden group-hover:flex items-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-white hover:bg-transparent">
                                                                <Copy className="w-3 h-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-white hover:bg-transparent">
                                                                <ThumbsUp className="w-3 h-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-white hover:bg-transparent">
                                                                <ThumbsDown className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {isTyping && (
                                        <div className="flex flex-col gap-1.5 items-start">
                                            <div className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5 font-semibold px-1">
                                                <Sparkles className="w-3 h-3 text-blue-400" />
                                                <span>Thinking...</span>
                                            </div>
                                            <div className="bg-[#2A2A2A] px-4 py-3 rounded-2xl rounded-tl-none border border-[#333] flex gap-1 items-center h-[40px]">
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Quick Actions */}
                                <div className="shrink-0 px-4 pb-3">
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                                        <button onClick={() => handleQuickAction("Create meeting recap")} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[#2A2A2A] border border-[#333] hover:bg-[#333] text-xs text-blue-300 transition-colors flex items-center gap-1.5 shadow-sm">
                                            <Sparkles className="w-3 h-3" /> Create meeting recap
                                        </button>
                                        <button onClick={() => handleQuickAction("Draft follow-up email")} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[#2A2A2A] border border-[#333] hover:bg-[#333] text-xs text-gray-300 shadow-sm transition-colors">
                                            Draft follow-up email
                                        </button>
                                        <button onClick={() => handleQuickAction("Summarize last 5 minutes")} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[#2A2A2A] border border-[#333] hover:bg-[#333] text-xs text-gray-300 shadow-sm transition-colors">
                                            Summarize last 5m
                                        </button>
                                    </div>
                                </div>

                                {/* Input */}
                                <div className="shrink-0 bg-[#1C1C1C] p-4 pt-2 border-t border-[#333]">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSend();
                                        }}
                                        className="flex items-center gap-2 bg-[#232323] border border-[#404040] rounded-xl px-3 py-2 transition-all focus-within:ring-1 focus-within:ring-blue-500/50"
                                    >
                                        <Input
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Ask AI Companion..."
                                            className="flex-1 bg-transparent border-none text-white focus-visible:ring-0 placeholder:text-gray-500"
                                        />
                                        <Button
                                            type="submit"
                                            size="icon"
                                            disabled={!input.trim() || isTyping}
                                            className={cn("transition-all duration-200", input.trim() ? 'bg-[#0B5CFF] hover:bg-blue-600' : 'bg-[#333] text-gray-400', 'text-white rounded-lg w-8 h-8')}
                                        >
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </form>
                                </div>
                            </TabsContent>
                        )}

                        {/* --- TAB: SUMMARY --- */}
                        {activeTab === 'summary' && (
                            <TabsContent value="summary" forceMount className="flex-1 flex flex-col min-h-0 mt-0 overflow-y-auto p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-gray-300">Live Meeting Summary</h4>
                                    <span className="text-[10px] text-green-400 flex items-center gap-1/5 bg-green-500/10 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                        LIVE
                                    </span>
                                </div>

                                <div className="bg-[#232323] border border-[#333] rounded-lg p-4 space-y-3">
                                    {summaryPoints.map((point, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex gap-2 items-start"
                                        >
                                            <span className="text-blue-500 mt-1.5 text-[10px]">•</span>
                                            <p className="text-sm text-gray-300 leading-relaxed">{point}</p>
                                        </motion.div>
                                    ))}
                                    {summaryPoints.length < MOCK_SUMMARY_POINTS.length && (
                                        <div className="flex items-center gap-2 text-xs text-blue-400/70 italic pt-2">
                                            <Sparkles className="w-3 h-3" /> Analyzing conversation...
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleCopySummary}
                                        className={cn(
                                            "flex-1 transition-all duration-200 gap-2 text-white",
                                            copiedSummary ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
                                        )}
                                    >
                                        {copiedSummary ? (
                                            <>
                                                <Check className="w-4 h-4" /> Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" /> Copy Summary
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={handleDownloadSummary}
                                        variant="outline"
                                        className="border-[#404040] text-gray-300 hover:bg-[#333] hover:text-white transition-all duration-200 px-3"
                                        title="Download PDF"
                                    >
                                        <Download className="w-4 h-4" />
                                    </Button>
                                </div>
                            </TabsContent>
                        )}

                        {/* --- TAB: ACTION ITEMS --- */}
                        {activeTab === 'actions' && (
                            <TabsContent value="actions" forceMount className="flex-1 flex flex-col min-h-0 mt-0 overflow-y-auto p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-semibold text-gray-300">Action Items</h4>
                                    <Button variant="outline" size="sm" onClick={suggestActionItems} className="text-xs h-7 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200">
                                        <Sparkles className="w-3 h-3 mr-1" /> Suggest
                                    </Button>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <AnimatePresence>
                                        {actionItems.map(item => (
                                            <motion.div
                                                key={item.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={cn(
                                                    "flex items-start gap-3 p-3 rounded-lg border transition-colors group",
                                                    item.completed
                                                        ? "bg-[#1A1A1A] border-[#333]"
                                                        : "bg-[#232323] border-[#404040] hover:border-blue-500/30"
                                                )}
                                            >
                                                <button
                                                    onClick={() => toggleActionItem(item.id)}
                                                    className={cn(
                                                        "mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all duration-200",
                                                        item.completed
                                                            ? "bg-blue-600 border-blue-600 text-white"
                                                            : "border-gray-500 text-transparent hover:border-blue-400"
                                                    )}
                                                >
                                                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                                </button>
                                                <span className={cn(
                                                    "text-sm leading-relaxed flex-1 transition-colors",
                                                    item.completed ? "text-gray-500 line-through" : "text-gray-200"
                                                )}>
                                                    {item.text}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>

                                <div className="mt-auto pt-4 border-t border-[#333]">
                                    <div className="flex gap-2">
                                        <Input
                                            value={newItemText}
                                            onChange={(e) => setNewItemText(e.target.value)}
                                            placeholder="Add task..."
                                            className="flex-1 bg-[#232323] border-[#404040] text-white h-9 text-sm focus-visible:ring-1 focus-visible:ring-blue-500"
                                            onKeyDown={(e) => e.key === 'Enter' && addActionItem()}
                                        />
                                        <Button size="sm" onClick={addActionItem} disabled={!newItemText.trim()} className="bg-[#333] hover:bg-blue-600 text-white">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        )}

                    </Tabs>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
