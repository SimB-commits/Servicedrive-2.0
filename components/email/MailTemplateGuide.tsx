// components/email/MailTemplateGuide.tsx
import React from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Accordion,
  AccordionItem,
  Divider
} from '@heroui/react';

const MailTemplateGuide: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Guide för mailsystemet</h2>
        <p className="text-default-500 text-sm">
          Lär dig hur du använder mailsystemet i Servicedrive effektivt.
        </p>
      </CardHeader>
      
      <CardBody>
        <Accordion>
          <AccordionItem 
            key="overview" 
            title="Översikt över mailsystemet"
            subtitle="Hur mailsystemet fungerar"
          >
            <div className="prose prose-sm max-w-none pb-4">
              <p>
                Servicedrive har ett flexibelt system för mailutskick med flera olika delar som 
                samverkar:
              </p>
              
              <ol>
                <li>
                  <strong>Mailmallar</strong> - Innehåller ämne och text som kan anpassas med 
                  variabler för att automatiskt skapa personliga mail.
                </li>
                <li>
                  <strong>Statusbundna mailmallar</strong> - Kopplingar mellan ärendestatusar och 
                  mailmallar som skickar mail automatiskt när ett ärende byter status. Status utan 
                  kopplad mall skickar inga automatiska mail.
                </li>
                <li>
                  <strong>Avsändaradresser</strong> - Konfigurera vilka e-postadresser som används 
                  som avsändare i mail.
                </li>
                <li>
                  <strong>Generella mallinställningar</strong> - Systemövergripande inställningar 
                  för när olika typer av mail ska skickas.
                </li>
              </ol>
              
              <p>
                Alla dessa delar arbetar tillsammans för att skapa ett anpassat, automatiserat 
                e-postflöde för din verksamhet.
              </p>
            </div>
          </AccordionItem>
          
          <AccordionItem 
            key="variables" 
            title="Använda variabler i mailmallar"
            subtitle="Anpassa dina utskick med dynamisk information"
          >
            <div className="prose prose-sm max-w-none pb-4">
              <p>
                Variabler gör det möjligt att skapa personliga och relevanta mail automatiskt. 
                Variabler skrivs i formatet <code>{'{variabelNamn}'}</code> och ersätts med verklig 
                information när mailet skickas.
              </p>
              
              <h4>Tillgängliga variabler</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <p className="font-medium">Kundvariabler:</p>
                  <ul className="list-disc list-inside text-sm">
                    <li><code>{'{kundNamn}'}</code> - Kundens fullständiga namn</li>
                    <li><code>{'{kundEmail}'}</code> - Kundens e-postadress</li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-medium">Ärendevariabler:</p>
                  <ul className="list-disc list-inside text-sm">
                    <li><code>{'{ärendeID}'}</code> - Ärendets ID-nummer</li>
                    <li><code>{'{ärendeTyp}'}</code> - Typ av ärende</li>
                    <li><code>{'{ärendeStatus}'}</code> - Ärendets status</li>
                    <li><code>{'{deadline}'}</code> - Ärendets deadline (om satt)</li>
                    <li><code>{'{ärendeDatum}'}</code> - När ärendet skapades</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="font-medium">Övriga variabler:</p>
                <ul className="list-disc list-inside text-sm">
                  <li><code>{'{handläggare}'}</code> - Namnet på handläggaren</li>
                  <li><code>{'{handläggareEmail}'}</code> - Handläggarens e-post</li>
                  <li><code>{'{företagsNamn}'}</code> - Företagsnamnet</li>
                  <li><code>{'{aktuellDatum}'}</code> - Dagens datum</li>
                  <li><code>{'{gammalStatus}'}</code> - Tidigare status (vid statusändring)</li>
                  <li><code>{'{ärendeLänk}'}</code> - Länk till ärendet (om tillgängligt)</li>
                </ul>
              </div>
              
              <p className="mt-4">
                <strong>Exempel:</strong> "Hej {'{kundNamn}'}! Ditt ärende #{'{ärendeID}'} 
                har nu statusen {'{ärendeStatus}'}."
              </p>
            </div>
          </AccordionItem>
          
          <AccordionItem 
            key="automatic" 
            title="Automatiska mail och triggers"
            subtitle="När skickas mail automatiskt"
          >
            <div className="prose prose-sm max-w-none pb-4">
              <p>
                Systemet kan skicka mail automatiskt vid flera olika händelser:
              </p>
              
              <h4>1. Nytt ärende skapas</h4>
              <p>
                När ett nytt ärende skapas kan systemet skicka ett bekräftelsemail till kunden.
                Konfigurera detta under Mallinställningar med användningsområde "NEW_TICKET".
              </p>
              
              <h4>2. Ärende byter status</h4>
              <p>
                När ett ärende byter status skickas mail endast om statusen har en specifik
                mailmall kopplad till sig. Konfigurera detta individuellt under Ärendestatusar
                när du skapar eller redigerar en status.
              </p>
              <div className="p-3 bg-info-50 border border-info-200 rounded">
                <p className="text-sm text-info-700">
                  <strong>OBS!</strong> Om en status saknar kopplad mailmall skickas inget
                  automatiskt mail när ärenden får denna status.
                </p>
              </div>
              
              <h4>3. Påminnelser och uppföljningar</h4>
              <p>
                Systemet kan även skicka automatiska påminnelser för ärenden som närmar sig deadline
                (användningsområde "REMINDER") och uppföljningar efter att ett ärende har stängts
                (användningsområde "FOLLOW_UP").
              </p>
              
              <Divider className="my-4" />
              
              <p>
                <strong>Tips:</strong> För att se vilka mallar som är konfigurerade för automatiska 
                utskick, gå till fliken "Mailmallar" och se under "Mallinställningar". För statusspecifika
                mallar, gå till fliken "Ärendestatusar" och granska de konfigurerade statusarna.
              </p>
            </div>
          </AccordionItem>
          
          <AccordionItem 
            key="domains" 
            title="Domänverifiering och avsändaradresser"
            subtitle="Konfigurera dina avsändaradresser"
          >
            <div className="prose prose-sm max-w-none pb-4">
              <p>
                För att skicka mail från dina egna e-postadresser behöver du först verifiera 
                din domän:
              </p>
              
              <ol>
                <li>
                  Gå till <strong>Inställningar &gt; Domänverifiering</strong>
                </li>
                <li>
                  Följ stegen för att verifiera din domän genom att lägga till DNS-poster
                </li>
                <li>
                  När domänen är verifierad kan du konfigurera avsändaradresser på fliken
                  "Avsändarinställningar"
                </li>
              </ol>
              
              <p>
                <strong>Standardavsändare:</strong> Du kan välja en standardavsändare som 
                kommer att användas för alla automatiska utskick om ingen annan avsändare anges.
              </p>
              
              <p>
                <strong>Säkerhetsinformation:</strong> Av säkerhetsskäl kan du endast 
                använda e-postadresser från verifierade domäner som avsändare. Detta förhindrar
                att systemet kan användas för att skicka spam eller spoofade mail.
              </p>
            </div>
          </AccordionItem>
          
          <AccordionItem 
            key="testing" 
            title="Testa dina mailmallar"
            subtitle="Så kontrollerar du att dina mallar fungerar"
          >
            <div className="prose prose-sm max-w-none pb-4">
              <p>
                Innan du använder en mall i produktionen bör du alltid testa den först.
                Servicedrive erbjuder två olika sätt att testa dina mallar:
              </p>
              
              <h4>1. Förhandsgranskning</h4>
              <p>
                Förhandsgranskning visar hur mallen ser ut med exempeldata.
                Klicka på "Förhandsgranska" i åtgärdsmenyn för en mall för att se hur 
                den kommer att se ut med olika variabler infogade.
              </p>
              
              <h4>2. Skicka testmail</h4>
              <p>
                För att skicka ett faktiskt testmail:
              </p>
              <ol>
                <li>Klicka på "Testa" vid mallen du vill testa</li>
                <li>Välj om du vill testa med data från ett befintligt ärende eller ange en anpassad e-postadress</li>
                <li>Justera eventuella variabler i "Variabler"-tabben</li>
                <li>Klicka på "Skicka mail" för att skicka ett testmail</li>
              </ol>
              
              <p>
                <strong>Tips:</strong> Vi rekommenderar att du testar alla automatiska mallar 
                innan du börjar använda dem, särskilt när de innehåller komplexa variabelstrukturer.
              </p>
            </div>
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
};

export default MailTemplateGuide;