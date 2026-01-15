import React, { useState } from 'react';
import { Check, Zap, Crown, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';

export default function PricingPage() {
    const { user, backendUser } = useAuth();
    const [loading, setLoading] = useState(null); // 'pack' | 'sub' | null

    const handleCheckout = async (priceId, mode) => {
        if (!user) {
            alert("Please sign in to purchase.");
            return;
        }
        setLoading(mode);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/stripe/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ priceId })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert("Checkout failed: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            console.error(e);
            alert("Checkout error");
        } finally {
            setLoading(null);
        }
    };

    const isPro = backendUser?.subscriptionStatus === 'active';

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-5xl w-full">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-violet-200 to-white mb-4">
                        Upgrade Your Creativity
                    </h1>
                    <p className="text-gray-400 text-lg">Choose the plan that fits your creative needs.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">

                    {/* Free Tier */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col hover:border-white/20 transition-all">
                        <div className="mb-4">
                            <h3 className="text-xl font-semibold text-white">Free Starter</h3>
                            <div className="text-3xl font-bold mt-2">$0 <span className="text-sm font-normal text-gray-400">/ month</span></div>
                        </div>
                        <ul className="space-y-3 mb-8 flex-grow">
                            <li className="flex items-center gap-3 text-gray-300"><Check size={18} className="text-green-400" /> 5 Generations / month</li>
                            <li className="flex items-center gap-3 text-gray-300"><Check size={18} className="text-green-400" /> Standard Quality</li>
                            <li className="flex items-center gap-3 text-gray-300"><Check size={18} className="text-green-400" /> Public Gallery Access</li>
                        </ul>
                        <button disabled className="w-full py-3 rounded-xl bg-white/10 text-gray-400 font-medium cursor-default">
                            Current Plan
                        </button>
                    </div>

                    {/* Credit Pack */}
                    <div className="bg-white/5 border border-violet-500/30 rounded-2xl p-6 backdrop-blur-sm flex flex-col relative group hover:border-violet-500/60 transition-all">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            Popular
                        </div>
                        <div className="mb-4">
                            <h3 className="text-xl font-semibold text-white">Starter Pack</h3>
                            <div className="text-3xl font-bold mt-2">$1.99 <span className="text-sm font-normal text-gray-400">/ one-time</span></div>
                        </div>
                        <ul className="space-y-3 mb-8 flex-grow">
                            <li className="flex items-center gap-3 text-gray-300"><Zap size={18} className="text-yellow-400" /> 10 Extra Credits</li>
                            <li className="flex items-center gap-3 text-gray-300"><Check size={18} className="text-green-400" /> Never Expire</li>
                            <li className="flex items-center gap-3 text-gray-300"><Check size={18} className="text-green-400" /> High Priority Processing</li>
                        </ul>
                        <button
                            onClick={() => handleCheckout('price_1Spj37FYNUGeLOIpNpcEKcRj', 'pack')}
                            disabled={loading === 'pack'}
                            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold transition-all shadow-lg shadow-violet-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading === 'pack' ? <Loader2 className="animate-spin" /> : 'Buy 10 Credits'}
                        </button>
                    </div>

                    {/* Pro Subscription */}
                    <div className="bg-gradient-to-b from-violet-900/40 to-black/40 border border-violet-500/50 rounded-2xl p-6 backdrop-blur-md flex flex-col relative hover:scale-105 transition-transform duration-300 shadow-2xl shadow-black/50">
                        <div className="absolute inset-0 bg-violet-500/5 rounded-2xl pointer-events-none" />
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <Crown size={12} /> Ultimate
                        </div>
                        <div className="mb-4 relative">
                            <h3 className="text-xl font-semibold text-white">Pro Unlimited</h3>
                            <div className="text-3xl font-bold mt-2">$20 <span className="text-sm font-normal text-gray-400">/ month</span></div>
                        </div>
                        <ul className="space-y-3 mb-8 flex-grow relative">
                            <li className="flex items-center gap-3 text-white font-medium"><Check size={18} className="text-amber-400" /> Unlimited Generations</li>
                            <li className="flex items-center gap-3 text-gray-300"><Check size={18} className="text-amber-400" /> Priority Support</li>
                            <li className="flex items-center gap-3 text-gray-300"><Check size={18} className="text-amber-400" /> Early Access to New Styles</li>
                            <li className="flex items-center gap-3 text-gray-300"><Check size={18} className="text-amber-400" /> Private Gallery Mode</li>
                        </ul>
                        <button
                            onClick={() => handleCheckout('price_1Spj39FYNUGeLOIpFYcccsqI', 'sub')}
                            disabled={loading === 'sub' || isPro}
                            className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 relative z-10 
                                ${isPro
                                    ? 'bg-green-600/20 text-green-400 border border-green-500/50 cursor-default'
                                    : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black'
                                }`}
                        >
                            {loading === 'sub' ? <Loader2 className="animate-spin" /> : (isPro ? 'Active Plan' : 'Subscribe Now')}
                        </button>
                    </div>

                </div>

                <div className="mt-12 text-center text-gray-500 text-sm">
                    <p>Payments processed securely by Stripe. Cancel anytime.</p>
                </div>
            </div>
        </div>
    );
}
