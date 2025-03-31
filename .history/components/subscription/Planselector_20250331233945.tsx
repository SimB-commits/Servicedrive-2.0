// components/subscription/PlanSelector.tsx
import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  RadioGroup, 
  Radio, 
  Button, 
  Switch, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Spinner,
  useDisclosure
} from '@heroui/react';
import { SubscriptionPlan } from '@prisma/client';
import { SubscriptionService } from '@/utils/subscriptionFeatures';

interface PlanSelectorProps {
  currentPlan: SubscriptionPlan;
  currentBillingPeriod: 'monthly' | 'yearly';
  autoRenew: boolean;
  onPlanChanged?: () => void;
}

const PlanSelector: React.FC<PlanSelectorProps> = ({
  currentPlan,
  currentBillingPeriod,
  autoRenew: initialAutoRenew,
  onPlanChanged
}) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(currentPlan);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(currentBillingPeriod);
  const [autoRenew, setAutoRenew] = useState<boolean>(initialAutoRenew);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmationDetails, setConfirmationDetails] = useState<{ 
    planName: string; 
    price: string; 
    billingPeriod: string;
    downgradeWarning?: string[];
  } | null>(null);
  
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Beräknar prisskillnad för visning
  const calculatePriceDifference = () => {
    const currentPrice = currentBillingPeriod === 'yearly'
      ? SubscriptionService.getYearlyPrice(currentPlan)
      : SubscriptionService.getMonthlyPrice(currentPlan);
    
    const newPrice = billingPeriod === 'yearly'
      ? SubscriptionService.getYearlyPrice(selectedPlan)
      : SubscriptionService.getMonthlyPrice(selectedPlan);
    
    const difference = newPrice - currentPrice;
    
    if (difference === 0) return null;
    
    return {
      amount: Math.abs(difference),
      isIncrease: difference > 0
    };
  };

  // Visar bekräftelsedialogrutan med relevanta detaljer
  const handleConfirmChange = async () => {
    // Förhindra oändliga bekräftelser om inget ändrats
    if (
      selectedPlan === currentPlan && 
      billingPeriod === currentBillingPeriod && 
      autoRenew === initialAutoRenew
    ) {
      setError('Ingen ändring att spara.');
      return;
    }
    
    // Hämta plannamn för visning
    const planName = SubscriptionService.getPlanDisplayName(selectedPlan);
    
    // Beräkna pris baserat på faktureringsperiod
    const price = billingPeriod === 'yearly'
      ? `${SubscriptionService.getYearlyPrice(selectedPlan)} kr/år`
      : `${SubscriptionService.getMonthlyPrice(selectedPlan)} kr/mån`;
    
    // Formatera faktureringsperiod för visning
    const billingPeriodText = billingPeriod === 'yearly' ? 'Årsvis' : 'Månadsvis';
    
    // Kontrollera om det är en nedgradering och samla varningar
    const isDowngrade = SubscriptionService.isPlanDowngrade(currentPlan, selectedPlan);
    let downgradeWarnings: string[] | undefined;
    
    if (isDowngrade) {
      // Hämta planer för jämförelse
      const currentLimits = SubscriptionService.getLimits(currentPlan);
      const newLimits = SubscriptionService.getLimits(selectedPlan);
      downgradeWarnings = [];
      
      // Kolla efter administrationsbegränsningar
      if (newLimits.adminUsers < currentLimits.adminUsers) {
        downgradeWarnings.push(
          `Administratörer: ${newLimits.adminUsers} (nuvarande plan: ${currentLimits.adminUsers})`
        );
      }
      
      // Kolla efter ärendetypsbegränsningar
      if (
        newLimits.ticketTypes !== SubscriptionService.UNLIMITED && 
        (currentLimits.ticketTypes === SubscriptionService.UNLIMITED || 
         newLimits.ticketTypes < currentLimits.ticketTypes)
      ) {
        const currentLimit = currentLimits.ticketTypes === SubscriptionService.UNLIMITED 
          ? 'Obegränsat' 
          : currentLimits.ticketTypes;
          
        downgradeWarnings.push(
          `Ärendetyper: ${newLimits.ticketTypes} (nuvarande plan: ${currentLimit})`
        );
      }
      
      // Kolla efter statusbegränsningar
      if (
        newLimits.customStatuses !== SubscriptionService.UNLIMITED && 
        (currentLimits.customStatuses === SubscriptionService.UNLIMITED || 
         newLimits.customStatuses < currentLimits.customStatuses)
      ) {
        const currentLimit = currentLimits.customStatuses === SubscriptionService.UNLIMITED 
          ? 'Obegränsat' 
          : currentLimits.customStatuses;
          
        downgradeWarnings.push(
          `Anpassade statusar: ${newLimits.customStatuses} (nuvarande plan: ${currentLimit})`
        );
      }
      
      // Kolla efter ärende-per-månad begränsningar
      if (
        newLimits.ticketsPerMonth !== SubscriptionService.UNLIMITED && 
        currentLimits.ticketsPerMonth === SubscriptionService.UNLIMITED
      ) {
        downgradeWarnings.push(
          `Ärenden per månad: ${newLimits.ticketsPerMonth} (nuvarande plan: Obegränsat)`
        );
      }
      
      // Kolla för historikbegränsningar
      if (newLimits.historyMonths < currentLimits.historyMonths) {
        downgradeWarnings.push(
          `Historik: ${newLimits.historyMonths} månader (nuvarande plan: ${currentLimits.historyMonths} månader)`
        );
      }
      
      // Om inga specifika varningar, lägg till en generell
      if (downgradeWarnings.length === 0) {
        downgradeWarnings.push(
          'Du förlorar tillgång till vissa funktioner genom denna nedgradering.'
        );
      }
    }
    
    // Sätt bekräftelsedetaljer och öppna modalen
    setConfirmationDetails({
      planName,
      price,
      billingPeriod: billingPeriodText,
      downgradeWarning: downgradeWarnings
    });
    
    onOpen();
  };

  // Skickar den faktiska planändringen till API
  const submitPlanChange = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: selectedPlan,
          billingPeriod,
          autoRenew,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ett fel inträffade vid ändring av plan');
      }
      
      const result = await response.json();
      setSuccessMessage(result.message || 'Prenumerationsplan har ändrats');
      
      // Stäng modalen
      onClose();
      
      // Notifiera föräldern om ändringen
      if (onPlanChanged) {
        onPlanChanged();
      }
      
      // Ladda om sidan efter 2 sekunder för att uppdatera UI
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel inträffade');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Beräkna prisskillnaden om det finns någon
  const priceDifference = calculatePriceDifference();

  return (
    <>
      <Card className="w-full">
        <CardBody className="gap-6">
          {error && (
            <div className="p-3 mb-4 bg-danger-100 text-danger-800 rounded-lg">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="p-3 mb-4 bg-success-100 text-success-800 rounded-lg">
              {successMessage}
            </div>
          )}
          
          <section>
            <h3 className="text-lg font-semibold mb-4">Välj prenumerationsplan</h3>
            
            <RadioGroup
              value={selectedPlan}
              onValueChange={(value) => setSelectedPlan(value as SubscriptionPlan)}
              className="gap-3"
            >
              <Radio value="STARTUP" description="För nystartade verksamheter och enskilda företagare">
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">Startup (Gratis)</span>
                  <span className="text-default-500">0 kr</span>
                </div>
              </Radio>
              
              <Radio value="TEAM" description="För småföretag som behöver professionell ärendehantering">
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">Team</span>
                  <span className="text-default-500">
                    {billingPeriod === 'yearly' ? '1 990 kr/år' : '199 kr/mån'}
                  </span>
                </div>
              </Radio>
              
              <Radio value="GROWING" description="För verksamheter i tillväxtfas som behöver mer avancerade funktioner">
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">Växande</span>
                  <span className="text-default-500">
                    {billingPeriod === 'yearly' ? '3 490 kr/år' : '349 kr/mån'}
                  </span>
                </div>
              </Radio>
              
              <Radio value="PROFESSIONAL" description="För etablerade företag med behov av avancerad ärendehantering">
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">Professionell</span>
                  <span className="text-default-500">
                    {billingPeriod === 'yearly' ? '4 990 kr/år' : '499 kr/mån'}
                  </span>
                </div>
              </Radio>
            </RadioGroup>
          </section>
          
          <section>
            <h3 className="text-lg font-semibold mb-4">Betalningsalternativ</h3>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Faktureringsperiod</div>
                  <div className="text-sm text-default-500">
                    {billingPeriod === 'yearly' ? 'Årsvis' : 'Månadsvis'}
                    {billingPeriod === 'yearly' && ' (spara 2 månader)'}
                  </div>
                </div>
                
                <Switch
                  isSelected={billingPeriod === 'yearly'}
                  onValueChange={(isYearly) => setBillingPeriod(isYearly ? 'yearly' : 'monthly')}
                  aria-label="Årsbetalning"
                />
              </div>
              
              {billingPeriod === 'yearly' && (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Automatisk förnyelse</div>
                    <div className="text-sm text-default-500">
                      Prenumerationen förnyas automatiskt när den löper ut
                    </div>
                  </div>
                  
                  <Switch
                    isSelected={autoRenew}
                    onValueChange={setAutoRenew}
                    aria-label="Automatisk förnyelse"
                  />
                </div>
              )}
            </div>
          </section>
          
          <section className="mt-4">
            <div className="flex justify-between items-center">
              <div>
                {priceDifference && (
                  <p className={`text-sm ${priceDifference.isIncrease ? 'text-danger-500' : 'text-success-500'}`}>
                    {priceDifference.isIncrease ? 'Ökning' : 'Minskning'} med {priceDifference.amount} kr
                    {billingPeriod === 'yearly' ? '/år' : '/mån'}
                  </p>
                )}
              </div>
              
              <Button
                color="primary"
                onClick={handleConfirmChange}
                isDisabled={isSubmitting || !!successMessage}
              >
                {isSubmitting ? <Spinner size="sm" color="white" /> : 'Uppdatera prenumeration'}
              </Button>
            </div>
          </section>
        </CardBody>
      </Card>
      
      {/* Bekräftelsedialog */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>
            Bekräfta prenumerationsändring
          </ModalHeader>
          <ModalBody>
            {confirmationDetails && (
              <>
                <p>Du håller på att ändra din prenumeration till:</p>
                
                <div className="my-4 p-3 bg-default-50 rounded-lg">
                  <p className="font-semibold">{confirmationDetails.planName}</p>
                  <p>{confirmationDetails.price}</p>
                  <p>Betalning: {confirmationDetails.billingPeriod}</p>
                  {billingPeriod === 'yearly' && (
                    <p>Automatisk förnyelse: {autoRenew ? 'Ja' : 'Nej'}</p>
                  )}
                </div>
                
                {confirmationDetails.downgradeWarning && confirmationDetails.downgradeWarning.length > 0 && (
                  <div className="mt-4 p-3 bg-warning-100 text-warning-800 rounded-lg">
                    <p className="font-semibold mb-2">Observera vid nedgradering:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {confirmationDetails.downgradeWarning.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onClick={onClose}>
              Avbryt
            </Button>
            <Button color="primary" onClick={submitPlanChange} isDisabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" color="white" /> : 'Bekräfta ändring'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default PlanSelector;