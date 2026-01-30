import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import { Login, Register, ResetPassword } from './pages/Auth';
import { JoinMeeting, CreateMeeting } from './pages/MeetingSetup';
import MeetingRoom from './pages/MeetingRoom';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import { useAuthStore } from './stores/useAuthStore';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Meeting Routes */}
          <Route path="/join-meeting" element={
            <ProtectedRoute>
              <JoinMeeting />
            </ProtectedRoute>
          } />
          <Route path="/create-meeting" element={
            <ProtectedRoute>
              <CreateMeeting />
            </ProtectedRoute>
          } />
          <Route path="/meeting" element={
            <ProtectedRoute>
              <MeetingRoom />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;