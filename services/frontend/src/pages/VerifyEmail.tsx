import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { isAuthenticated, loadUser } = useAuthStore();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        return;
      }

      try {
        const response = await api.get(`/auth/verify-email?token=${token}`);
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully!');
        
        toast.success('Email verified! Redirecting...');
        
        // Reload user data if authenticated to update email_verified status
        if (isAuthenticated) {
          await loadUser();
        }
        
        // Redirect to dashboard if authenticated, otherwise to login after 3 seconds
        setTimeout(() => {
          navigate(isAuthenticated ? '/dashboard' : '/login');
        }, 3000);
      } catch (err) {
        const error = err as { response?: { status?: number; headers?: { 'retry-after'?: string }; data?: { message?: string } } };
        setStatus('error');
        
        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfterSeconds = error.response?.headers?.['retry-after'];
          if (retryAfterSeconds) {
            setRetryAfter(parseInt(retryAfterSeconds, 10));
          }
          const errorMsg = error.response?.data?.message || 'Too many verification attempts. Please try again later.';
          setMessage(errorMsg);
          toast.error(errorMsg);
        } else {
          const errorMsg = error.response?.data?.message || 'Failed to verify email. The link may be invalid or expired.';
          setMessage(errorMsg);
          toast.error(errorMsg);
        }
      }
    };

    verifyEmail();
  }, [token, navigate, isAuthenticated, loadUser]);

  const handleResendEmail = async () => {
    try {
      const response = await api.post('/auth/resend-verification');
      toast.success(response.data.message || 'Verification email sent! Please check your inbox.');
      setRetryAfter(null);
    } catch (err) {
      const error = err as { response?: { status?: number; headers?: { 'retry-after'?: string }; data?: { message?: string } } };
      // Handle rate limiting
      if (error.response?.status === 429) {
        const retryAfterSeconds = error.response?.headers?.['retry-after'];
        if (retryAfterSeconds) {
          setRetryAfter(parseInt(retryAfterSeconds, 10));
          toast.error(`Too many attempts. Please wait ${retryAfterSeconds} seconds before trying again.`);
        } else {
          toast.error(error.response?.data?.message || 'Too many attempts. Please try again later.');
        }
      } else {
        const errorMsg = error.response?.data?.message || 'Failed to resend verification email';
        toast.error(errorMsg);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8" role="main" aria-live="polite">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 mb-6 flex items-center justify-center" aria-hidden="true">
            {status === 'loading' && (
              <Loader2 className="w-20 h-20 text-blue-500 animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle className="w-20 h-20 text-green-500" />
            )}
            {status === 'error' && (
              <XCircle className="w-20 h-20 text-red-500" />
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {status === 'loading' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h1>

          {/* Message */}
          <p className="text-gray-600 mb-6">{message}</p>

          {/* Rate limit warning */}
          {retryAfter && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Rate limit reached.</strong> Please wait {retryAfter} seconds before trying again.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {status === 'success' && (
              <button
                onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                aria-label={isAuthenticated ? 'Go to dashboard' : 'Go to login page'}
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Go to Login'}
              </button>
            )}

            {status === 'error' && (
              <>
                <button
                  onClick={handleResendEmail}
                  disabled={!!retryAfter}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  aria-label="Resend verification email"
                >
                  <Mail className="w-5 h-5" />
                  {retryAfter ? `Wait ${retryAfter}s` : 'Resend Verification Email'}
                </button>
                <button
                  onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
                  className="w-full bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  aria-label={isAuthenticated ? 'Back to dashboard' : 'Back to login page'}
                >
                  {isAuthenticated ? 'Back to Dashboard' : 'Back to Login'}
                </button>
              </>
            )}

            {status === 'loading' && (
              <p className="text-sm text-gray-500">Please wait while we verify your email address...</p>
            )}
          </div>

          {/* Help text */}
          {status === 'error' && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Need help?</strong> If you continue to experience issues, please contact support at{' '}
                <a 
                  href="mailto:support@novacore.ai" 
                  className="underline hover:text-yellow-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 rounded"
                >
                  support@novacore.ai
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
