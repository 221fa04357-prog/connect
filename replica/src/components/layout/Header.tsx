import { Clock, LogOut, Settings, HelpCircle, User2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui';
import { Video } from 'lucide-react';
import ProfileMenu from '../ProfileMenu/ProfileMenu';

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
      <div className="flex items-center gap-2 flex-shrink-0">
        <Video className="w-8 h-8 md:w-10 md:h-10 text-white" />
        <span className="text-2xl md:text-3xl font-bold text-white leading-none">NeuralChat</span>
      </div>


      <div className="flex items-center gap-4 md:gap-6 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs md:text-sm text-[#A3A3A3]">
          <Clock className="w-4 h-4" />
          <span>{(() => {
            const h = String(time.getHours()).padStart(2, '0');
            const m = String(time.getMinutes()).padStart(2, '0');
            const s = String(time.getSeconds()).padStart(2, '0');
            return `${h}:${m}:${s}`;
          })()}</span>
        </div>

        {user && (
          <ProfileMenu />
        )}
      </div>
    </header>
  );
};
