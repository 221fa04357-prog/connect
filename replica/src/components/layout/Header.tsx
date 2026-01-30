import { Clock, LogOut, Settings, HelpCircle, User2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Video } from 'lucide-react';

export const Header = ({ transparent = false }: { transparent?: boolean }) => {
  const [time, setTime] = useState(new Date());
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header
      className={
        `fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 h-16 md:h-20 ` +
        (transparent
          ? 'bg-transparent border-none'
          : 'bg-[#1C1C1C] border-b border-[#404040]')
      }
      style={{ minHeight: '4rem' }}
    >
      <div className="flex items-center gap-2">
        <Video className="w-8 h-8 md:w-10 md:h-10 text-white" />
        <span className="text-2xl md:text-3xl font-bold text-white leading-none">ConnectPro</span>
      </div>


      <div className="flex items-center gap-4 md:gap-6">
        <div className="flex items-center gap-2 text-xs md:text-sm text-[#A3A3A3]">
          <Clock className="w-4 h-4" />
          <span>{time.toLocaleTimeString()}</span>
        </div>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="pl-4 md:pl-6 border-l border-[#404040] flex items-center bg-transparent outline-none focus:ring-2 focus:ring-[#0B5CFF]">
                <Avatar className="w-9 h-9 md:w-11 md:h-11">
                  <AvatarFallback className="bg-[#0B5CFF] text-white font-semibold text-lg md:text-xl">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col items-start gap-0.5">
                <span className="font-semibold text-base flex items-center gap-2"><User2 className="w-4 h-4" /> {user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('', '_blank')}>
                <HelpCircle className="w-4 h-4 mr-2" /> Help
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};