// components/email/DomainVerificationStatus.tsx
import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  Button, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
  Popover,
  PopoverTrigger,
  PopoverContent
} from '@heroui/react';

interface DomainProps {
  domain: {
    id: string | number;
    domain: string;
    status: string;
    verified: boolean;
    createdAt?: string;
    dkimStatus?: string;
    spfStatus?: string;
    subdomains?: string[];
  };
  onDelete: () => void;
}

const DomainVerificationStatus: React.FC<DomainProps> = ({ domain, onDelete }) => {
  const [showDetails, setShowDetails] = useState(false);

  // Beräkna status för domänen
  const getStatusColor = () => {
    if (domain.verified) {
      return 'bg-success-500';
    } else if (domain.status === 'pending') {
      return 'bg-warning-500';
    } else {
      return 'bg-danger-500';
    }
  };

  const getStatusText = () => {
    if (domain.verified) {
      return 'Verifierad';
    } else if (domain.status === 'pending') {
      return 'Väntar på verifiering';
    } else {
      return 'Misslyckad';
    }
  };

  // Formatera datum
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Okänt datum';
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
          <div>
            <h3 className="font-medium">{domain.domain}</h3>
            <p className="text-sm text-default-500">
              {getStatusText()} • {domain.subdomains?.length || 0} subdomäner
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="flat"
            onPress={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Dölj detaljer' : 'Visa detaljer'}
          </Button>
          
          <Popover placement="left">
            <PopoverTrigger>
              <Button 
                size="sm" 
                variant="flat" 
                color="danger"
              >
                Ta bort
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <div className="px-1 py-2">
                <div className="text-sm font-semibold mb-2">Bekräfta borttagning</div>
                <p className="text-sm mb-3">
                  Är du säker på att du vill ta bort denna domän? Detta kommer att påverka mailutskick från denna domän.
                </p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="flat">Avbryt</Button>
                  <Button size="sm" color="danger" onPress={onDelete}>Ta bort</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {showDetails && (
        <div className="border-t px-4 py-3 bg-default-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-default-500">Skapad</p>
              <p className="text-sm">{formatDate(domain.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-default-500">DKIM Status</p>
              <p className="text-sm">{domain.dkimStatus || 'Okänd'}</p>
            </div>
            <div>
              <p className="text-xs text-default-500">SPF Status</p>
              <p className="text-sm">{domain.spfStatus || 'Okänd'}</p>
            </div>
          </div>
          
          {domain.subdomains && domain.subdomains.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-default-500 mb-1">Verifierade subdomäner</p>
              <div className="flex flex-wrap gap-2">
                {domain.subdomains.map((subdomain, i) => (
                  <span key={i} className="inline-block px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-md">
                    {subdomain}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DomainVerificationStatus;