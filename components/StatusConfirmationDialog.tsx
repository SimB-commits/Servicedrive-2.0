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
  Divider,
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

/**
 * Dialogruta för att bekräfta statusändringar och välja om mail ska skickas.
 * 
 * Visar tydlig information om ett mail kommer att skickas eller inte
 * baserat på om statusen har en kopplad mailmall.
 */
const StatusConfirmationDialog: React.FC<StatusConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  statusName,
  statusColor,
  ticketId,
  hasMailTemplate,
}) => {
  // State för om mail ska skickas till kunden
  const [sendEmail, setSendEmail] = useState(true);

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
          <div className="space-y-4">
            <p>
              Du håller på att ändra status för ärende <strong>#{ticketId}</strong> till{' '}
              <span className="font-medium px-2 py-1 rounded" style={{ 
                color: statusColor, 
                backgroundColor: `${statusColor}15` 
              }}>
                {statusName}
              </span>
            </p>
            
            <Divider className="my-2" />
            
            {hasMailTemplate ? (
              <div className="space-y-3">
                <div className="p-4 bg-info-50 border border-info-200 rounded">
                  <h3 className="text-sm font-medium text-info-700 mb-1">Mailnotifiering</h3>
                  <p className="text-sm text-info-700">
                    Denna status har en kopplad mailmall. Du kan välja om systemet ska 
                    skicka ett automatiskt mail till kunden om statusändringen.
                  </p>
                </div>
                
                <Checkbox
                  isSelected={sendEmail}
                  onValueChange={setSendEmail}
                  size="md"
                  className="items-start"
                >
                  <div className="ml-2">
                    <p className="font-medium">Skicka mail till kunden</p>
                    <p className="text-sm text-default-500">
                      Ett automatiskt mail kommer att skickas baserat på den kopplade mailmallen
                    </p>
                  </div>
                </Checkbox>
              </div>
            ) : (
              <div className="p-4 bg-warning-50 border border-warning-200 rounded">
                <h3 className="text-sm font-medium text-warning-700 mb-1">Ingen mailnotifiering</h3>
                <p className="text-sm text-warning-700">
                  Denna status har ingen kopplad mailmall. Inget mail kommer att skickas till kunden.
                </p>
                <div className="mt-2 text-xs text-warning-700">
                  <p>
                    <strong>Vill du konfigurera mail för denna status?</strong> Gå till 
                    Inställningar &gt; Ärendestatusar och koppla en mailmall till denna status.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Avbryt
          </Button>
          <Button 
            color="primary" 
            onPress={() => onConfirm(sendEmail && hasMailTemplate)}
          >
            {hasMailTemplate 
              ? sendEmail 
                ? "Uppdatera & skicka mail" 
                : "Uppdatera utan mail"
              : "Uppdatera status"
            }
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default StatusConfirmationDialog;