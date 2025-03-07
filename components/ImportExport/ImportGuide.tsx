import React from 'react';
import { Card, CardHeader, CardBody, Divider } from '@heroui/react';

const ImportGuide = () => {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-medium">Importguide</h3>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Format för kundfiler</h4>
            <p className="text-sm text-default-500 mb-2">
              Filen bör innehålla följande fält:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 text-default-500">
              <li><strong>firstName</strong> - Kundens förnamn</li>
              <li><strong>lastName</strong> - Kundens efternamn</li>
              <li><strong>email</strong> - Kundens e-postadress (obligatoriskt)</li>
              <li><strong>phoneNumber</strong> - Telefonnummer</li>
              <li><strong>address</strong> - Postadress</li>
              <li><strong>postalCode</strong> - Postnummer</li>
              <li><strong>city</strong> - Ort</li>
              <li><strong>country</strong> - Land</li>
              <li><strong>newsletter</strong> - Nyhetsbrev (true/false)</li>
              <li><strong>loyal</strong> - Stamkund (true/false)</li>
            </ul>
          </div>
          
          <Divider />
          
          <div>
            <h4 className="font-medium">Format för ärendefiler</h4>
            <p className="text-sm text-default-500 mb-2">
              Filen bör innehålla följande fält:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 text-default-500">
              <li><strong>title</strong> - Ärendets titel</li>
              <li><strong>description</strong> - Ärendebeskrivning</li>
              <li><strong>status</strong> - Ärendestatus (OPEN, IN_PROGRESS, etc.)</li>
              <li><strong>dueDate</strong> - Deadline (YYYY-MM-DD)</li>
              <li><strong>customerEmail</strong> - Kopplar ärendet till en befintlig kund via e-post (obligatoriskt)</li>
            </ul>
          </div>
          
          <Divider />
          
          <div>
            <h4 className="font-medium">Tips för lyckad import</h4>
            <ul className="list-disc list-inside text-sm space-y-1 text-default-500">
              <li>Vid import av ärenden måste kunderna redan finnas i systemet</li>
              <li>Kontrollera fältmappningen noggrant innan du startar importen</li>
              <li>För stora datamängder, dela upp data i mindre filer</li>
              <li>Datum bör vara i formatet YYYY-MM-DD eller MM/DD/YYYY</li>
              <li>Boolean-värden (true/false) kan också anges som 1/0, yes/no, eller ja/nej</li>
            </ul>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default ImportGuide;