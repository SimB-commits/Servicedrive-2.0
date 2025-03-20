// components/email/DomainVerificationInfo.tsx

import React from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  CardFooter,
  Button
} from '@heroui/react';

interface DomainVerificationInfoProps {
  onAddNewClick: () => void;
}

const DomainVerificationInfo: React.FC<DomainVerificationInfoProps> = ({ onAddNewClick }) => {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Om domänverifiering</h3>
      </CardHeader>
      <CardBody>
        <div className="prose prose-sm max-w-none">
          <p>
            För att kunna skicka mail från dina egna domäner behöver du verifiera domänägarskapet 
            genom att lägga till särskilda DNS-poster. Detta bevisar för SendGrid (vår e-posttjänst) 
            att du har rätt att skicka mail från domänen.
          </p>
          
          <h4 className="text-md font-medium mt-4">Hur det fungerar</h4>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong>Verifiering</strong> - Du anger din domän och får DNS-poster att lägga till hos din DNS-leverantör
            </li>
            <li>
              <strong>DNS-ändring</strong> - Lägg till dessa poster i din domäns DNS-inställningar
            </li>
            <li>
              <strong>Kontroll</strong> - Systemet kontrollerar om DNS-posterna har lagts till korrekt
            </li>
            <li>
              <strong>Godkännande</strong> - När verifieringen är klar, kan du skicka mail från adresser på din domän
            </li>
          </ol>
          
          <div className="bg-info-50 border border-info-200 rounded-md p-3 mt-4">
            <h5 className="font-medium text-info-700">Bra att veta</h5>
            <ul className="list-disc list-inside text-sm space-y-1 mt-1 text-info-700">
              <li>DNS-ändringar kan ta upp till 48 timmar att spridas, men oftast går det mycket snabbare</li>
              <li>Du behöver åtkomst till din domäns DNS-inställningar (ofta hos din webbhotellsleverantör)</li>
              <li>Dina befintliga e-postinställningar påverkas inte av denna verifiering</li>
              <li>Servicedrive.se är alltid tillgänglig som avsändardomän om du inte vill använda egen domän</li>
            </ul>
          </div>
        </div>
      </CardBody>
      <CardFooter>
        <Button color="primary" onPress={onAddNewClick}>
          Verifiera en ny domän
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DomainVerificationInfo;