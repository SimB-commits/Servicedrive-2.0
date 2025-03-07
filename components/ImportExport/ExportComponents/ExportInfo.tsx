import React from 'react';
import { Card, CardHeader, CardBody, Divider } from '@heroui/react';

const ExportInfo = () => {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-medium">Exportinformation</h3>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Exportformat</h4>
            <div className="space-y-2 mt-2">
              <div className="p-2 bg-default-100 rounded-md">
                <h5 className="font-medium">CSV</h5>
                <p className="text-sm text-default-500">
                  Kommaseparerade värden som kan öppnas i Excel eller Google Sheets.
                  Bra för dataanalys eller import till andra system.
                </p>
              </div>
              
              <div className="p-2 bg-default-100 rounded-md">
                <h5 className="font-medium">Excel</h5>
                <p className="text-sm text-default-500">
                  Microsoft Excel-format (.xlsx) som bevarar formateringar och datatyper.
                  Bäst för användare som vill arbeta med data i Excel.
                </p>
              </div>
              
              <div className="p-2 bg-default-100 rounded-md">
                <h5 className="font-medium">JSON</h5>
                <p className="text-sm text-default-500">
                  Strukturerat dataformat som används för dataöverföring mellan system.
                  Bäst för utvecklare eller för import till andra system.
                </p>
              </div>
            </div>
          </div>
          
          <Divider />
          
          <div>
            <h4 className="font-medium">Inkluderad data</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-start gap-2">
                <div className="font-medium min-w-24">Kunder:</div>
                <div className="text-sm text-default-500">
                  All kundinformation inklusive namn, kontaktuppgifter och anpassade fält
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="font-medium min-w-24">Ärenden:</div>
                <div className="text-sm text-default-500">
                  Ärendeinformation inklusive status, deadline, och kundkopplingar
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="font-medium min-w-24">All data:</div>
                <div className="text-sm text-default-500">
                  Både kunder och ärenden med relationer mellan dem
                </div>
              </div>
            </div>
          </div>
          
          <Divider />
          
          <div>
            <h4 className="font-medium">Tips för export</h4>
            <ul className="list-disc list-inside text-sm space-y-1 text-default-500 mt-2">
              <li>Exportera regelbundet för att skapa säkerhetskopior av din data</li>
              <li>Exportera i alla tre format om du är osäker på vilket som behövs</li>
              <li>För stora databaser kan exporten ta längre tid att slutföra</li>
              <li>Exporterade filer kan innehålla känslig kundinformation - hantera dem säkert</li>
            </ul>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default ExportInfo;