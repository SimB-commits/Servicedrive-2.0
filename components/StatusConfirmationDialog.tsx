// components/StatusConfirmationDialog.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Checkbox,
} from '@heroui/react';

interface StatusConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sendEmail: boolean) => void;
  statusName: string;
  statusColor: string;
  ticketId: number;
  hasMailTemplate: boolean;
}

const StatusConfirmationDialog: React.FC<StatusConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  statusName,
  statusColor,
  ticketId,
  hasMailTemplate,
}) => {
  const [sendEmail, setSendEmail] = useState(true);

  // Logga för felsökning
  useEffect(() => {
    if (isOpen) {
      console.log('StatusConfirmationDialog öppnad med:', { 
        statusName, 
        hasMailTemplate 
      });
    }
  }, [isOpen, statusName, hasMailTemplate]);

  // Återställ checkboxen när dialogen öppnas
  useEffect(() => {
    if (isOpen) {
      setSendEmail(true);
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        <ModalHeader>
          <h2 className="text-lg font-semibold">Uppdatera status</h2>
        </ModalHeader>
        
        <ModalBody>
          <p className="mb-4">
            Du håller på att ändra status för ärende #{ticketId} till{' '}
            <span className="font-medium" style={{ color: statusColor }}>
              {statusName}
            </span>
          </p>
          
          {hasMailTemplate ? (
            <div className="mb-4 p-4 bg-info-50 border border-info-200 rounded">
              <p className="text-sm mb-3">
                Denna status har en kopplad mailmall. Vill du skicka ett automatiskt mail till kunden?
              </p>
              
              <Checkbox
                isSelected={sendEmail}
                onValueChange={setSendEmail}
              >
                Skicka mail till kunden
              </Checkbox>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-warning-50 border border-warning-200 rounded">
              <p className="text-sm">
                Denna status har ingen kopplad mailmall. Inget mail kommer att skickas till kunden.
              </p>
            </div>
          )}
        </ModalBody>
        
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Avbryt
          </Button>
          <Button color="primary" onPress={() => onConfirm(sendEmail)}>
            Uppdatera status
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default StatusConfirmationDialog;