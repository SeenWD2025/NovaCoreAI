import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

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
        
        toast.success('Email verified! Redirecting to login...');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (error: any) {
        setStatus('error');
        const errorMsg = error.response?.data?.message || 'Failed to verify email. The link may be invalid or expired.';
        setMessage(errorMsg);
        toast.error(errorMsg);
      }
    };

    verifyEmail();
  }, [token, navigate]);

  const handleResendEmail = async () => {
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to resend verification email';
      toast.error(errorMsg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 mb-6 flex items-center justify-center">
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

          {/* Actions */}
          <div className="space-y-3">
            {status === 'success' && (
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Go to Login
              </button>
            )}

            {status === 'error' && (
              <>
                <button
                  onClick={handleResendEmail}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  Resend Verification Email
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-all duration-200"
                >
                  Back to Login
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
                <a href="mailto:support@novacore.ai" className="underline">
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
