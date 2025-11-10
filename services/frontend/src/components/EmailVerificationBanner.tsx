import { useState } from 'react';
import { Mail, X, AlertCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface EmailVerificationBannerProps {
  isVerified?: boolean;
  onDismiss?: () => void;
}

export default function EmailVerificationBanner({ 
  isVerified = false,
  onDismiss 
}: EmailVerificationBannerProps) {
  const [isVisible, setIsVisible] = useState(!isVerified);
  const [isResending, setIsResending] = useState(false);

  if (!isVisible || isVerified) {
    return null;
  }

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      const response = await api.post('/auth/resend-verification');
      toast.success(response.data.message || 'Verification email sent! Please check your inbox.');
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to resend verification email';
      toast.error(errorMsg);
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Email Verification Required
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              Please verify your email address to access all features. 
              Check your inbox for the verification link.
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={handleResendEmail}
              disabled={isResending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Mail className="h-4 w-4" />
              {isResending ? 'Sending...' : 'Resend Verification Email'}
            </button>
          </div>
        </div>
        <div className="ml-auto pl-3">
          <button
            onClick={handleDismiss}
            className="inline-flex text-yellow-400 hover:text-yellow-500 focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
