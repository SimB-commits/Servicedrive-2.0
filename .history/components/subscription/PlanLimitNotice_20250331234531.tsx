// components/subscription/PlanLimitNotice.tsx
import React from 'react';
import { Card, CardBody, Button, Divider } from '@heroui/react';
import { ArrowRightIcon } from '@/components/icons';
import useSubscription from '@/hooks/useSubscription';

interface PlanLimitNoticeProps {
  resourceType: 'ticket' | 'ticketType' | 'customStatus' | 'admin';
  className?: string;
  compact?: boolean;
  showUpgradeButton?: boolean;
}

/**
 * Komponent som visas när användaren når en plangräns för en viss resurstyp
 */
const PlanLimitNotice: React.FC<PlanLimitNoticeProps> = ({
  resourceType,
  className = '',
  compact = false,
  showUpgradeButton = true
}) => {
  const { planName, getLimitMessage, canCreate } = useSubscription();
  
  // Visa inget om användaren inte har nått gränsen
  if (canCreate(resourceType)) {
    return null;
  }
  
  const resourceLabels = {
    ticket: 'ärenden',
    ticketType: 'ärendetyper',
    customStatus: 'anpassade statusar',
    admin: 'administratörer'
  };
  
  const resourceLabel = resourceLabels[resourceType];
  const limitMessage = getLimitMessage(resourceType);
  
  // Kompakt version (endast för inline-meddelanden)
  if (compact) {
    return (
      <div className={`text-sm text-danger-500 ${className}`}>
        <p>{limitMessage}</p>
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
              Gräns nådd för {resourceLabel}
            </h3>
            <p className="text-default-600 mt-1">
              {limitMessage}
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
        
        <Divider className="my-1" />
        
        <div className="text-sm text-default-500">
          <p>
            Din nuvarande plan: <span className="font-medium">{planName}</span>
          </p>
          <p className="mt-1">
            För att skapa fler {resourceLabel}, uppgradera till en högre plan eller ta bort befintliga.
          </p>
        </div>
      </CardBody>
    </Card>
  );
};

export default PlanLimitNotice;