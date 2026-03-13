import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Check, Zap, Shield, Clock, Users, Video, MessageSquare,
    Globe, HardDrive, Headphones, Star, ChevronDown, ChevronUp, Crown
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/useAuthStore';

const plans = [
    {
        id: 'free',
        name: 'Free',
        price: 0,
        priceTag: '₹0',
        period: '/mo',
        description: 'Perfect for individuals',
        badge: null,
        color: '#404040',
        gradient: 'from-[#2a2a2a] to-[#1a1a1a]',
        features: [
            '40 minute meeting limit',
            'Up to 100 participants',
            'Basic chat',
            'Screen sharing',
            '1 free cloud record',
        ],
        notIncluded: [
            'Cloud recording',
            'Whiteboard',
            'Live transcription',
            'Social streaming',
            'Priority support',
        ],
        cta: 'Current Plan',
        ctaDisabled: true,
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 999,
        priceTag: '₹999',
        period: '/mo',
        description: 'For small teams & creators',
        badge: 'Most Popular',
        color: '#0B5CFF',
        gradient: 'from-[#0B5CFF] to-[#052e80]',
        features: [
            'Unlimited meeting duration',
            'Up to 300 participants',
            'Cloud recording (10GB)',
            'AI notes & Transcription',
            'Live translation',
            'Custom branding',
            'Co-host capabilities',
            'Waiting room limits',
        ],
        notIncluded: [
            'Custom branding',
            'Dedicated support',
            'SSO & advanced security',
        ],
        cta: 'Upgrade to Pro',
        ctaDisabled: false,
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: null,
        priceTag: 'Custom',
        period: '',
        description: 'For large organizations',
        badge: 'Contact Sales',
        color: '#0B5CFF',
        gradient: 'from-[#0B5CFF] to-[#052e80]',
        features: [
            'Unlimited meeting',
            'Unlimited participants',
            'Unlimited cloud storage',
            'Advanced meeting analytics',
            'API & SDK integrations',
            'Dedicated account manager',
            'SSO / SAML',
            '24/7 phone support',
        ],
        notIncluded: [],
        cta: 'Contact Sales',
        ctaDisabled: false,
    },
];

const featureHighlights = [
    { icon: Clock, label: 'Unlimited Duration', desc: 'No 40-minute cutoffs. Run meetings as long as you need.' },
    { icon: Users, label: '500 Participants', desc: 'Host large team meetings, webinars, and town halls.' },
    { icon: Video, label: 'Cloud Recording', desc: '5 GB of secure cloud storage for all your recordings.' },
    { icon: Globe, label: 'Social Streaming', desc: 'Stream live to YouTube, Facebook, and more.' },
    { icon: MessageSquare, label: 'AI Transcription', desc: 'Auto-generated transcripts and meeting summaries.' },
    { icon: HardDrive, label: 'Whiteboard', desc: 'Real-time collaborative whiteboard for brainstorming.' },
    { icon: Shield, label: 'Advanced Security', desc: 'End-to-end encryption and meeting lock controls.' },
    { icon: Headphones, label: 'Priority Support', desc: 'Faster response times with dedicated email support.' },
];

const faqs = [
    {
        q: 'Can I cancel my subscription anytime?',
        a: 'Yes! You can cancel your Pro subscription at any time. Your plan will remain active until the end of the billing period.',
    },
    {
        q: 'Is there a free trial for Pro?',
        a: 'We offer a 14-day free trial for Pro. No credit card required to start.',
    },
    {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit/debit cards, UPI, net banking, and wallet payments via Razorpay.',
    },
    {
        q: 'Will I lose my data if I downgrade?',
        a: 'Your recordings and data are retained for 30 days after downgrading, giving you time to export them.',
    },
    {
        q: 'Do you offer discounts for NGOs or educational institutions?',
        a: 'Yes! We offer up to 50% discount for verified NGOs and educational institutions. Contact our sales team.',
    },
];

