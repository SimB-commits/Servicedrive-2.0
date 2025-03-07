import React from 'react';
import { Spinner, Card, CardBody } from '@heroui/react';

interface ExportStatusIndicatorProps {
  status: 'idle' | 'loading' | 'success' | 'error';
}

const ExportStatusIndicator: React.FC<ExportStatusIndicatorProps> = ({ status }) => {
  if (status === 'idle') {
    return null;
  }

  // Välj färg och ikon baserat på status
  const getStatusConfig = () => {
    switch (status) {
      case 'loading':
        return {
          color: 'primary',
          backgroundColor: 'bg-primary-50',
          borderColor: 'border-primary-200',
          icon: <Spinner size="sm" color="primary" />,
          title: 'Export pågår',
          message: 'Förbereder och skapar exportfil. Detta kan ta några sekunder...'
        };
      case 'success':
        return {
          color: 'text-success',
          backgroundColor: 'bg-success-50',
          borderColor: 'border-success-200',
          icon: (
            <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          ),
          title: 'Export slutförd!',
          message: 'Filen har laddats ner till din dator.'
        };
      case 'error':
        return {
          color: 'text-danger',
          backgroundColor: 'bg-danger-50',
          borderColor: 'border-danger-200',
          icon: (
            <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          ),
          title: 'Export misslyckades',
          message: 'Ett fel inträffade vid export. Försök igen eller kontakta support om problemet kvarstår.'
        };
      default:
        return {
          color: 'text-default-500',
          backgroundColor: 'bg-default-50',
          borderColor: 'border-default-200',
          icon: null,
          title: 'Status',
          message: 'Okänd status'
        };
    }
  };

  const { color, backgroundColor, borderColor, icon, title, message } = getStatusConfig();

  return (
    <Card className={`my-4 ${backgroundColor} border ${borderColor}`}>
      <CardBody className="py-3">
        <div className="flex items-center">
          <div className="mr-3">
            {icon}
          </div>
          <div>
            <h4 className={`font-medium ${color}`}>{title}</h4>
            <p className="text-sm text-default-600">{message}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default ExportStatusIndicator;