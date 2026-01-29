import { Clock, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export const Header = () => {
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
    <header className="fixed top-0 left-0 right-0 h-14 bg-[#1C1C1C] border-b border-[#404040] z-50 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#0B5CFF] rounded-lg flex items-center justify-center font-bold text-white">
          CP
        </div>
        <span className="font-semibold text-white">ConnectPro</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-[#A3A3A3]">
          <Clock className="w-4 h-4" />
          <span>{time.toLocaleTimeString()}</span>
        </div>

        {user && (
          <div className="flex items-center gap-3 pl-6 border-l border-[#404040]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0B5CFF] flex items-center justify-center text-white font-semibold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-white hidden sm:block">
                <p className="text-xs font-semibold">{user.name}</p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="icon"
              className="hover:bg-[#404040] text-[#A3A3A3] hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};