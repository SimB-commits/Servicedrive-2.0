// components/email/DnsRecord.tsx
import React, { useState } from 'react';
import { Button } from '@heroui/react';

interface DnsRecordProps {
  record: {
    type: string;
    host: string;
    data: string;
    name?: string;
    priority?: number;
  };
}

const DnsRecord: React.FC<DnsRecordProps> = ({ record }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (err) => {
        console.error('Kunde inte kopiera text: ', err);
      }
    );
  };

  return (
    <div className="border rounded-md p-4 bg-default-50">
      <div className="flex flex-col md:flex-row md:items-center mb-3">
        <div className="flex-shrink-0 mb-2 md:mb-0 md:mr-4">
          <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 font-medium rounded-full text-xs">
            {record.type}
          </span>
        </div>
        <div className="flex-grow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <p className="text-xs text-default-500 mb-1">Namn/Host</p>
              <p className="font-mono text-sm break-all">{record.host}</p>
            </div>
            
            {record.type === 'MX' && record.priority !== undefined && (
              <div>
                <p className="text-xs text-default-500 mb-1">Prioritet</p>
                <p className="font-mono text-sm">{record.priority}</p>
              </div>
            )}
            
            <div className={record.type === 'MX' ? 'md:col-span-1' : 'md:col-span-2'}>
              <p className="text-xs text-default-500 mb-1">Värde/Peka till</p>
              <p className="font-mono text-sm break-all">{record.data}</p>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 mt-3 md:mt-0 md:ml-4">
          <Button
            size="sm"
            variant="flat"
            color={copied ? "success" : "primary"}
            onPress={() => copyToClipboard(record.data)}
          >
            {copied ? "Kopierat!" : "Kopiera värde"}
          </Button>
        </div>
      </div>
      
      {record.name && (
        <div className="mt-2 text-xs text-default-600">
          <strong>Notera:</strong> {record.name}
        </div>
      )}
    </div>
  );
};

export default DnsRecord;