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
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem
} from '@heroui/react';

interface FieldMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFields: string[];
  targetFields: string[];
  fieldMapping: Record<string, string>;
  updateFieldMapping: (sourceField: string, targetField: string) => void;
  previewData: any[] | null;
}

const FieldMappingModal: React.FC<FieldMappingModalProps> = ({
  isOpen,
  onClose,
  availableFields,
  targetFields,
  fieldMapping,
  updateFieldMapping,
  previewData
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onClose}
      scrollBehavior="inside"
      size="3xl"
    >
      <ModalContent>
        <ModalHeader>
          <h2 className="text-xl font-bold">Fältmappning</h2>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-default-500">
              Mappa källfält från din fil till motsvarande fält i systemet. 
              Vi har försökt göra automatiska mappningar men du bör kontrollera dem noga.
            </p>
            
            {/* Förhandsvisning av data */}
            {previewData && previewData.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Dataförhandsvisning</h3>
                <div className="overflow-x-auto">
                  <Table aria-label="Data preview" className="text-xs">
                    <TableHeader>
                      {Object.keys(previewData[0]).map((key) => (
                        <TableColumn key={key}>{key}</TableColumn>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {Object.keys(previewData[0]).map((key) => (
                            <TableCell key={key}>
                              {row[key] !== null && row[key] !== undefined ? String(row[key]) : '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            
            {/* Fältmappningstabell */}
            <div>
              <h3 className="font-medium mb-2">Fältmappning</h3>
              <Table aria-label="Field mapping">
                <TableHeader>
                  <TableColumn>Källfält</TableColumn>
                  <TableColumn>Målfält</TableColumn>
                  <TableColumn>Exempel</TableColumn>
                </TableHeader>
                <TableBody>
                  {availableFields.map((field) => {
                    // Hämta exempelvärde från första raden i data
                    const exampleValue = previewData && previewData.length > 0 
                      ? previewData[0][field] !== null && previewData[0][field] !== undefined 
                        ? String(previewData[0][field]) 
                        : '-'
                      : '-';
                      
                    return (
                      <TableRow key={field}>
                        <TableCell>{field}</TableCell>
                        <TableCell>
                          <Dropdown>
                            <DropdownTrigger>
                              <Button 
                                variant="flat" 
                                className="w-full justify-start"
                              >
                                {fieldMapping[field] || 'Välj målfält'}
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu>
                              <DropdownItem key="clear" onPress={() => updateFieldMapping(field, '')}>
                                -- Ignorera detta fält --
                              </DropdownItem>
                              {targetFields.map((targetField) => (
                                <DropdownItem 
                                  key={targetField} 
                                  onPress={() => updateFieldMapping(field, targetField)}
                                >
                                  {targetField}
                                </DropdownItem>
                              ))}
                            </DropdownMenu>
                          </Dropdown>
                        </TableCell>
                        <TableCell className="text-default-500">
                          {exampleValue}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button 
            variant="flat" 
            onPress={onClose}
          >
            Avbryt
          </Button>
          <Button 
            color="primary" 
            onPress={onClose}
          >
            Spara mappning
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default FieldMappingModal;
