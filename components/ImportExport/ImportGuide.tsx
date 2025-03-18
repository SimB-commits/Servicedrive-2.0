import React from 'react';
import { Card, CardHeader, CardBody, Divider, Accordion, AccordionItem } from '@heroui/react';

const ImportGuide = () => {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-medium">Importguide</h3>
      </CardHeader>
      <CardBody>
        <Accordion variant="splitted">
          <AccordionItem key="customerFormat" title="Format för kundfiler">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-default-500 mb-2">
                  Filen bör innehålla följande fält:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 text-default-500 mb-2">
                  <li><strong>firstName</strong> - Kundens förnamn</li>
                  <li><strong>lastName</strong> - Kundens efternamn</li>
                  <li><strong>email</strong> - Kundens e-postadress (obligatoriskt)</li>
                  <li><strong>phoneNumber</strong> - Telefonnummer</li>
                  <li><strong>externalId</strong> - Externt ID från annat system (för koppling till ärenden)</li>
                </ul>
                <p className="text-sm text-default-500 mb-2">
                  Andra tillgängliga fält:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 text-default-500">  
                  <li><strong>address</strong> - Postadress</li>
                  <li><strong>postalCode</strong> - Postnummer</li>
                  <li><strong>city</strong> - Ort</li>
                  <li><strong>country</strong> - Land</li>
                  <li><strong>dateOfBirth</strong> - Födelsedatum</li>
                  <li><strong>newsletter</strong> - Nyhetsbrev (true/false)</li>
                  <li><strong>loyal</strong> - Stamkund (true/false)</li>
                </ul>
              </div>
            </div>
          </AccordionItem>
          
          <AccordionItem key="ticketFormat" title="Format för ärendefiler">
            <div className="space-y-4">
              <div className="bg-primary-50 p-3 rounded mb-4">
                <p className="text-sm font-medium text-primary">Viktigt om ärendetyper:</p>
                <p className="text-sm text-primary-700">
                  Innan du importerar ärenden, skapa först en ärendetyp i systemet. En ärendetyp innehåller fält som 
                  du själv definierar under "Ärendetyper". Det är dessa egna fält som måste matchas i importfilen.
                </p>
              </div>
              
              <h5 className="text-sm font-medium mb-1">Grundläggande fält</h5>
              <ul className="list-disc list-inside text-sm space-y-1 text-default-500 mb-2">
                <li><strong>status</strong> - Ärendestatus (OPEN, IN_PROGRESS, RESOLVED, CLOSED)</li>
                <li><strong>dueDate</strong> - Deadline (YYYY-MM-DD)</li>
              </ul>
              
              <h5 className="text-sm font-medium mt-3 mb-1">Kundreferenser (minst en måste finnas)</h5>
              <ul className="list-disc list-inside text-sm space-y-1 text-default-500 mb-2">
                <li><strong>customerEmail</strong> - Kopplar ärendet till kund via e-post</li>
                <li><strong>customer_external_id</strong> / <strong>externalId</strong> - Kopplar ärendet till kund via externt ID (rekommenderas)</li>
              </ul>
              
              <h5 className="text-sm font-medium mt-3 mb-1">Anpassade fält (de fält du skapat i ärendetypen)</h5>
              <ul className="list-disc list-inside text-sm space-y-1 text-default-500 mb-2">
                <li><strong>field_[Ditt fältnamn]</strong> - Varje kolumn med "field_" prefix motsvarar ett fält du skapat i ärendetypen</li>
                <li>Exempel: Om du skapat fältet "Skida" i ärendetypen, ska kolumnen heta <code>field_Skida</code> i importfilen</li>
                <li>Exempel: Om du skapat fältet "Kommentar" i ärendetypen, ska kolumnen heta <code>field_Kommentar</code></li>
              </ul>
              <div className="bg-warning-50 p-3 rounded mt-1">
                <p className="text-xs font-medium text-warning-600">
                  Viktigt att förstå:
                </p>
                <p className="text-xs text-warning-700">
                  Det är de anpassade fälten du själv skapat i ärendetypen (under "Ärendetyper" i menyn) som är det som faktiskt 
                  visas i systemet. Dessa fält måste finnas med "field_" prefix i importfilen.
                </p>
              </div>
              
              <h5 className="text-sm font-medium mt-3 mb-1">Datumfält för historik</h5>
              <ul className="list-disc list-inside text-sm space-y-1 text-default-500">
                <li><strong>createdAt</strong> - Behåller originaldatum för ärendets skapande</li>
                <li><strong>updatedAt</strong> - Behåller originaldatum för senaste uppdatering</li>
              </ul>
            </div>
          </AccordionItem>
          
          <AccordionItem key="examples" title="Exempel på ärendeimport">
            <div>
              <p className="text-sm text-default-600 mb-2">
                Antag att du skapat en ärendetyp "Skidservice" med tre fält: "Skida", "Sulmått" och "Kommentar".
                Då kan din importfil se ut så här:
              </p>
              <div className="overflow-x-auto mb-2">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-default-100">
                      <th className="px-2 py-1 border">customer_external_id</th>
                      <th className="px-2 py-1 border">status</th>
                      <th className="px-2 py-1 border">field_Skida</th>
                      <th className="px-2 py-1 border">field_Sulmått</th>
                      <th className="px-2 py-1 border">field_Kommentar</th>
                      <th className="px-2 py-1 border">dueDate</th>
                      <th className="px-2 py-1 border">createdAt</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-1 border">12345</td>
                      <td className="px-2 py-1 border">OPEN</td>
                      <td className="px-2 py-1 border">Atomic</td>
                      <td className="px-2 py-1 border">306mm</td>
                      <td className="px-2 py-1 border">Brådskande</td>
                      <td className="px-2 py-1 border">2025-04-01</td>
                      <td className="px-2 py-1 border">2025-03-10</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 border">67890</td>
                      <td className="px-2 py-1 border">CLOSED</td>
                      <td className="px-2 py-1 border">Fischer</td>
                      <td className="px-2 py-1 border">315mm</td>
                      <td className="px-2 py-1 border">Klart</td>
                      <td className="px-2 py-1 border">2025-03-15</td>
                      <td className="px-2 py-1 border">2025-03-01</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-default-500 italic">
                Observera att kolumnerna "field_Skida", "field_Sulmått" och "field_Kommentar" 
                motsvarar fälten "Skida", "Sulmått" och "Kommentar" som du har skapat i ärendetypen.
              </p>
            </div>
          </AccordionItem>
          
          <AccordionItem key="instructions" title="Steg för steg-instruktion">
            <ol className="list-decimal list-inside text-sm space-y-2 text-default-600">
              <li className="font-medium">Skapa ärendetyp först:
                <ul className="list-disc list-inside text-xs ml-5 mt-1 space-y-1 text-default-500">
                  <li>Gå till "Ärendetyper" i menyn</li>
                  <li>Klicka på "Skapa ny ärendetyp"</li>
                  <li>Namnge ärendetypen och skapa de fält du behöver (t.ex. "Skida", "Sulmått", "Kommentar")</li>
                </ul>
              </li>
              <li className="font-medium">Förbered importfilen:
                <ul className="list-disc list-inside text-xs ml-5 mt-1 space-y-1 text-default-500">
                  <li>Skapa en CSV eller Excel-fil där kolumnrubrikerna matchar systemets fält</li>
                  <li>För egna fält i ärendetypen, använd prefix "field_" (t.ex. "field_Skida")</li>
                  <li>Säkerställ att kunderna antingen finns i systemet, eller importera dem först</li>
                </ul>
              </li>
              <li className="font-medium">Importera data:
                <ul className="list-disc list-inside text-xs ml-5 mt-1 space-y-1 text-default-500">
                  <li>Välj rätt importmål (Kunder eller Ärenden)</li>
                  <li>Ladda upp din fil</li>
                  <li>Kontrollera att kolumnmappningen stämmer</li>
                  <li>Starta importen</li>
                </ul>
              </li>
            </ol>
          </AccordionItem>
          
          <AccordionItem key="tips" title="Tips för lyckad import">
            <div className="space-y-2">
              <ul className="list-disc list-inside text-sm space-y-2 text-default-600">
                <li>
                  <span className="font-medium">Rätt ärendetyp:</span>
                  <span className="block text-xs ml-5">Skapa en ärendetyp vars fält exakt motsvarar informationen du vill importera</span>
                </li>
                <li>
                  <span className="font-medium">Kunder måste finnas:</span>
                  <span className="block text-xs ml-5">Importera kunder före ärenden och se till att de har rätt externt ID</span>
                </li>
                <li>
                  <span className="font-medium">Använd externt ID:</span>
                  <span className="block text-xs ml-5">Att koppla ärenden till kunder via externt ID är mer robust än via e-post</span>
                </li>
                <li>
                  <span className="font-medium">Fältnamn måste matcha:</span>
                  <span className="block text-xs ml-5">Om du har ett fält "Sulmått" i ärendetypen, måste kolumnen heta "field_Sulmått" i importfilen</span>
                </li>
                <li>
                  <span className="font-medium">Dataformat:</span>
                  <span className="block text-xs ml-5">
                    - Datum: YYYY-MM-DD eller MM/DD/YYYY<br />
                    - Boolean-värden: true/false, 1/0, yes/no, eller ja/nej
                  </span>
                </li>
                <li>
                  <span className="font-medium">Stora datamängder:</span>
                  <span className="block text-xs ml-5">Dela upp i mindre filer vid behov (max 500 rader rekommenderas)</span>
                </li>
                <li>
                  <span className="font-medium">Kontrollera mappning:</span>
                  <span className="block text-xs ml-5">Verifiera fältmappningen innan du startar importen</span>
                </li>
              </ul>
              
              <div className="bg-success-50 p-3 rounded mt-2">
                <h5 className="font-medium text-success-600 text-sm">Kom ihåg</h5>
                <p className="text-xs text-default-600 mt-1">
                  Om kunderna har ett kund-ID i källsystemet, se till att det finns med i importen och mappas mot "externalId"
                  så att du senare kan koppla ärenden till kunderna via detta ID.
                </p>
              </div>
            </div>
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
};

export default ImportGuide;