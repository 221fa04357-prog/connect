import {
    User2, Settings, HelpCircle, LogOut, Download, AlertCircle,
    MapPin, CheckCircle2, Circle, Clock, Plus, ArrowUpCircle
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from '@/components/ui';
import { useState } from 'react';

export default function ProfileMenu() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const navigate = useNavigate();

    const [status, setStatus] = useState('available');
    const [workLocation, setWorkLocation] = useState('office');

    if (!user) return null;

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'available': return <CheckCircle2 className="w-3 h-3 text-green-500 fill-green-500" />;
            case 'away': return <Clock className="w-3 h-3 text-yellow-500 fill-yellow-500" />;
            case 'dnd': return <Circle className="w-3 h-3 text-red-500 fill-red-500" />;
            default: return <Circle className="w-3 h-3 text-gray-500" />;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="relative pl-4 md:pl-6 border-l border-[#404040] flex items-center bg-transparent outline-none focus:ring-none">
                    <Avatar className="w-9 h-9 md:w-11 md:h-11 border-2 border-transparent hover:border-[#0B5CFF] transition-all">
                        <AvatarFallback className="bg-[#0B5CFF] text-white font-semibold text-lg md:text-xl">
                            {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute right-[-4px] bottom-0 rounded-full bg-[#1C1C1C] p-[2px]">
                        {getStatusIcon()}
                    </div>
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-72 bg-[#1C1C1C] border-[#333] text-white shadow-xl">
                <div className="flex items-center gap-3 p-3">
                    <div className="relative">
                        <Avatar className="w-12 h-12">
                            <AvatarFallback className="bg-[#0B5CFF] text-white font-semibold text-xl">
                                {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute right-0 bottom-0 rounded-full bg-[#1C1C1C] p-[2px]">
                            {getStatusIcon()}
                        </div>
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="font-bold text-base truncate">{user.name}</span>
                        <span className="text-xs text-gray-400 truncate">{user.email}</span>
                        <span className="text-xs text-blue-400 mt-0.5 cursor-pointer hover:underline">Basic</span>
                    </div>
                </div>

                <DropdownMenuSeparator className="bg-[#333]" />

                {/* Status Submenu */}
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]">
                        <div className="flex items-center gap-2">
                            {getStatusIcon()}
                            <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                        </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-[#1C1C1C] border-[#333] text-white">
                        <DropdownMenuRadioGroup value={status} onValueChange={setStatus}>
                            <DropdownMenuRadioItem value="available" className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]">
                                <CheckCircle2 className="w-4 h-4 text-green-500 fill-green-500 mr-2" />
                                Available
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="away" className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]">
                                <Clock className="w-4 h-4 text-yellow-500 fill-yellow-500 mr-2" />
                                Away
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="dnd" className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]">
                                <Circle className="w-4 h-4 text-red-500 fill-red-500 mr-2" />
                                Do not disturb
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuItem className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A] text-gray-300">
                    Set status message
                </DropdownMenuItem>

                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>Set work location</span>
                        </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-[#1C1C1C] border-[#333] text-white">
                        <DropdownMenuRadioGroup value={workLocation} onValueChange={setWorkLocation}>
                            <DropdownMenuRadioItem value="office" className="hover:bg-[#2A2A2A]">Office</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="remote" className="hover:bg-[#2A2A2A]">Remote</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator className="bg-[#333]" />

                <DropdownMenuItem className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]">
                    My Profile
                </DropdownMenuItem>

                <DropdownMenuItem className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]" onClick={() => navigate('/upgrade')}>
                    <ArrowUpCircle className="w-4 h-4 mr-2 text-blue-400" />
                    <span className="text-blue-400">Upgrade to Pro</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-[#333]" />

                <DropdownMenuItem className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]" onClick={() => navigate('/updates')}>
                    Check for Updates
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]" onClick={() => navigate('/whats-new')}>
                    Discover What's New
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-[#333]" />

                <DropdownMenuItem className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]" onClick={() => navigate('/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]" onClick={() => navigate('/help')}>
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Help
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-[#333]" />

                <DropdownMenuItem className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A]" onClick={() => navigate('/add-account')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleLogout} className="hover:bg-[#2A2A2A] focus:bg-[#2A2A2A] focus:text-white text-white">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
