import { useState, useEffect } from 'react';
import { Mail, X, AlertCircle, Clock } from 'lucide-react';
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
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  // Countdown timer for retry-after
  useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      const timer = setInterval(() => {
        setRetryAfter(prev => {
          if (prev && prev > 1) {
            return prev - 1;
          }
          return null;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [retryAfter]);

  if (!isVisible || isVerified) {
    return null;
  }

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      const response = await api.post('/auth/resend-verification');
      toast.success(response.data.message || 'Verification email sent! Please check your inbox. You can request up to 3 emails per hour.');
      setRetryAfter(null);
    } catch (err) {
      const error = err as { response?: { status?: number; headers?: { 'retry-after'?: string }; data?: { message?: string } } };
      // Handle rate limiting with retry-after header
      if (error.response?.status === 429) {
        const retryAfterSeconds = error.response?.headers?.['retry-after'];
        if (retryAfterSeconds) {
          const seconds = parseInt(retryAfterSeconds, 10);
          setRetryAfter(seconds);
          toast.error(`Too many attempts. Please wait ${Math.ceil(seconds / 60)} minute(s) before trying again.`);
        } else {
          toast.error(error.response?.data?.message || 'Too many verification attempts. Please try again later.');
        }
      } else {
        const errorMsg = error.response?.data?.message || 'Failed to resend verification email';
        toast.error(errorMsg);
      }
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
    <div 
      className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg shadow-sm"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0" aria-hidden="true">
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
          {retryAfter && (
            <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded-md flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <p className="text-xs text-orange-800">
                You can resend the verification email in {Math.floor(retryAfter / 60)}:{String(retryAfter % 60).padStart(2, '0')} minutes
              </p>
            </div>
          )}
          <div className="mt-4">
            <button
              onClick={handleResendEmail}
              disabled={isResending || !!retryAfter}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label={isResending ? 'Sending verification email' : retryAfter ? `Wait ${Math.ceil(retryAfter / 60)} minutes before resending` : 'Resend verification email'}
            >
              <Mail className="h-4 w-4" />
              {isResending ? 'Sending...' : retryAfter ? `Wait ${Math.ceil(retryAfter / 60)}m` : 'Resend Verification Email'}
            </button>
          </div>
        </div>
        <div className="ml-auto pl-3">
          <button
            onClick={handleDismiss}
            className="inline-flex text-yellow-400 hover:text-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 rounded"
            aria-label="Dismiss verification reminder"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
