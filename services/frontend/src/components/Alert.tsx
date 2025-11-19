import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

type AlertType = 'success' | 'warning' | 'error' | 'info';

interface AlertProps {
  type: AlertType;
  title?: string;
  children: ReactNode;
  className?: string;
  onDismiss?: () => void;
}

const alertStyles: Record<AlertType, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconStyles: Record<AlertType, string> = {
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  info: 'text-blue-500',
};

const icons: Record<AlertType, ReactNode> = {
  success: <CheckCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  error: <XCircle size={20} />,
  info: <Info size={20} />,
};

export default function Alert({
  type,
  title,
  children,
  className,
  onDismiss
}: AlertProps) {
  return (
    <div className={cn(
      'rounded-lg border p-4',
      alertStyles[type],
      className
    )}>
      <div className="flex">
        <div className={cn('flex-shrink-0', iconStyles[type])}>
          {icons[type]}
        </div>
        
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium mb-1">
              {title}
            </h3>
          )}
          
          <div className="text-sm">
            {children}
          </div>
        </div>
        
        {onDismiss && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              className={cn(
                'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                type === 'success' && 'text-green-500 hover:bg-green-100 focus:ring-green-600',
                type === 'warning' && 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600',
                type === 'error' && 'text-red-500 hover:bg-red-100 focus:ring-red-600',
                type === 'info' && 'text-blue-500 hover:bg-blue-100 focus:ring-blue-600'
              )}
            >
              <XCircle size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}