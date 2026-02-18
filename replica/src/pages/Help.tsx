import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, HelpCircle, Search, Book, Video, Shield, Menu, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui';
import { cn } from '@/lib/utils';


type Category = 'getting-started' | 'video-audio' | 'security' | 'faq';

export default function Help() {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState<Category>('getting-started');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const categories = [
        { id: 'getting-started', label: 'Getting Started', icon: Book },
        { id: 'video-audio', label: 'Video & Audio', icon: Video },
        { id: 'security', label: 'Security & Privacy', icon: Shield },
        { id: 'faq', label: 'FAQs', icon: HelpCircle },
    ];

    const renderContent = () => {
        switch (activeCategory) {
            case 'getting-started':
                return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                        <h2 className="text-3xl font-bold mb-6">Getting Started with ConnectPro</h2>
                        <div className="space-y-6">
                            <div className="bg-[#232323] p-6 rounded-xl border border-[#333]">
                                <h3 className="text-xl font-semibold mb-3">1. Create an Account</h3>
                                <p className="text-gray-400">Sign up using your email to get started. Navigate to the registration page and fill in your details.</p>
                            </div>
                            <div className="bg-[#232323] p-6 rounded-xl border border-[#333]">
                                <h3 className="text-xl font-semibold mb-3">2. Start a Meeting</h3>
                                <p className="text-gray-400">Once logged in, click "Start New Meeting" from the dashboard. You will be instantly placed into your personal meeting room.</p>
                            </div>
                            <div className="bg-[#232323] p-6 rounded-xl border border-[#333]">
                                <h3 className="text-xl font-semibold mb-3">3. Invite Participants</h3>
                                <p className="text-gray-400">Inside the meeting, use the "Invite" button or copy the meeting link to share with your team.</p>
                            </div>
                        </div>
                    </motion.div>
                );
            case 'video-audio':
                return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                        <h2 className="text-3xl font-bold mb-6">Video & Audio Settings</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#232323] p-6 rounded-xl border border-[#333]">
                                <Video className="w-8 h-8 text-[#0B5CFF] mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Camera Setup</h3>
                                <p className="text-gray-400 text-sm">Ensure your camera is connected. You can select different specific cameras from the settings menu.</p>
                            </div>
                            <div className="bg-[#232323] p-6 rounded-xl border border-[#333]">
                                <Search className="w-8 h-8 text-[#0B5CFF] mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Microphone Issues</h3>
                                <p className="text-gray-400 text-sm">If others can't hear you, check if you are muted or if the correct microphone input is selected.</p>
                            </div>
                        </div>
                    </motion.div>
                );
            case 'security':
                return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                        <h2 className="text-3xl font-bold mb-6">Security & Privacy</h2>
                        <p className="text-gray-400 mb-6 text-lg">Your security is our top priority. All meetings are encrypted end-to-end.</p>
                        <ul className="space-y-4">
                            {[
                                "End-to-end encryption for all calls",
                                "Waiting rooms to approve guests",
                                "Password protected meetings",
                                "Host controls to mute/remove participants"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-gray-300">
                                    <Shield className="w-5 h-5 text-green-500" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                );
            case 'faq':
                return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                        <h2 className="text-3xl font-bold mb-6">Frequently Asked Questions</h2>
                        <Accordion type="single" collapsible className="w-full">
                            {[
                                { q: "How do I start a meeting?", a: "Click 'Start New Meeting' on your dashboard." },
                                { q: "Can I record meetings?", a: "Yes, use the 'Record' button in the toolbar." },
                                { q: "Is it free?", a: "We offer a generous free tier for personal use." },
                                { q: "How many participants?", a: "Up to 100 participants in the pro plan." }
                            ].map((faq, i) => (
                                <AccordionItem key={i} value={`item-${i}`} className="border-[#333]">
                                    <AccordionTrigger className="text-left text-lg hover:no-underline hover:text-[#0B5CFF]">
                                        {faq.q}
                                    </AccordionTrigger>
                                    <AccordionContent className="text-gray-400 text-base">
                                        {faq.a}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex h-screen bg-[#1C1C1C] text-white overflow-hidden">
            {/* Sidebar */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-40 w-64 bg-[#111] border-r border-[#333] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 border-b border-[#333] flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl">
                        <HelpCircle className="w-6 h-6 text-[#0B5CFF]" />
                        <span>Support</span>
                    </div>
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => {
                                setActiveCategory(cat.id as Category);
                                setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors",
                                activeCategory === cat.id
                                    ? "bg-[#0B5CFF]/10 text-[#0B5CFF]"
                                    : "text-gray-400 hover:bg-[#222] hover:text-white"
                            )}
                        >
                            <cat.icon className="w-5 h-5" />
                            {cat.label}
                            {activeCategory === cat.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-[#333]">
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2 border-[#333] text-gray-400 hover:text-white"
                        onClick={() => navigate('/')}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A] relative">
                {/* Mobile Header */}
                <header className="md:hidden flex items-center p-4 border-b border-[#333] bg-[#111]">
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                        <Menu className="w-6 h-6" />
                    </Button>
                    <span className="ml-4 font-bold text-lg">Help Center</span>
                </header>

                {/* Top Search Bar */}
                <div className="p-6 md:p-8 border-b border-[#222]">
                    <div className="max-w-3xl mx-auto relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                        <Input
                            placeholder="Search documentation..."
                            className="pl-12 bg-[#1C1C1C] border-[#333] h-12 rounded-lg focus:ring-1 focus:ring-[#0B5CFF]"
                        />
                    </div>
                </div>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-6 md:p-10">
                    <div className="max-w-4xl mx-auto">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
}
