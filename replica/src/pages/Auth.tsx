import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Video, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';

export function Login() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Mock login
        login({
            id: '1',
            name: 'Demo User',
            email: formData.email
        });
        navigate('/');
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0B5CFF] to-[#1C1C1C] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="bg-[#232323] rounded-2xl shadow-2xl p-8">
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <Video className="w-10 h-10 text-[#0B5CFF]" />
                        <span className="text-2xl font-bold text-white">ConnectPro</span>
                    </div>

                    <h2 className="text-2xl font-bold text-white text-center mb-2">
                        Welcome Back
                    </h2>
                    <p className="text-gray-400 text-center mb-8">
                        Sign in to your account to continue
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-white">
                                Email Address
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-white">
                                Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                                <input type="checkbox" className="rounded" />
                                Remember me
                            </label>
                            <a href="#" className="text-[#0B5CFF] hover:underline">
                                Forgot password?
                            </a>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white py-6 text-lg"
                        >
                            Sign In
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-gray-400">
                        Don't have an account?{' '}
                        <button
                            onClick={() => navigate('/register')}
                            className="text-[#0B5CFF] hover:underline font-semibold"
                        >
                            Sign up
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export function Register() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const passwordStrength = calculatePasswordStrength(formData.password);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        // Account created successfully, redirect to login
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0B5CFF] to-[#1C1C1C] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="bg-[#232323] rounded-2xl shadow-2xl p-8">
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <Video className="w-10 h-10 text-[#0B5CFF]" />
                        <span className="text-2xl font-bold text-white">ConnectPro</span>
                    </div>

                    <h2 className="text-2xl font-bold text-white text-center mb-2">
                        Create Account
                    </h2>
                    <p className="text-gray-400 text-center mb-8">
                        Sign up to start your meetings
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-white">
                                Full Name
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-white">
                                Email Address
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-white">
                                Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>

                            {formData.password && (
                                <div className="space-y-2">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4].map((level) => (
                                            <div
                                                key={level}
                                                className={cn(
                                                    'h-1 flex-1 rounded-full transition-colors',
                                                    level <= passwordStrength.level
                                                        ? passwordStrength.color
                                                        : 'bg-gray-600'
                                                )}
                                            />
                                        ))}
                                    </div>
                                    <p className={cn('text-sm', passwordStrength.color)}>
                                        {passwordStrength.text}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-white">
                                Confirm Password
                            </Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                required
                                className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500"
                            />
                        </div>

                        <label className="flex items-start gap-2 text-sm text-gray-400 cursor-pointer">
                            <input type="checkbox" required className="mt-1 rounded" />
                            <span>
                                I agree to the{' '}
                                <a href="#" className="text-[#0B5CFF] hover:underline">
                                    Terms of Service
                                </a>{' '}
                                and{' '}
                                <a href="#" className="text-[#0B5CFF] hover:underline">
                                    Privacy Policy
                                </a>
                            </span>
                        </label>

                        <Button
                            type="submit"
                            className="w-full bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white py-6 text-lg"
                        >
                            Create Account
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-gray-400">
                        Already have an account?{' '}
                        <button
                            onClick={() => navigate('/login')}
                            className="text-[#0B5CFF] hover:underline font-semibold"
                        >
                            Sign in
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function calculatePasswordStrength(password: string) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    if (strength <= 1) return { level: 1, text: 'Weak', color: 'text-red-500 bg-red-500' };
    if (strength === 2) return { level: 2, text: 'Fair', color: 'text-orange-500 bg-orange-500' };
    if (strength === 3) return { level: 3, text: 'Good', color: 'text-yellow-500 bg-yellow-500' };
    return { level: 4, text: 'Strong', color: 'text-green-500 bg-green-500' };
}
