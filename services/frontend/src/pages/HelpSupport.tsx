import { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  MessageCircle, 
  FileText, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Mail,
  Phone,
  Send
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ErrorBoundary from '@/components/ErrorBoundary';
import Alert from '@/components/Alert';
import { ButtonLoading } from '@/components/LoadingSpinner';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  category: z.enum(['general', 'technical', 'billing', 'feature', 'bug']),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  {
    id: '1',
    category: 'Getting Started',
    question: 'How do I get started with NovaCore AI?',
    answer: 'After signing up, you can start with our onboarding tutorial. Begin with Level 1 lessons and progress through our structured curriculum. The AI assistant is always available to help guide your learning journey.'
  },
  {
    id: '2',
    category: 'Learning',
    question: 'How does the learning progress system work?',
    answer: 'You earn XP by completing lessons, challenges, and reflections. As you accumulate XP, you level up and unlock new content. The memory system (STM, ITM, LTM) helps personalize your learning experience based on your interactions.'
  },
  {
    id: '3',
    category: 'Billing',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) through Stripe. You can manage your subscription and payment methods in your billing dashboard.'
  },
  {
    id: '4',
    category: 'Features',
    question: 'Can I use the AI chat offline?',
    answer: 'The AI chat requires an internet connection to function. However, you can view downloaded lesson content and your notes offline. We\'re working on expanded offline capabilities.'
  },
  {
    id: '5',
    category: 'Technical',
    question: 'What browsers are supported?',
    answer: 'NovaCore AI works best on modern browsers including Chrome 90+, Firefox 88+, Safari 14+, and Edge 90+. We recommend keeping your browser updated for the best experience.'
  },
  {
    id: '6',
    category: 'Account',
    question: 'How do I reset my password?',
    answer: 'Click "Forgot Password" on the login page, enter your email, and we\'ll send you a reset link. The link is valid for 1 hour for security purposes.'
  },
  {
    id: '7',
    category: 'Billing',
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel your subscription at any time from your billing dashboard. You\'ll continue to have access until the end of your current billing period.'
  },
  {
    id: '8',
    category: 'Features',
    question: 'How does the memory system work?',
    answer: 'The memory system stores your interactions in three tiers: Short-term (STM) for immediate context, Intermediate-term (ITM) for recent patterns, and Long-term (LTM) for important knowledge. This helps provide personalized responses.'
  }
];

export default function HelpSupport() {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showContactForm, setShowContactForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const categories = ['all', ...Array.from(new Set(faqData.map(item => item.category)))];

  const filteredFAQ = faqData.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to submit support request');

      setSubmitSuccess(true);
      setShowContactForm(false);
      reset();
    } catch (error) {
      console.error('Failed to submit support request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-3">
            <HelpCircle size={40} className="text-primary-800" />
            Help & Support
          </h1>
          <p className="text-lg text-gray-600">
            Find answers to common questions or get in touch with our team
          </p>
        </div>

        {submitSuccess && (
          <Alert type="success" onDismiss={() => setSubmitSuccess(false)}>
            Your support request has been submitted successfully. We'll get back to you within 24 hours.
          </Alert>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
            className="card hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setShowContactForm(true)}
          >
            <div className="text-center">
              <MessageCircle size={48} className="mx-auto text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Contact Support</h3>
              <p className="text-gray-600 text-sm">
                Get personalized help from our support team
              </p>
            </div>
          </div>

          <div className="card hover:shadow-lg transition-shadow cursor-pointer">
            <div className="text-center">
              <FileText size={48} className="mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Documentation</h3>
              <p className="text-gray-600 text-sm">
                Detailed guides and API documentation
              </p>
              <div className="mt-3">
                <ExternalLink size={16} className="inline" />
              </div>
            </div>
          </div>

          <div className="card hover:shadow-lg transition-shadow cursor-pointer">
            <div className="text-center">
              <MessageCircle size={48} className="mx-auto text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Community</h3>
              <p className="text-gray-600 text-sm">
                Join discussions with other learners
              </p>
              <div className="mt-3">
                <ExternalLink size={16} className="inline" />
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Search and Filter */}
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search FAQ..."
                  className="input pl-12"
                />
              </div>
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>

          {/* FAQ Items */}
          <div className="space-y-4">
            {filteredFAQ.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === item.id ? null : item.id)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="badge badge-secondary text-xs">{item.category}</span>
                      <h3 className="font-medium text-gray-900">{item.question}</h3>
                    </div>
                  </div>
                  {expandedFAQ === item.id ? (
                    <ChevronUp size={20} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-400" />
                  )}
                </button>
                
                {expandedFAQ === item.id && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}

            {filteredFAQ.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No FAQ items found matching your search.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail size={20} className="text-blue-600" />
                <div>
                  <p className="font-medium">Email Support</p>
                  <p className="text-gray-600 text-sm">support@novacore.ai</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle size={20} className="text-green-600" />
                <div>
                  <p className="font-medium">Live Chat</p>
                  <p className="text-gray-600 text-sm">Available 9 AM - 5 PM EST</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Times</h3>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-green-600">General Inquiries</p>
                <p className="text-gray-600 text-sm">Within 24 hours</p>
              </div>
              <div>
                <p className="font-medium text-orange-600">Technical Issues</p>
                <p className="text-gray-600 text-sm">Within 12 hours</p>
              </div>
              <div>
                <p className="font-medium text-red-600">Critical Issues</p>
                <p className="text-gray-600 text-sm">Within 4 hours</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form Modal */}
        {showContactForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Contact Support</h2>
                  <button
                    onClick={() => setShowContactForm(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name
                      </label>
                      <input
                        {...register('name')}
                        type="text"
                        className={`input ${errors.name ? 'border-red-500' : ''}`}
                        disabled={isSubmitting}
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        {...register('email')}
                        type="email"
                        className={`input ${errors.email ? 'border-red-500' : ''}`}
                        disabled={isSubmitting}
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      {...register('category')}
                      className="input"
                      disabled={isSubmitting}
                    >
                      <option value="general">General Question</option>
                      <option value="technical">Technical Issue</option>
                      <option value="billing">Billing & Subscriptions</option>
                      <option value="feature">Feature Request</option>
                      <option value="bug">Bug Report</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject
                    </label>
                    <input
                      {...register('subject')}
                      type="text"
                      className={`input ${errors.subject ? 'border-red-500' : ''}`}
                      disabled={isSubmitting}
                    />
                    {errors.subject && (
                      <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      {...register('message')}
                      rows={6}
                      className={`input resize-none ${errors.message ? 'border-red-500' : ''}`}
                      placeholder="Please describe your question or issue in detail..."
                      disabled={isSubmitting}
                    />
                    {errors.message && (
                      <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowContactForm(false)}
                      className="btn-outline"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary flex items-center gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <ButtonLoading />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Send Message
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}