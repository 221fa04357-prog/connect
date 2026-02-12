import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    Clock,
    Users,
    Copy,
    Check,
    ChevronLeft,
    MessageSquare,
    FileText,
    CheckSquare,
    Sparkles,
    Download,
    Share2,
    ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';

interface RecapData {
    id: string;
    title: string;
    date: string;
    duration: string;
    participants: string[];
    summary: string[];
    actionItems: { id: string; text: string; completed: boolean }[];
    transcript: { speaker: string; text: string; time: string }[];
}

const MOCK_RECAP: RecapData = {
    id: 'mock-1',
    title: 'Product Roadmap Q3 Sync',
    date: 'February 12, 2026',
    duration: '45 mins',
    participants: ['Alex Rivera', 'Sarah Chen', 'Jordan Smith', 'Maria Garcia'],
    summary: [
        'Confirmed Q3 Roadmap priorities focusing on AI integration.',
        'Agreed to delay the legacy database refactor to Q4.',
        'Identified critical mobile responsiveness issues on iOS devices.',
        'Proposed a new design for the user settings panel and permissions.',
        'Decided to increase server capacity by 20% for the upcoming beta event.'
    ],
    actionItems: [
        { id: 'a1', text: 'Create high-fidelity mockups for new settings panel', completed: true },
        { id: 'a2', text: 'Schedule follow-up meeting with Infra team about server capacity', completed: false },
        { id: 'a3', text: 'Audit iOS media stream handling for orientation changes', completed: false },
        { id: 'a4', text: 'Update stakeholder deck with revised Q3 timeline', completed: true }
    ],
    transcript: [
        { speaker: 'Alex Rivera', time: '10:02 AM', text: "Welcome everyone. Let's start with the Q3 roadmap updates." },
        { speaker: 'Sarah Chen', time: '10:05 AM', text: "The AI companion feature is progressing well, but we might need more time for the core engine refactor." },
        { speaker: 'Jordan Smith', time: '10:12 AM', text: "I suggest we prioritize the AI features since they have higher stakeholder visibility." },
        { speaker: 'Maria Garcia', time: '10:15 AM', text: "Agreed. Let's shift the database refactor to Q4 then." }
    ]
};

