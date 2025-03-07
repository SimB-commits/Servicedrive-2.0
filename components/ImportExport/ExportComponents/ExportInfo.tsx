import React from 'react';
import { Card, CardHeader, CardBody, Divider, Accordion, AccordionItem } from '@heroui/react';

const ExportInfo = () => {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-medium">Exportinformation</h3>
      </CardHeader>
      <CardBody>
        <Accordion variant="splitted">
          <AccordionItem key="formats" title="Exportformat">
            <div className="space-y-2">
              <div className="p-3 bg-default-100 rounded-md">
                <h5 className="font-medium">CSV</h5>
                <p className="text-sm text-default-500">
                  Kommaseparerade värden som kan öppnas i Excel eller Google Sheets.
                  Bra för dataanalys eller import till andra system.
                </p>
              </div>
              
              <div className="p-3 bg-default-100 rounded-md">
                <h5 className="font-medium">Excel</h5>
                <p className="text-sm text-default-500">
                  Microsoft Excel-format (.xlsx) som bevarar formateringar och datatyper.
                  Bäst för användare som vill arbeta med data i Excel.
                </p>
              </div>
              
              <div className="p-3 bg-default-100 rounded-md">
                <h5 className="font-medium">JSON</h5>
                <p className="text-sm text-default-500">
                  Strukturerat dataformat som används för dataöverföring mellan system.
                  Bäst för utvecklare eller för import till andra system.
                </p>
              </div>
            </div>
          </AccordionItem>
          
          <AccordionItem key="data" title="Inkluderad data">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="font-medium min-w-24">Kunder:</div>
                <div className="text-sm text-default-500">
                  <ul className="list-disc list-inside">
                    <li>Kontaktuppgifter (namn, e-post, telefon)</li>
                    <li>Adressinformation</li>
                    <li>Anpassade fält</li>
                    <li>Statusuppgifter (stamkund, nyhetsbrev)</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="font-medium min-w-24">Ärenden:</div>
                <div className="text-sm text-default-500">
                  <ul className="list-disc list-inside">
                    <li>Rubrik och beskrivning</li>
                    <li>Status och ärendetyp</li>
                    <li>Deadlines och viktiga datum</li>
                    <li>Kund- och användarreferenser</li>
                    <li>Anpassade fält</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="font-medium min-w-24">All data:</div>
                <div className="text-sm text-default-500">
                  Både kunder och ärenden med kopplingar mellan dem. Inkluderar även statistik om antal ärenden per kund.
                </div>
              </div>
            </div>
          </AccordionItem>
          
          <AccordionItem key="tips" title="Tips för export">
            <ul className="list-disc list-inside text-sm space-y-1 text-default-500">
              <li>
                <span className="font-medium">Regelbunden säkerhetskopiering:</span>
                <span className="text-xs ml-1">Exportera data månadsvis för att säkerställa att du har backup</span>
              </li>
              <li>
                <span className="font-medium">Stora dataset:</span>
                <span className="text-xs ml-1">För stora databaser, begränsa antalet poster eller dela upp exporten</span>
              </li>
              <li>
                <span className="font-medium">CSV vs Excel:</span>
                <span className="text-xs ml-1">CSV är mindre filstorlek men Excel bevarar dataformat bättre</span>
              </li>
              <li>
                <span className="font-medium">Känslighet:</span>
                <span className="text-xs ml-1">Exporterade filer kan innehålla känslig kundinformation - hantera dem säkert</span>
              </li>
              <li>
                <span className="font-medium">Relationer:</span>
                <span className="text-xs ml-1">Aktivera "Inkludera relationer" för att se kopplingar mellan kunder och ärenden</span>
              </li>
            </ul>
          </AccordionItem>
          
          <AccordionItem key="gdpr" title="GDPR och datasäkerhet">
            <div className="text-sm text-default-500">
              <p className="mb-2">
                När du exporterar data från systemet är det viktigt att tänka på GDPR och datasäkerhet:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Exporterade filer innehåller personuppgifter och måste hanteras säkert</li>
                <li>Spara inte exporterade filer längre än nödvändigt</li>
                <li>Dela inte exporterade filer via osäkra kanaler</li>
                <li>Om du behandlar exporterad data för andra ändamål, säkerställ att det är förenligt med GDPR</li>
              </ul>
            </div>
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
};

export default ExportInfo;