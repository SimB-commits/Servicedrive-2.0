// components/subscription/PlanFeatureNotice.tsx
import React, { useMemo } from 'react';
import { Card, CardBody, Button } from '@heroui/react';
import { ArrowRightIcon } from '@/components/icons';
import { useSubscription } from '@/context/SubscriptionContext';
import type { PlanFeatures } from '@/utils/subscriptionFeatures';

interface PlanFeatureNoticeProps {
  feature: keyof PlanFeatures;
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
  showUpgradeButton?: boolean;
  /**
   * Om true, renderar komponenten bara om prenumerationsdata är laddad.
   * Detta förhindrar UI-flimmer under inladdningen.
   * @default true
   */
  renderOnlyWhenLoaded?: boolean;
}

/**
 * Komponent som visar en notis när en funktion inte är tillgänglig i den aktuella prenumerationsplanen
 */
const PlanFeatureNotice: React.FC<PlanFeatureNoticeProps> = ({
  feature,
  title,
  description,
  className = '',
  compact = false,
  showUpgradeButton = true,
  renderOnlyWhenLoaded = true
}) => {
  const { features, planName, isLoading } = useSubscription();
  
  // Bestäm om komponenten ska visas baserat på inladdningsstatus och prenumerationsplanfunktioner
  const shouldRender = useMemo(() => {
    // Om renderOnlyWhenLoaded är true, visa inget under inladdning
    if (renderOnlyWhenLoaded && isLoading) {
      return false;
    }
    
    // Visa inget om funktionen är tillgänglig i användarens plan
    return !features[feature];
  }, [renderOnlyWhenLoaded, isLoading, features, feature]);
  
  // Visa inget om vi inte ska rendera
  if (!shouldRender) {
    return null;
  }
  
  // Standardvärden för titel och beskrivning om de inte anges
  const defaultTitle = 'Funktionen är inte tillgänglig';
  const defaultDescription = `Denna funktion är inte tillgänglig i din nuvarande ${planName}-plan.`;
  
  const displayTitle = title || defaultTitle;
  const displayDescription = description || defaultDescription;
  
  // Kompakt version (endast för inline-meddelanden)
  if (compact) {
    return (
      <div className={`text-sm text-danger-500 ${className}`}>
        <p>{displayDescription}</p>
        {showUpgradeButton && (
          <a 
            href="/installningar?tab=subscription&upgrade=true" 
            className="text-primary-600 hover:text-primary-800 font-medium inline-flex items-center mt-1"
          >
            Uppgradera din plan <ArrowRightIcon className="ml-1 w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  // Full version med kort
  return (
    <Card className={`border border-warning-200 ${className}`}>
      <CardBody className="gap-3">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div>
            <h3 className="text-lg font-medium text-warning-700">
              {displayTitle}
            </h3>
            <p className="text-default-600 mt-1">
              {displayDescription}
            </p>
          </div>
          
          {showUpgradeButton && (
            <Button 
              as="a"
              href="/installningar?tab=subscription&upgrade=true"
              color="primary"
              size="sm"
              endContent={<ArrowRightIcon size={16} />}
            >
              Uppgradera din plan
            </Button>
          )}
        </div>
        
        <div className="text-sm text-default-500 mt-2">
          <p>
            Uppgradera till en högre plan för att få tillgång till denna funktion och fler avancerade funktioner.
          </p>
        </div>
      </CardBody>
    </Card>
  );
};

export default PlanFeatureNotice;