export default function MeetingRecap() {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');
    const [copiedSummary, setCopiedSummary] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedTranscript, setCopiedTranscript] = useState(false);

    const handleCopySummary = async () => {
        const text = MOCK_RECAP.summary.join('\n');
        await navigator.clipboard.writeText(text);
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2000);
    };

    const handleCopyTranscript = async () => {
        const text = MOCK_RECAP.transcript.map(line => `[${line.time}] ${line.speaker}: ${line.text}`).join('\n');
        await navigator.clipboard.writeText(text);
        setCopiedTranscript(true);
        setTimeout(() => setCopiedTranscript(false), 2000);
    };

    const handleShare = async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleDownload = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPos = 20;

        // Title
        doc.setFontSize(22);
        doc.setTextColor(11, 92, 255); // Blue
        doc.text("ConnectPro Meeting Recap", margin, yPos);
        yPos += 12;

        // Meeting Metadata
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(MOCK_RECAP.title, margin, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Date: ${MOCK_RECAP.date} | Duration: ${MOCK_RECAP.duration}`, margin, yPos);
        yPos += 6;
        doc.text(`Participants: ${MOCK_RECAP.participants.join(', ')}`, margin, yPos);
        yPos += 15;

        // Summary Section
        doc.setFontSize(14);
        doc.setTextColor(11, 92, 255);
        doc.text("Key Takeaways", margin, yPos);
        yPos += 8;

        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        MOCK_RECAP.summary.forEach(point => {
            const lines = doc.splitTextToSize(`• ${point}`, pageWidth - (margin * 2));
            doc.text(lines, margin, yPos);
            yPos += (lines.length * 6) + 2;
        });
        yPos += 5;

        // Action Items Section
        doc.setFontSize(14);
        doc.setTextColor(11, 92, 255);
        doc.text("Action Items", margin, yPos);
        yPos += 8;

        doc.setFontSize(11);
        MOCK_RECAP.actionItems.forEach(item => {
            const status = item.completed ? "[Done] " : "[Todo] ";
            const lines = doc.splitTextToSize(`${status}${item.text}`, pageWidth - (margin * 2));
            doc.text(lines, margin, yPos);
            yPos += (lines.length * 6) + 2;
        });
        yPos += 10;

        // Check for page break before Transcript
        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }

        // Transcript Section
        doc.setFontSize(14);
        doc.setTextColor(11, 92, 255);
        doc.text("Meeting Transcript", margin, yPos);
        yPos += 10;

        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        MOCK_RECAP.transcript.forEach(line => {
            doc.setTextColor(11, 92, 255);
            doc.text(`${line.time} - ${line.speaker}:`, margin, yPos);
            yPos += 5;

            doc.setTextColor(0, 0, 0);
            const lines = doc.splitTextToSize(line.text, pageWidth - (margin * 2));
            doc.text(lines, margin, yPos);
            yPos += (lines.length * 5) + 5;

            // Page break check
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
        });

        doc.save(`${MOCK_RECAP.title.toLowerCase().replace(/\s+/g, '_')}_recap.pdf`);
    };

    return (
        <div className="min-h-screen bg-[#121212] text-white">
            {/* Header / Navigation */}
            <header className="sticky top-0 z-50 bg-[#1C1C1C]/80 backdrop-blur-md border-b border-[#333]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-1 sm:gap-4 overflow-hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/')}
                            className="text-gray-400 hover:text-white hover:bg-white/10 shrink-0"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
                            <h1 className="text-sm sm:text-lg font-semibold tracking-tight truncate">Meeting Recap</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleShare}
                            className={cn(
                                "border-[#404040] transition-all h-9 w-9 sm:w-auto sm:h-10 p-0 sm:px-4",
                                copiedLink ? "bg-green-500/10 text-green-400 border-green-500/30" : "text-gray-300 hover:bg-[#333]"
                            )}
                        >
                            {copiedLink ? <Check className="w-4 h-4 sm:mr-2" /> : <Share2 className="w-4 h-4 sm:mr-2" />}
                            <span className="hidden sm:inline">{copiedLink ? 'Link Copied' : 'Share'}</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                            className="border-[#404040] text-gray-300 hover:bg-[#333] h-9 w-9 sm:w-auto sm:h-10 p-0 sm:px-4"
                        >
                            <Download className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Download</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => navigate('/recaps')}
                            className="bg-[#0B5CFF] hover:bg-blue-600 text-white h-9 w-9 sm:w-auto sm:px-4 p-0"
                        >
                            <MessageSquare className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">All Recaps</span>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">
                {/* Hero Section */}
                <div>
                    <Badge variant="outline" className="mb-4 border-blue-500/30 text-blue-400 bg-blue-500/5 px-3 py-1">
                        AI Generated Recap
                    </Badge>
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">{MOCK_RECAP.title}</h2>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {MOCK_RECAP.date}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {MOCK_RECAP.duration}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            {MOCK_RECAP.participants.length} Participants
                        </div>
                    </div>
                </div>

                {/* Body Content */}
                <div className="space-y-12">
                    <div className="flex gap-1 p-1 bg-[#1C1C1C] rounded-xl w-fit border border-[#333] shadow-inner">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={cn(
                                "px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                activeTab === 'summary'
                                    ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(11,92,255,0.4)]"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Summary
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('transcript')}
                            className={cn(
                                "px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                activeTab === 'transcript'
                                    ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(11,92,255,0.4)]"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Transcript
                            </div>
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-8"
                            >
                                {activeTab === 'summary' ? (
                                    <div className="space-y-8">
                                        {/* Key Takeaways */}
                                        <div className="bg-[#1C1C1C] border border-[#333] rounded-2xl p-6 md:p-8 shadow-xl">
                                            <div className="flex items-center justify-between mb-8">
                                                <h3 className="text-xl font-semibold flex items-center gap-2">
                                                    <Sparkles className="w-5 h-5 text-blue-400" />
                                                    Key Takeaways
                                                </h3>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleCopySummary}
                                                    className={cn("text-xs gap-2 transition-all", copiedSummary ? "bg-green-500/10 text-green-400" : "text-gray-400 hover:text-white hover:bg-white/5")}
                                                >
                                                    {copiedSummary ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                    {copiedSummary ? 'Copied' : 'Copy Summary'}
                                                </Button>
                                            </div>
                                            <div className="space-y-5">
                                                {MOCK_RECAP.summary.map((point, i) => (
                                                    <div key={i} className="flex gap-4 items-start group">
                                                        <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 group-hover:scale-150 transition-transform duration-300 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                                        <p className="text-gray-300 leading-relaxed text-base">{point}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Action Items */}
                                        <div className="bg-[#1C1C1C] border border-[#333] rounded-2xl p-6 md:p-8 shadow-lg">
                                            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                                <CheckSquare className="w-5 h-5 text-green-400" />
                                                Action Items
                                            </h3>
                                            <div className="space-y-4">
                                                {MOCK_RECAP.actionItems.map(item => (
                                                    <div
                                                        key={item.id}
                                                        className={cn(
                                                            "flex items-start gap-4 p-4 rounded-xl border transition-all hover:bg-white/5",
                                                            item.completed
                                                                ? "bg-green-500/5 border-green-500/20"
                                                                : "bg-[#252525] border-[#404040]"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0",
                                                            item.completed ? "bg-green-500 border-green-500 text-white" : "border-gray-500"
                                                        )}>
                                                            {item.completed && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                                        </div>
                                                        <span className={cn(
                                                            "text-sm leading-tight",
                                                            item.completed ? "text-gray-500 line-through" : "text-gray-200"
                                                        )}>
                                                            {item.text}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Participants */}
                                        <div className="bg-[#1C1C1C] border border-[#333] rounded-2xl p-6 md:p-8 shadow-lg">
                                            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                                <Users className="w-5 h-5 text-purple-400" />
                                                Participants
                                            </h3>
                                            <div className="flex flex-wrap gap-3">
                                                {MOCK_RECAP.participants.map((person, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-center gap-3 bg-[#252525] border border-[#404040] px-4 py-2 rounded-full text-sm font-medium text-gray-300 transition-colors hover:bg-[#333]"
                                                    >
                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs text-white">
                                                            {person.charAt(0)}
                                                        </div>
                                                        {person}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Feedback / CTA */}
                                        <div className="p-8 md:p-10 rounded-2xl bg-gradient-to-br from-[#0B5CFF]/20 to-purple-600/10 border border-blue-500/20 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
                                            <div className="text-center md:text-left">
                                                <h4 className="font-semibold text-blue-100 text-2xl mb-2">Did we miss something?</h4>
                                                <p className="text-sm text-blue-200/70 max-w-sm">ConnectPro AI learns from your feedback to provide better summaries. Help us improve for your next meeting.</p>
                                            </div>
                                            <Button className="w-full md:w-auto bg-white text-blue-600 hover:bg-gray-100 font-bold px-10 h-14 text-lg group shrink-0 shadow-lg">
                                                Edit Recap <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[#161616] border border-[#333] rounded-2xl p-6 md:p-8 shadow-xl min-h-[500px]">
                                        <div className="flex items-center justify-between mb-8">
                                            <h3 className="text-xl font-semibold flex items-center gap-2">
                                                <MessageSquare className="w-5 h-5 text-blue-400" />
                                                Meeting Transcript
                                            </h3>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleCopyTranscript}
                                                className={cn("text-xs gap-2 transition-all", copiedTranscript ? "bg-green-500/10 text-green-400" : "text-gray-400 hover:text-white hover:bg-white/5")}
                                            >
                                                {copiedTranscript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                {copiedTranscript ? 'Copied' : 'Copy Transcript'}
                                            </Button>
                                        </div>
                                        <div className="space-y-8">
                                            {MOCK_RECAP.transcript.map((line, i) => (
                                                <div key={i} className="flex flex-col gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-[#2A2A2A] border border-[#404040] flex items-center justify-center text-[10px] font-bold text-blue-400">
                                                            {line.speaker.charAt(0)}
                                                        </div>
                                                        <span className="text-sm font-bold text-gray-200">{line.speaker}</span>
                                                        <span className="text-[10px] text-gray-500 font-mono bg-[#222] px-1.5 py-0.5 rounded border border-[#333]">{line.time}</span>
                                                    </div>
                                                    <div className="bg-[#232323] border border-[#333] p-5 rounded-2xl rounded-tl-none ml-11 shadow-sm">
                                                        <p className="text-gray-300 leading-relaxed">
                                                            {line.text}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </main>
        </div>
    );
}
