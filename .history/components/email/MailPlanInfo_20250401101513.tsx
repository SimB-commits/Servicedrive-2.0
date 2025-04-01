// components/email/MailPlanInfo.tsx
import React from 'react';
import { Card, CardBody, Button } from '@heroui/react';
import useSubscription from '@/hooks/useSubscription';
import { ArrowRightIcon } from '@/components/icons';

const MailPlanInfo: React.FC = () => {
  const { planName, features, isLoading } = useSubscription();
  
  // Visa ingenting om användaren laddar eller redan har tillgång till mailmallar
  if (isLoading || features.emailTemplates) {
    return null;
  }

  // Visa endast varning för användare som inte har tillgång till mailmallar (STARTUP-plan)
  return (
    <Card className="bg-warning-50 border-warning-200 border mb-6">
      <CardBody>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-warning-700 font-medium">Begränsad tillgång till mailmallar</h3>
            <p className="text-warning-600 text-sm">
              Din <strong>{planName}</strong> plan tillåter endast visning av standardmallar.
              Uppgradera till Team-planen eller högre för att skapa egna mallar, anpassa e-posttriggers och aktivera automatiska utskick.
            </p>
          </div>
          <Button 
            as="a"
            href="/installningar?tab=subscription&upgrade=true"
            color="warning"
            size="sm"
            endContent={<ArrowRightIcon size={16} />}
          >
            Uppgradera plan
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};

export default MailPlanInfo;