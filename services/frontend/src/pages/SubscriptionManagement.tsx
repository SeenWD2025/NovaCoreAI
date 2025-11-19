import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Download, 
  Calendar,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { PageLoading } from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';

interface Subscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  plan: {
    name: string;
    amount: number;
    interval: string;
  };
  cancel_at_period_end: boolean;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  status: 'paid' | 'open' | 'void' | 'draft';
  created: string;
  invoice_pdf?: string;
  description?: string;
}

export default function SubscriptionManagement() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      
      const [subResponse, invoicesResponse] = await Promise.all([
        fetch('/api/billing/subscription', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }),
        fetch('/api/billing/invoices', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        })
      ]);

      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData);
      }

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        setInvoices(invoicesData.invoices || []);
      }
    } catch (error) {
      console.error('Failed to load subscription data:', error);
      toast.error('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? This will take effect at the end of your current billing period.')) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch('/api/billing/cancel-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        toast.success('Subscription scheduled for cancellation');
        await loadSubscriptionData();
      } else {
        throw new Error('Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setActionLoading(true);
      const response = await fetch('/api/billing/reactivate-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        toast.success('Subscription reactivated');
        await loadSubscriptionData();
      } else {
        throw new Error('Failed to reactivate subscription');
      }
    } catch (error) {
      console.error('Reactivation error:', error);
      toast.error('Failed to reactivate subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'text-green-700 bg-green-100';
      case 'past_due':
        return 'text-yellow-700 bg-yellow-100';
      case 'canceled':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  if (loading) {
    return <PageLoading text="Loading subscription details..." />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
        <p className="text-gray-600 mt-2">Manage your subscription and billing information</p>
      </div>

      {/* Current Subscription */}
      {subscription ? (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Current Subscription</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Plan Details</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Plan:</span>
                  <span className="font-medium">{subscription.plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price:</span>
                  <span className="font-medium">
                    ${subscription.plan.amount / 100} / {subscription.plan.interval}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Billing Period</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Current period:</span>
                  <span className="font-medium">
                    {new Date(subscription.current_period_start).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Next billing:</span>
                  <span className="font-medium">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {subscription.cancel_at_period_end && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  Your subscription is scheduled to cancel on{' '}
                  <strong>{new Date(subscription.current_period_end).toLocaleDateString()}</strong>.
                  You'll continue to have access until then.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            {subscription.cancel_at_period_end ? (
              <button
                onClick={handleReactivateSubscription}
                disabled={actionLoading}
                className="btn-primary flex items-center gap-2"
              >
                <CheckCircle size={16} />
                Reactivate Subscription
              </button>
            ) : (
              <button
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="btn-outline text-red-600 border-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                Cancel Subscription
              </button>
            )}
            
            <a
              href="/billing"
              className="btn-outline flex items-center gap-2"
            >
              <ExternalLink size={16} />
              Change Plan
            </a>
          </div>
        </div>
      ) : (
        <div className="card text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">No Active Subscription</h2>
          <p className="text-gray-600 mb-6">
            You don't have an active subscription. Choose a plan to get started.
          </p>
          <a href="/billing" className="btn-primary inline-flex items-center gap-2">
            <CreditCard size={16} />
            View Plans
          </a>
        </div>
      )}

      {/* Billing History */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Billing History</h2>

        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invoice.created).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${(invoice.amount / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.invoice_pdf && (
                        <a
                          href={invoice.invoice_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Download size={14} />
                          Download
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}