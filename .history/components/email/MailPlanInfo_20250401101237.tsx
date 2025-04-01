// components/email/MailPlanInfo.tsx
import React from 'react';
import { Card, CardBody, Button, Divider } from '@heroui/react';
import useSubscription from '@/hooks/useSubscription';
import { ArrowRightIcon } from '@/components/icons';
import { SubscriptionPlan } from '@prisma/client';

const MailPlanInfo: React.FC = () => {
  const { plan, planName, features, isLoading } = useSubscription();
  
  if (isLoading) {
    return null;
  }

  // Definiera funktioner tillgängliga per plan
  const getPlanFeatures = (currentPlan: SubscriptionPlan) => {
    switch(currentPlan) {
      case 'PROFESSIONAL':
        return {
          description: 'Fullständig tillgång till mailmallar och avancerad anpassning',
          features: [
            'Obegränsat antal mailmallar',
            'Anpassade avsändare med egna domäner',
            'Avancerad automatisering och triggers',
            'SMS-integration',
            'Prioriterad support'
          ]
        };
      case 'GROWING':
        return {
          description: 'Utökad tillgång till mailmallar och automatisering',
          features: [
            'Upp till 20 mailmallar',
            'Anpassade avsändare med egna domäner',
            'Automatisering för status-triggers',
            
          ]
        };
      case 'TEAM':
        return {
          description: 'Grundläggande tillgång till mailmallar',
          features: [
            'Upp till 10 mailmallar',
            'Grundläggande automatisering',
            'Anpassade avsändare'
          ]
        };
      case 'STARTUP':
      default:
        return {
          description: 'Begränsad tillgång till mailmallar',
          features: [
            'Endast standardmallar',
            'Ingen anpassning',
            'Inga egna domäner'
          ]
        };
    }
  };

  const planFeatures = getPlanFeatures(plan);

  // För STARTUP-planen som inte har tillgång till mailmallar
  if (!features.emailTemplates) {
    return (
      <Card className="bg-warning-50 border-warning-200 border mb-6">
        <CardBody>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h3 className="text-warning-700 font-medium">Begränsad tillgång till mailmallar</h3>
              <p className="text-warning-600 text-sm">
                Din <strong>{planName}</strong> plan ger dig begränsad tillgång till mailmallar. 
                Uppgradera till Team-planen eller högre för att skapa egna mallar och automatisering.
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
  }
  
  // För planer med tillgång till mailmallar
  const cardStyle = plan === 'TEAM' ? 'bg-info-50 border-info-200' : 'bg-success-50 border-success-200';
  const textColor = plan === 'TEAM' ? 'text-info-700' : 'text-success-700';
  const subtextColor = plan === 'TEAM' ? 'text-info-600' : 'text-success-600';
  
  return (
    <Card className={`${cardStyle} border mb-6`}>
      <CardBody>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div>
              <h3 className={`${textColor} font-medium`}>
                {plan === 'PROFESSIONAL' ? 'Fullständig' : 'Utökad'} tillgång till mailmallar
              </h3>
              <p className={`${subtextColor} text-sm`}>
                Din <strong>{planName}</strong> plan ger dig {planFeatures.description.toLowerCase()}.
              </p>
            </div>
            
            {plan !== 'PROFESSIONAL' && (
              <Button 
                as="a"
                href="/installningar?tab=subscription&upgrade=true"
                color={plan === 'TEAM' ? 'primary' : 'success'}
                variant="flat"
                size="sm"
              >
                Uppgradera för mer
              </Button>
            )}
          </div>
          
          <Divider className="my-2" />
          
          <div>
            <p className="text-sm font-medium mb-1">Din plan inkluderar:</p>
            <ul className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              {planFeatures.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <span className="text-success-500 mr-2">✓</span> {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default MailPlanInfo;