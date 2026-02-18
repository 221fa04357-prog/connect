import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    ChevronLeft,
    FileText,
    Calendar,
    Users,
    ArrowRight,
    Filter,
    ListFilter,
    Check,
    Clock
} from 'lucide-react';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Badge } from '@/components/ui';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui";
import { cn } from '@/lib/utils';

const API = import.meta.env.VITE_API_URL || '';

export default function RecapsList() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
    const [filterHost, setFilterHost] = useState<string>('all');
    const [recaps, setRecaps] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch(`${API}/api/recaps`)
            .then(res => res.json())
            .then(data => {
                setRecaps(data.map((r: any) => ({
                    ...r,
                    timestamp: parseInt(r.timestamp)
                })));
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Error fetching recaps:', err);
                setIsLoading(false);
            });
    }, []);

    const hosts = useMemo(() => {
        const uniqueHosts = Array.from(new Set(recaps.map(r => r.host)));
        return ['all', ...uniqueHosts];
    }, [recaps]);

    const filteredAndSortedRecaps = useMemo(() => {
        let list = recaps.filter(recap =>
            (recap.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                recap.host.toLowerCase().includes(searchQuery.toLowerCase())) &&
            (filterHost === 'all' || recap.host === filterHost)
        );

        return list.sort((a, b) => {
            if (sortBy === 'newest') return b.timestamp - a.timestamp;
            return a.timestamp - b.timestamp;
        });
    }, [recaps, searchQuery, sortBy, filterHost]);

    return (
        <div className="min-h-screen bg-[#121212] text-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#1C1C1C]/80 backdrop-blur-md border-b border-[#333]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/')}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-xl font-bold tracking-tight">Recaps Archive</h1>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/5">
                            {recaps.length} Total Meetings
                        </Badge>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
                {/* Search & Filter Bar */}
                <div className="flex flex-col md:flex-row gap-4 mb-10 items-center justify-between">
                    <div className="relative w-full max-w-md group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search meetings by title or host..."
                            className="pl-10 bg-[#1C1C1C] border-[#333] text-white focus-visible:ring-blue-500/50 h-11 rounded-xl"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="border-[#333] bg-[#1C1C1C] text-gray-400 hover:text-white flex-1 md:flex-none h-11 rounded-xl gap-2 min-w-[120px]">
                                    <ListFilter className="w-4 h-4" />
                                    <span>Sort: {sortBy === 'newest' ? 'Newest' : 'Oldest'}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#1C1C1C] border-[#333] text-white">
                                <DropdownMenuLabel>Sort by Date</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-[#333]" />
                                <DropdownMenuItem onClick={() => setSortBy('newest')} className="focus:bg-blue-600 focus:text-white">
                                    Newest First
                                    {sortBy === 'newest' && <Check className="ml-auto w-4 h-4" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSortBy('oldest')} className="focus:bg-blue-600 focus:text-white">
                                    Oldest First
                                    {sortBy === 'oldest' && <Check className="ml-auto w-4 h-4" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="border-[#333] bg-[#1C1C1C] text-gray-400 hover:text-white flex-1 md:flex-none h-11 rounded-xl gap-2 min-w-[120px]">
                                    <Filter className="w-4 h-4" />
                                    <span>Host: {filterHost === 'all' ? 'All' : filterHost}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#1C1C1C] border-[#333] text-white max-h-[300px] overflow-y-auto no-scrollbar">
                                <DropdownMenuLabel>Filter by Host</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-[#333]" />
                                {hosts.map(host => (
                                    <DropdownMenuItem key={host} onClick={() => setFilterHost(host)} className="focus:bg-blue-600 focus:text-white capitalize">
                                        {host}
                                        {filterHost === host && <Check className="ml-auto w-4 h-4" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Grid */}
                <div className="relative min-h-[400px]">
                    <AnimatePresence mode="popLayout">
                        {filteredAndSortedRecaps.length > 0 ? (
                            <motion.div
                                key="grid"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            >
                                {filteredAndSortedRecaps.map((recap, i) => (
                                    <motion.div
                                        key={recap.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: i * 0.05 }}
                                        onClick={() => navigate(`/recap/${recap.id}`)}
                                        className="group cursor-pointer bg-[#1C1C1C] border border-[#333] rounded-2xl p-5 hover:border-blue-500/50 hover:bg-blue-500/[0.02] transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <Badge variant="secondary" className="bg-[#2A2A2A] text-gray-400 border-[#404040] text-[10px] uppercase tracking-wider">
                                                Recap
                                            </Badge>
                                        </div>
                                        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                                            {recap.title}
                                        </h3>
                                        <div className="flex items-center gap-3 text-sm text-gray-500">
                                            <span className="flex items-center gap-1.5 line-clamp-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {recap.date}
                                            </span>
                                            {recap.time && (
                                                <span className="flex items-center gap-1.5 line-clamp-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {recap.time}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1.5 line-clamp-1">
                                                <Users className="w-3.5 h-3.5" />
                                                {recap.host}
                                            </span>
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-[#333] flex items-center justify-between text-blue-400 font-medium">
                                            <span className="text-xs">View Details</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="text-center py-20 border-2 border-dashed border-[#333] rounded-3xl"
                            >
                                <div className="w-16 h-16 bg-[#1C1C1C] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#333]">
                                    <Search className="w-6 h-6 text-gray-500" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">No recaps found</h3>
                                <p className="text-gray-500">Try adjusting your search query or filters.</p>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setFilterHost('all');
                                    }}
                                    className="mt-4 text-blue-400 hover:text-blue-300"
                                >
                                    Clear all filters
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
