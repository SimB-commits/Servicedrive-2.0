// components/subscription/UsageIndicator.tsx
import React from 'react';
import { SubscriptionService } from '@/utils/subscriptionFeatures';

interface UsageIndicatorProps {
  current: number;
  limit: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

/**
 * Komponent för att visa resursanvändning i förhållande till plangränser
 */
const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  current,
  limit,
  label,
  size = 'md',
  showText = true,
}) => {
  const { percentage, status, display } = SubscriptionService.getUsageStats(current, limit);
  
  // Bestäm färg baserat på status
  const getStatusColor = () => {
    switch (status) {
      case 'critical': return 'bg-danger-500';
      case 'warning': return 'bg-warning-500';
      case 'ok': return 'bg-success-500';
      default: return 'bg-primary-500';
    }
  };
  
  // Bestäm höjd baserat på storlek
  const getHeight = () => {
    switch (size) {
      case 'sm': return 'h-1.5';
      case 'lg': return 'h-3';
      case 'md':
      default: return 'h-2';
    }
  };
  
  return (
    <div className="w-full">
      {showText && (
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">{label}</span>
          <span className={`text-${status === 'critical' ? 'danger' : status === 'warning' ? 'warning' : 'default'}-500`}>
            {display}
          </span>
        </div>
      )}
      
      <div className={`w-full ${getHeight()} bg-gray-200 rounded-full overflow-hidden`}>
        {limit === SubscriptionService.UNLIMITED ? (
          <div className="bg-success-100 h-full w-full flex items-center justify-center">
            <span className="text-xs px-1 text-success-700 font-medium">Obegränsat</span>
          </div>
        ) : (
          <div 
            className={`${getStatusColor()} h-full transition-all duration-300 ease-in-out`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        )}
      </div>
      
      {!showText && (
        <div className="sr-only">
          {label}: {display}
        </div>
      )}
    </div>
  );
};

export default UsageIndicator;