import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Video, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';

// Custom SVG for browser-native exclamation in orange box
function NativeExclamationIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" style={{ minWidth: 20, minHeight: 20 }} aria-hidden="true">
            <rect x="2" y="2" width="16" height="16" rx="3" fill="#FFA500" stroke="#FFA500" strokeWidth="2" />
            <text x="10" y="15" textAnchor="middle" fontWeight="bold" fontSize="15" fill="white" fontFamily="Segoe UI,Arial,sans-serif">!</text>
        </svg>
    );
}

function getNativeStyleTooltip(msg: string) {
    return (
        <div className="pointer-events-none select-none z-50 bg-white text-black border border-gray-300 rounded shadow-md px-4 py-2 text-sm flex items-center gap-2 relative" style={{
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            minWidth: 180,
            maxWidth: 260,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}>
            <NativeExclamationIcon />
            <span>{msg}</span>
            <span className="absolute -top-2 left-4 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white" />
        </div>
    );
}

export function Login() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState({ email: '', password: '' });
    const [touched, setTouched] = useState({ email: false, password: false });

    function validate(field: string, value: string) {
        switch (field) {
            case 'email':
                if (!value) return 'Please fill out this field.';
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Please enter a valid email address.';
                return '';
            case 'password':
                if (!value) return 'Please fill out this field.';
                if (value.length < 8) return 'Password must be at least 8 characters.';
                return '';
            default:
                return '';
        }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setFormData(f => ({ ...f, [name]: value }));
        setErrors(errs => ({ ...errs, [name]: validate(name, value) }));
    }
    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
        const { name } = e.target;
        setTouched(t => ({ ...t, [name]: true }));
        setErrors(errs => ({ ...errs, [name]: validate(name, formData[name as keyof typeof formData]) }));
    }

    const isValid = !errors.email && !errors.password && formData.email && formData.password;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const newErrors = {
            email: validate('email', formData.email),
            password: validate('password', formData.password)
        };
        setErrors(newErrors);
        setTouched({ email: true, password: true });
        if (!newErrors.email && !newErrors.password) {
            // Mock login
            login({
                id: '1',
                name: 'Demo User',
                email: formData.email,
                role: 'host' // or another valid UserRole
            });
            navigate('/');
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0B5CFF] to-[#1C1C1C] flex items-center justify-center p-2 sm:p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl"
            >
                <div className="bg-[#232323] rounded-2xl shadow-2xl px-4 py-6 sm:px-8 sm:py-10">
                    <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8">
                        <Video className="w-8 h-8 sm:w-10 sm:h-10 text-[#0B5CFF]" />
                        <span className="text-xl sm:text-2xl font-bold text-white">ConnectPro</span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
                        Welcome Back
                    </h2>
                    <p className="text-gray-400 text-center mb-6 sm:mb-8 text-sm sm:text-base">
                        Sign in to your account to continue
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-white">Email Address</Label>
                            <div className="relative">
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                    className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500 text-sm sm:text-base"
                                />
                                {touched.email && errors.email && (
                                    <div className="absolute left-0 top-full mt-1 z-50">
                                        {getNativeStyleTooltip(errors.email)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-white">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                    className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500 pr-10 text-sm sm:text-base"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                                {touched.password && errors.password && (
                                    <div className="absolute left-0 top-full mt-1 z-50">
                                        {getNativeStyleTooltip(errors.password)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between text-xs sm:text-sm gap-2 sm:gap-0">
                            <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                                <input type="checkbox" className="rounded" />
                                Remember me
                            </label>
                            <button
                                type="button"
                                className="text-[#0B5CFF] hover:underline"
                                onClick={() => navigate('/reset-password')}
                            >
                                Forgot password?
                            </button>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white py-4 sm:py-6 text-base sm:text-lg"
                            disabled={!isValid}
                        >
                            Sign In
                        </Button>
                    </form>

                    <div className="mt-4 sm:mt-6 text-center text-gray-400 text-sm sm:text-base">
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

// Export both components as named exports. Import them as { Login } and { ResetPassword } in your router.
export function ResetPassword() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState({
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [touched, setTouched] = useState({
        email: false,
        password: false,
        confirmPassword: false
    });

    // Validation logic
    function validate(field: string, value: string) {
        switch (field) {
            case 'email':
                if (!value) return 'Email is required';
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Invalid email';
                return '';
            case 'password':
                if (!value) return 'Password is required';
                if (value.length < 8) return 'Password must be at least 8 characters';
                return '';
            case 'confirmPassword':
                if (!value) return 'Please confirm your password';
                if (value !== form.password) return 'Passwords do not match';
                return '';
            default:
                return '';
        }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
        setErrors(errs => ({ ...errs, [name]: validate(name, value) }));
    }

    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
        const { name } = e.target;
        setTouched(t => ({ ...t, [name]: true }));
        setErrors(errs => ({ ...errs, [name]: validate(name, form[name as keyof typeof form]) }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        // Validate all fields
        const newErrors = {
            email: validate('email', form.email),
            password: validate('password', form.password),
            confirmPassword: validate('confirmPassword', form.confirmPassword)
        };
        setErrors(newErrors);
        setTouched({ email: true, password: true, confirmPassword: true });
        if (!newErrors.email && !newErrors.password && !newErrors.confirmPassword) {
            // Submit to backend here later
            // For now, just navigate to login
            navigate('/login');
        }
    }

    const isValid = !errors.email && !errors.password && !errors.confirmPassword && form.email && form.password && form.confirmPassword;

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
                    <h2 className="text-2xl font-bold text-white text-center mb-2">Reset Password</h2>
                    <p className="text-gray-400 text-center mb-8">Enter your email and new password</p>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="reset-email" className="text-white">Email Address</Label>
                            <div className="relative">
                                <Input
                                    id="reset-email"
                                    name="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                    className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500"
                                />
                                {touched.email && errors.email && (
                                    <div className="absolute left-0 top-full mt-1 z-50">
                                        {getNativeStyleTooltip(errors.email)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reset-password" className="text-white">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="reset-password"
                                    name="password"
                                    type="password"
                                    placeholder="New password"
                                    value={form.password}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                    className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500"
                                />
                                {touched.password && errors.password && (
                                    <div className="absolute left-0 top-full mt-1 z-50">
                                        {getNativeStyleTooltip(errors.password)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reset-confirm" className="text-white">Confirm Password</Label>
                            <div className="relative">
                                <Input
                                    id="reset-confirm"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="Confirm password"
                                    value={form.confirmPassword}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                    className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500"
                                />
                                {touched.confirmPassword && errors.confirmPassword && (
                                    <div className="absolute left-0 top-full mt-1 z-50">
                                        {getNativeStyleTooltip(errors.confirmPassword)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white py-6 text-lg"
                            disabled={!isValid}
                        >
                            Reset Password
                        </Button>
                        <div className="mt-4 text-center">
                            <button type="button" className="text-[#0B5CFF] hover:underline font-semibold" onClick={() => navigate('/login')}>
                                Back to Sign In
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}

export function Register() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
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
                                <p className={cn('text-sm mt-2', passwordStrength.color)}>
                                    {passwordStrength.text}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-white">
                                Confirm Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    required
                                    className="bg-[#1C1C1C] border-[#404040] text-white placeholder:text-gray-500 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
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
