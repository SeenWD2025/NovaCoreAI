import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CreditCard, 
  Check, 
  Zap, 
  Crown, 
  Star,
  ArrowRight,
  AlertCircle 
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { ButtonLoading } from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';

interface PricingTier {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
  stripePriceId?: string;
  limits: {
    tokens: number;
    storage: string;
    support: string;
  };
}

const pricingTiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    interval: 'month',
    features: [
      '10,000 tokens per day',
      '100MB memory storage',
      'Basic AI assistance',
      'Community support',
      '7-day trial period'
    ],
    limits: {
      tokens: 10000,
      storage: '100MB',
      support: 'Community'
    }
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 19,
    interval: 'month',
    stripePriceId: 'price_basic_monthly',
    popular: true,
    features: [
      '100,000 tokens per day',
      '1GB memory storage',
      'Advanced AI features',
      'Email support',
      'Study analytics',
      'Custom note organization'
    ],
    limits: {
      tokens: 100000,
      storage: '1GB',
      support: 'Email'
    }
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 49,
    interval: 'month',
    stripePriceId: 'price_pro_monthly',
    features: [
      'Unlimited tokens',
      '10GB memory storage',
      'Premium AI models',
      'Priority support',
      'Advanced analytics',
      'API access',
      'Custom integrations'
    ],
    limits: {
      tokens: -1, // unlimited
      storage: '10GB',
      support: 'Priority'
    }
  }
];

export default function Billing() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSubscribe = async (tier: PricingTier) => {
    if (tier.id === 'free') {
      toast.info('You are already on the free trial');
      return;
    }

    setIsLoading(true);
    setSelectedTier(tier.id);

    try {
      // Create Stripe checkout session
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          priceId: tier.stripePriceId,
          mode: 'subscription'
        })
      });

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Failed to start subscription process');
    } finally {
      setIsLoading(false);
      setSelectedTier(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/billing/manage-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No management URL received');
      }
    } catch (error) {
      console.error('Manage subscription error:', error);
      toast.error('Failed to open subscription management');
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentTier = () => {
    if (!user) return 'free';
    return user.subscription_tier || 'free_trial';
  };

  const isCurrentTier = (tierId: string) => {
    const currentTier = getCurrentTier();
    return currentTier === tierId || (currentTier === 'free_trial' && tierId === 'free');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Unlock the full potential of AI-powered learning with our flexible pricing options.
          Start with a free trial and upgrade when you're ready.
        </p>
      </div>

      {/* Current Subscription Info */}
      {user && (
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Current Plan: {getCurrentTier().replace('_', ' ').toUpperCase()}
              </h3>
              <p className="text-sm text-gray-600">
                {user.trial_ends_at && (
                  <>Trial ends: {new Date(user.trial_ends_at).toLocaleDateString()}</>
                )}
              </p>
            </div>
            
            {getCurrentTier() !== 'free' && getCurrentTier() !== 'free_trial' && (
              <button
                onClick={handleManageSubscription}
                disabled={isLoading}
                className="btn-outline flex items-center gap-2"
              >
                {isLoading ? <ButtonLoading /> : <CreditCard size={16} />}
                Manage Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {pricingTiers.map((tier) => {
          const isCurrent = isCurrentTier(tier.id);
          const isPopular = tier.popular;
          
          return (
            <div
              key={tier.id}
              className={`relative card transition-all duration-300 hover:shadow-xl ${
                isPopular ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' : ''
              } ${isCurrent ? 'bg-green-50 border-green-300' : ''}`}
            >
              {/* Popular badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <Star size={14} />
                    Most Popular
                  </div>
                </div>
              )}

              {/* Current plan badge */}
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <Check size={14} />
                    Current
                  </div>
                </div>
              )}

              <div className="p-8">
                {/* Tier info */}
                <div className="text-center mb-8">
                  <div className="mb-4">
                    {tier.id === 'free' && <Zap size={40} className="mx-auto text-gray-600" />}
                    {tier.id === 'basic' && <Crown size={40} className="mx-auto text-blue-600" />}
                    {tier.id === 'pro' && <Star size={40} className="mx-auto text-purple-600" />}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {tier.name}
                  </h3>
                  
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">
                      ${tier.price}
                    </span>
                    <span className="text-gray-600">/{tier.interval}</span>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{tier.limits.tokens === -1 ? 'Unlimited' : tier.limits.tokens.toLocaleString()} tokens/day</p>
                    <p>{tier.limits.storage} storage</p>
                    <p>{tier.limits.support} support</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSubscribe(tier)}
                  disabled={isLoading || isCurrent}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium transition-colors ${
                    isCurrent
                      ? 'bg-green-100 text-green-800 cursor-not-allowed'
                      : tier.id === 'free'
                      ? 'btn-outline'
                      : 'btn-primary'
                  }`}
                >
                  {isLoading && selectedTier === tier.id ? (
                    <ButtonLoading />
                  ) : isCurrent ? (
                    <>
                      <Check size={16} />
                      Current Plan
                    </>
                  ) : tier.id === 'free' ? (
                    'Start Free Trial'
                  ) : (
                    <>
                      Get Started
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div className="card">
        <h3 className="text-xl font-bold text-gray-900 mb-6">
          Frequently Asked Questions
        </h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">
              Can I change my plan anytime?
            </h4>
            <p className="text-sm text-gray-600">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately for upgrades.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-1">
              What happens when I reach my token limit?
            </h4>
            <p className="text-sm text-gray-600">
              When you reach your daily token limit, AI features will be temporarily unavailable until the next day or you can upgrade your plan.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-1">
              Is there a refund policy?
            </h4>
            <p className="text-sm text-gray-600">
              We offer a 30-day money-back guarantee for all paid plans. Contact support for refund requests.
            </p>
          </div>
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <AlertCircle size={16} />
        <span>Secure payments powered by Stripe. Cancel anytime.</span>
      </div>
    </div>
  );
}