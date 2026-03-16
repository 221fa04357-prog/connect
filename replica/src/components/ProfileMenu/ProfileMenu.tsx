import {
    Settings, HelpCircle, LogOut, MapPin, CheckCircle2, 
    Circle, Clock, Plus, ArrowUpCircle, X, Loader2, User2
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { User } from '@/types';
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
    const accounts = useAuthStore((state) => state.accounts);
    const switchAccount = useAuthStore((state) => state.switchAccount);
    const removeAccount = useAuthStore((state) => state.removeAccount);
    const logout = useAuthStore((state) => state.logout);
    const navigate = useNavigate();

    const [status, setStatus] = useState('available');
    const [workLocation, setWorkLocation] = useState('office');
    const [isSwitching, setIsSwitching] = useState(false);
    const [switchingTo, setSwitchingTo] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [targetEmail, setTargetEmail] = useState<string | null>(null);

    if (!user) return null;

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleSwitchAccount = (acc: User) => {
        const email = acc.email;
        // ONLY redirect to login if the account was explicitly logged out
        if (acc.isLoggedOut === true) {
            navigate('/login', { state: { email } });
            return;
        }

        setTargetEmail(email);
        setShowConfirm(true);
    };

    const confirmSwitch = () => {
        if (!targetEmail) return;
        setShowConfirm(false);
        const email = targetEmail;
        
        setSwitchingTo(email);
        setIsSwitching(true);
        
        // Simulate a smooth loading experience for 1.5 seconds
        setTimeout(() => {
            switchAccount(email);
            setIsSwitching(false);
            setSwitchingTo(null);
            // Full page reload
            window.location.reload();
        }, 1500);
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

            <DropdownMenuContent align="end" className="w-72 bg-[#1C1C1C] border-[#333] text-white shadow-xl p-0.5 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5">
                    <div className="relative">
                        <Avatar className="w-9 h-9">
                            <AvatarFallback className="bg-[#0B5CFF] text-white font-semibold text-sm">
                                {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute right-0 bottom-0 rounded-full bg-[#1C1C1C] p-[1px]">
                            {getStatusIcon()}
                        </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm truncate leading-none">{user.name}</span>
                        <span className="text-[10px] text-gray-400 truncate mt-0.5 leading-none">{user.email}</span>
                        <span className="text-[10px] text-blue-400 mt-1 leading-none cursor-pointer hover:underline capitalize">
                            {user.subscriptionPlan || user.subscription_plan || 'Basic'}
                        </span>
                    </div>
                </div>

                <DropdownMenuSeparator className="bg-[#333] my-0" />

                {/* Status Submenu */}
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="hover:bg-[#2A2A2A] h-8 px-3">
                        <div className="flex items-center gap-2.5">
                            {getStatusIcon()}
                            <span className="text-xs">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                        </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-[#1C1C1C] border-[#333] text-white">
                        <DropdownMenuRadioGroup value={status} onValueChange={setStatus}>
                            <DropdownMenuRadioItem value="available" className="hover:bg-[#2A2A2A] text-xs py-1">Available</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="away" className="hover:bg-[#2A2A2A] text-xs py-1">Away</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="dnd" className="hover:bg-[#2A2A2A] text-xs py-1">Do not disturb</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuItem className="hover:bg-[#2A2A2A] h-8 px-3 text-xs text-gray-300">
                    Set status message
                </DropdownMenuItem>

                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="hover:bg-[#2A2A2A] h-8 px-3">
                        <div className="flex items-center gap-2.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs">Work location</span>
                        </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-[#1C1C1C] border-[#333] text-white">
                        <DropdownMenuRadioGroup value={workLocation} onValueChange={setWorkLocation}>
                            <DropdownMenuRadioItem value="office" className="hover:bg-[#2A2A2A] text-xs py-1">Office</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="remote" className="hover:bg-[#2A2A2A] text-xs py-1">Remote</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator className="bg-[#333] my-0" />

                <DropdownMenuItem className="hover:bg-[#2A2A2A] h-8 px-3 text-xs" onClick={() => navigate('/profile')}>
                    My Profile
                </DropdownMenuItem>

                <DropdownMenuItem className="hover:bg-[#2A2A2A] h-8 px-3 text-xs" onClick={() => navigate('/upgrade')}>
                    <ArrowUpCircle className="w-3.5 h-3.5 mr-2 text-blue-400" />
                    <span className="text-blue-400 font-medium font-bold">Upgrade to {user.subscriptionPlan === 'pro' ? 'Enterprise' : 'Pro'}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-[#333] my-0" />

                <DropdownMenuItem className="hover:bg-[#2A2A2A] h-8 px-3 text-xs" onClick={() => navigate('/updates')}>
                    Check for Updates
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#2A2A2A] h-8 px-3 text-xs" onClick={() => navigate('/whats-new')}>
                    Discover What's New
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-[#333] my-0" />

                <DropdownMenuItem className="hover:bg-[#2A2A2A] h-8 px-3 text-xs" onClick={() => navigate('/settings')}>
                    <Settings className="w-3.5 h-3.5 mr-2" />
                    Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#2A2A2A] h-8 px-3 text-xs" onClick={() => navigate('/help')}>
                    <HelpCircle className="w-3.5 h-3.5 mr-2" />
                    Help
                </DropdownMenuItem>

                <DropdownMenuItem className="hover:bg-[#2A2A2A] h-8 px-3 text-xs" onClick={() => navigate('/add-account')}>
                    <Plus className="w-3.5 h-3.5 mr-2" />
                    Add another account
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-[#333] my-0" />

                {/* Other Accounts Section - Bottom Placement (Gmail Style) */}
                {accounts.filter(acc => acc.email?.toLowerCase() !== user.email?.toLowerCase()).length > 0 && (
                    <>
                        <div className="max-h-[120px] overflow-y-auto custom-scrollbar">
                            {/* De-duplicate by email just in case */}
                            {Array.from(new Map(accounts.filter(acc => acc.email?.toLowerCase() !== user.email?.toLowerCase()).map(acc => [acc.email?.toLowerCase(), acc])).values()).map((acc: User) => (
                                <DropdownMenuItem 
                                    key={acc.email} 
                                    className="hover:bg-[#2A2A2A] px-3 py-1.5 flex items-center justify-between gap-2.5 cursor-pointer group relative overflow-hidden"
                                    onClick={() => !isSwitching && handleSwitchAccount(acc)}
                                    disabled={isSwitching}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <Avatar className="w-7 h-7 shrink-0">
                                            <AvatarFallback className="bg-gray-700 text-white font-medium text-[8px]">
                                                {acc.name?.charAt(0).toUpperCase() || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] font-semibold truncate leading-tight">{acc.name}</span>
                                            <span className="text-[8px] text-gray-400 truncate leading-tight">{acc.email}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {acc.isLoggedOut && (
                                            <span className="text-[8px] text-blue-400 font-medium shrink-0">Sign in</span>
                                        )}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeAccount(acc.email);
                                            }}
                                            className="p-1 hover:bg-[#444] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3 text-gray-400 hover:text-red-400" />
                                        </button>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                        </div>
                        <DropdownMenuSeparator className="bg-[#333] my-0" />
                    </>
                )}

                <DropdownMenuItem 
                    onClick={() => {
                        logout();
                        navigate('/login');
                    }} 
                    className="hover:bg-[#2A2A2A] h-8 px-3 text-xs text-red-500 font-semibold"
                >
                    <LogOut className="w-3.5 h-3.5 mr-2" />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
            {/* Custom Centered Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1C1C1C] border border-[#333] rounded-xl shadow-2xl p-5 w-[90%] max-w-[320px] scale-in-center overflow-hidden">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <User2 className="w-6 h-6 text-blue-500" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-semibold text-white">Switch Account?</h3>
                                <p className="text-[11px] text-gray-400">
                                    Are you sure you want to switch to <span className="text-gray-200 font-medium">{targetEmail}</span>?
                                </p>
                            </div>
                            <div className="flex items-center gap-3 w-full mt-2">
                                <button 
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-[#2A2A2A] hover:bg-[#333] text-xs font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={confirmSwitch}
                                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                                >
                                    Switch
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Centered Loading State Overlay */}
            {isSwitching && (
                <div className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
                    <div className="bg-[#1C1C1C] border border-[#333] rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
                            <Loader2 className="w-6 h-6 text-blue-500 absolute inset-0 m-auto animate-pulse" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-white font-medium text-sm">Switching account...</p>
                            <p className="text-[10px] text-gray-400">Please wait a moment</p>
                        </div>
                    </div>
                </div>
            )}
        </DropdownMenu>
    );
}