export default function Upgrade() {
    const navigate = useNavigate();
    const { user, setSubscription } = useAuthStore();
    const currentPlan = user?.subscriptionPlan || 'free';
    const [billingAnnual, setBillingAnnual] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [loading, setLoading] = useState<string | null>(null);

    const handleUpgrade = async (planId: string) => {
        if (planId === 'free' || planId === currentPlan) return;
        if (planId === 'enterprise') {
            navigate('/contact');
            return;
        }
        setLoading(planId);
        // Simulate payment navigation
        setTimeout(() => {
            setLoading(null);
            if (planId === 'pro') {
                navigate('/payment');
            } else {
                navigate('/contact');
            }
        }, 1200);
    };

    const getDiscountedPrice = (price: number | null) => {
        if (price === null) return null;
        if (billingAnnual) return Math.round(price * 12 * 0.8); // 20% annual discount
        return price;
    };

    return (
        <div className="min-h-screen bg-[#111111] text-white">
            {/* Ambient background glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full bg-[#0B5CFF]/10 blur-[120px]" />
                <div className="absolute bottom-[-200px] right-[-200px] w-[500px] h-[500px] rounded-full bg-[#0B5CFF]/10 blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 md:py-12">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-12">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Upgrade Your Plan</h1>
                        <p className="text-gray-400 mt-1">Unlock the full power of NeuralChat</p>
                    </div>
                </motion.div>

                {/* Billing Toggle */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex justify-center mb-10">
                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-1.5">
                        <button
                            onClick={() => setBillingAnnual(false)}
                            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${!billingAnnual ? 'bg-[#0B5CFF] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingAnnual(true)}
                            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${billingAnnual ? 'bg-[#0B5CFF] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Annual
                            <span className="bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">-20%</span>
                        </button>
                    </div>
                </motion.div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
                    {plans.map((plan, i) => {
                        const discountedPrice = getDiscountedPrice(plan.price);
                        const isCurrentPlan = plan.id === currentPlan;
                        const isPopular = plan.badge === 'Most Popular';

                        return (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + i * 0.1 }}
                                className={`relative rounded-2xl border overflow-hidden flex flex-col transition-transform hover:-translate-y-1 duration-300 ${isPopular
                                    ? 'border-[#0B5CFF] shadow-[0_0_40px_rgba(11,92,255,0.25)]'
                                    : 'border-white/10'
                                    }`}
                            >
                                {/* Plan gradient header */}
                                <div className={`bg-gradient-to-br ${plan.gradient} p-6`}>
                                    {plan.badge && (
                                        <div className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4 ${isPopular ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'
                                            }`}>
                                            {isPopular && <Star className="w-3 h-3 fill-current" />}
                                            {plan.badge}
                                        </div>
                                    )}
                                    <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                                    <p className="text-white/70 text-sm mb-4">{plan.description}</p>
                                    <div className="flex items-end gap-1">
                                        <span className="text-4xl font-extrabold">
                                            {plan.price === null ? 'Custom' : billingAnnual && plan.price > 0
                                                ? `₹${discountedPrice}`
                                                : plan.priceTag}
                                        </span>
                                        {plan.price !== null && plan.price > 0 && (
                                            <span className="text-white/60 text-sm mb-1">
                                                {billingAnnual ? '/yr' : plan.period}
                                            </span>
                                        )}
                                    </div>
                                    {billingAnnual && plan.price !== null && plan.price > 0 && (
                                        <p className="text-white/50 text-xs mt-1 line-through">₹{plan.price * 12}/yr</p>
                                    )}
                                </div>

                                {/* Features */}
                                <div className="bg-[#1a1a1a] p-6 flex flex-col flex-1">
                                    <ul className="space-y-3 mb-6 flex-1">
                                        {plan.features.map((f) => (
                                            <li key={f} className="flex items-start gap-2 text-sm text-gray-200">
                                                <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 text-[#0B5CFF]`} />
                                                {f}
                                            </li>
                                        ))}
                                        {plan.notIncluded.map((f) => (
                                            <li key={f} className="flex items-start gap-2 text-sm text-gray-600 line-through">
                                                <div className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-full border border-gray-700 flex items-center justify-center">
                                                    <div className="w-1.5 h-0.5 bg-gray-700 rounded" />
                                                </div>
                                                {f}
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        onClick={() => handleUpgrade(plan.id)}
                                        disabled={loading === plan.id || plan.ctaDisabled}
                                        className={`w-full h-11 font-semibold rounded-xl transition-all ${isCurrentPlan
                                            ? 'bg-[#0B5CFF] text-white cursor-default shadow-lg shadow-blue-500/25'
                                            : plan.id === 'enterprise'
                                                ? 'bg-[#0B5CFF] hover:bg-[#0948c7] text-white'
                                                : 'bg-[#0B5CFF] hover:bg-[#0948c7] text-white shadow-lg shadow-blue-500/25'
                                            }`}
                                    >
                                        {loading === plan.id ? (
                                            <span className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                Processing...
                                            </span>
                                        ) : isCurrentPlan ? (
                                            <span className="flex items-center gap-2">
                                                <Crown className="w-4 h-4" />
                                                Current Plan
                                            </span>
                                        ) : (
                                            plan.cta
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Feature Highlights Grid */}
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-20">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl md:text-3xl font-bold mb-3">Everything in Pro, explained</h2>
                        <p className="text-gray-400">Here's what you unlock when you upgrade</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {featureHighlights.map((item, i) => (
                            <motion.div
                                key={item.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + i * 0.05 }}
                                className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#0B5CFF]/50 hover:bg-white/8 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-[#0B5CFF]/10 flex items-center justify-center mb-3 group-hover:bg-[#0B5CFF]/20 transition-colors">
                                    <item.icon className="w-5 h-5 text-[#0B5CFF]" />
                                </div>
                                <h3 className="font-semibold text-sm mb-1">{item.label}</h3>
                                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Payment Info Banner */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mb-20">
                    <div className="rounded-2xl border border-[#0B5CFF]/30 bg-[#0B5CFF]/5 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-5 h-5 text-[#0B5CFF]" />
                                <h3 className="font-bold text-lg">Secure Payment</h3>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                All payments are processed securely via <strong className="text-white">Razorpay</strong>. We accept UPI, Credit/Debit cards, Net Banking, and Wallets.
                                Your data is protected with 256-bit SSL encryption.
                            </p>
                        </div>
                        <div className="flex gap-3 flex-wrap justify-center">
                            {['UPI', 'Visa', 'Mastercard', 'PayTM', 'GPay'].map((method) => (
                                <div key={method} className="px-4 py-2 bg-white/10 rounded-xl text-sm font-mono font-bold text-gray-300 border border-white/10">
                                    {method}
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* FAQ */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mb-20">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl md:text-3xl font-bold mb-3">Frequently Asked Questions</h2>
                        <p className="text-gray-400">Everything you need to know about billing</p>
                    </div>
                    <div className="max-w-3xl mx-auto space-y-3">
                        {faqs.map((faq, i) => (
                            <div
                                key={i}
                                className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
                            >
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                                >
                                    <span className="font-medium text-sm md:text-base">{faq.q}</span>
                                    {openFaq === i ? (
                                        <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    )}
                                </button>
                                {openFaq === i && (
                                    <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed border-t border-white/10 pt-4">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Bottom CTA */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="text-center">
                    <div className="inline-block rounded-2xl bg-gradient-to-br from-[#0B5CFF] to-[#052e80] p-px">
                        <div className="rounded-2xl bg-[#0d1a3a] px-8 py-8 md:py-10">
                            <Zap className="w-10 h-10 text-[#0B5CFF] mx-auto mb-4" fill="currentColor" />
                            <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to upgrade?</h2>
                            <p className="text-gray-400 mb-6 max-w-md mx-auto text-sm">
                                Join thousands of teams already using NeuralChat.
                                Start your 14-day free trial today — no credit card required.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Button
                                    onClick={() => handleUpgrade('pro')}
                                    className="bg-[#0B5CFF] hover:bg-[#0948c7] text-white px-8 h-12 rounded-xl font-semibold shadow-lg shadow-blue-500/30"
                                >
                                    Start Free Trial
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => navigate(-1)}
                                    className="text-gray-400 hover:text-white h-12 px-8 rounded-xl"
                                >
                                    Maybe Later
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
