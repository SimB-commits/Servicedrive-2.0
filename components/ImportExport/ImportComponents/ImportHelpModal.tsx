// components/ImportExport/ImportComponents/ImportHelpModal.tsx
import React from 'react';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Divider,
  Accordion,
  AccordionItem
} from '@heroui/react';

interface ImportHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  importTarget: 'customers' | 'tickets';
}

const ImportHelpModal: React.FC<ImportHelpModalProps> = ({ 
  isOpen, 
  onClose,
  importTarget 
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-bold">Hjälp: Import av {importTarget === 'customers' ? 'kunder' : 'ärenden'}</h3>
            <p className="text-sm text-default-500">
              Förklaring av importalternativ och hur uppdateringar av befintliga poster hanteras
            </p>
          </div>
        </ModalHeader>
        <ModalBody>
          <Accordion variant="splitted">
            <AccordionItem 
              key="import-options" 
              title="Importalternativ - Förklaring"
              subtitle="Skillnad mellan att hoppa över och uppdatera befintliga"
            >
              <div className="space-y-4">
                <p>
                  När du importerar {importTarget === 'customers' ? 'kunder' : 'ärenden'} har du olika alternativ för att hantera poster som redan finns i systemet:
                </p>
                
                <Table aria-label="Importalternativ">
                  <TableHeader>
                    <TableColumn>Alternativ</TableColumn>
                    <TableColumn>Beskrivning</TableColumn>
                    <TableColumn>Användning</TableColumn>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Hoppa över befintliga</TableCell>
                      <TableCell>
                        Befintliga poster identifieras och räknas som framgångsrikt importerade, men ingen data uppdateras.
                      </TableCell>
                      <TableCell>
                        Använd när du bara vill lägga till nya poster och behålla befintlig data oförändrad.
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Uppdatera befintliga</TableCell>
                      <TableCell>
                        Befintliga poster uppdateras med ny information från importfilen. Endast fält som finns i importfilen uppdateras.
                      </TableCell>
                      <TableCell>
                        Använd när du vill uppdatera information för befintliga poster med nya data från importfilen.
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Inkludera alla fält</TableCell>
                      <TableCell>
                        Importerar alla kolumner från filen, även de som inte är direkt mappade.
                      </TableCell>
                      <TableCell>
                        Användbart för dynamiska eller anpassade fält.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </AccordionItem>
            
            <AccordionItem 
              key="existing-identification" 
              title="Hur befintliga poster identifieras"
              subtitle="Matchning via e-post, externa ID eller ärendenummer"
            >
              <div className="space-y-4">
                {importTarget === 'customers' ? (
                  <>
                    <p className="font-medium">För kunder, använder systemet följande för att identifiera befintliga poster:</p>
                    <ol className="list-decimal list-inside space-y-2 pl-2">
                      <li>
                        <span className="font-medium">E-postadress (primär)</span>
                        <p className="ml-6 text-sm text-default-500">Om en kund med samma e-post finns i butiken.</p>
                      </li>
                      <li>
                        <span className="font-medium">Externt ID</span>
                        <p className="ml-6 text-sm text-default-500">
                          Om importdatan innehåller ett externt ID (externalId, external_id, customer_id, kundnummer) 
                          och det matchar en befintlig kund.
                        </p>
                      </li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p className="font-medium">För ärenden, använder systemet följande för att identifiera befintliga poster:</p>
                    <ol className="list-decimal list-inside space-y-2 pl-2">
                      <li>
                        <span className="font-medium">Ärende-ID</span>
                        <p className="ml-6 text-sm text-default-500">Om ett internt ID anges i importdatan.</p>
                      </li>
                      <li>
                        <span className="font-medium">Extern ärendesreferens</span>
                        <p className="ml-6 text-sm text-default-500">
                          Om importdatan innehåller externt ID eller ärendesreferens som matchar befintliga ärenden.
                        </p>
                      </li>
                      <li>
                        <span className="font-medium">Kundkoppling + ärendereferens</span>
                        <p className="ml-6 text-sm text-default-500">
                          Kombination av kund och referens/titel som tillsammans identifierar ett unikt ärende.
                        </p>
                      </li>
                    </ol>
                  </>
                )}
              </div>
            </AccordionItem>
            
            <AccordionItem 
              key="update-behavior" 
              title="Uppdateringsbeteende i detalj"
              subtitle="Hur värden uppdateras när 'Uppdatera befintliga' är aktiverat"
            >
              <div className="space-y-4">
                <p>
                  När "Uppdatera befintliga" är aktiverat, följer systemet dessa principer:
                </p>
                
                <div className="space-y-2 mb-4">
                  <div className="p-3 bg-success-50 rounded-md">
                    <h5 className="font-medium">Vad uppdateras</h5>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Endast fält som finns i importfilen och har mappats uppdateras</li>
                      <li>Endast fält med värden uppdateras (tomma fält i importfilen ignoreras)</li>
                      <li>Dynamiska fält uppdateras enligt principen "lägg till/uppdatera men ta inte bort"</li>
                    </ul>
                  </div>
                  
                  <div className="p-3 bg-danger-50 rounded-md">
                    <h5 className="font-medium">Vad uppdateras INTE</h5>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Fält som inte finns med i importfilen behåller sina befintliga värden</li>
                      <li>Tomma fält i importfilen ignoreras (de överskriver inte befintliga värden)</li>
                      <li>ID-fält och systemfält kan inte uppdateras</li>
                    </ul>
                  </div>
                </div>
                
                <p className="font-medium">Exempel på uppdateringsbeteende:</p>
                <div className="overflow-x-auto">
                  <Table aria-label="Uppdateringsexempel">
                    <TableHeader>
                      <TableColumn>Fält</TableColumn>
                      <TableColumn>Befintligt värde</TableColumn>
                      <TableColumn>Värde i importfil</TableColumn>
                      <TableColumn>Resultat efter import</TableColumn>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Namn</TableCell>
                        <TableCell>Anna</TableCell>
                        <TableCell>Maria</TableCell>
                        <TableCell className="font-medium">Maria</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Telefon</TableCell>
                        <TableCell>0701234567</TableCell>
                        <TableCell>(tomt)</TableCell>
                        <TableCell className="font-medium">0701234567 (oförändrat)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Adress</TableCell>
                        <TableCell>Storgatan 1</TableCell>
                        <TableCell>Lillgatan 5</TableCell>
                        <TableCell className="font-medium">Lillgatan 5</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Dynamiska fält: "favoritfärg"</TableCell>
                        <TableCell>Blå</TableCell>
                        <TableCell>Röd</TableCell>
                        <TableCell className="font-medium">Röd</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Dynamiska fält: "medlemskap"</TableCell>
                        <TableCell>Guld</TableCell>
                        <TableCell>(ej med i importfil)</TableCell>
                        <TableCell className="font-medium">Guld (oförändrat)</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </AccordionItem>
            
            <AccordionItem 
              key="data-validation" 
              title="Datavalidering"
              subtitle="Hur ungiltiga eller felaktiga data hanteras"
            >
              <div className="space-y-4">
                <p>
                  Under importen utför systemet följande valideringar:
                </p>
                
                <ul className="list-disc list-inside space-y-1">
                  <li>E-postadresser valideras för korrekt format</li>
                  <li>Datum konverteras till standardformat (om möjligt)</li>
                  <li>Dynamiska fält valideras enligt ärendetypen (för ärenden)</li>
                  <li>Numeriska fält valideras för korrekt format</li>
                </ul>
                
                <p className="font-medium mt-4">Felhantering:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Rader med allvarliga valideringsfel hoppar över importen</li>
                  <li>Mindre fel kan korrigeras automatiskt (t.ex. trimning av mellanslag)</li>
                  <li>Alla fel rapporteras i importsammanfattningen</li>
                </ul>
              </div>
            </AccordionItem>
          </Accordion>
        </ModalBody>
        <ModalFooter>
          <Button 
            color="primary" 
            onPress={onClose}
          >
            Stäng
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ImportHelpModal;