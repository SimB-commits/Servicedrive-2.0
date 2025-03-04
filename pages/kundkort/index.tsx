// src/pages/kundkort/index.tsx
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  addToast,
  Form,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
  TableColumn,
  Input,
  Checkbox,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem
} from '@heroui/react';
import { title } from '@/components/primitives';
import { DeleteIcon, EditIcon } from '@/components/icons';

interface CustomerCardTemplate {
  id: number;
  cardName: string;
  dynamicFields: any;
  isDefault: boolean;
  createdAt: string;
}

interface Field {
  fieldName?: string;
  mapping: string; // e.g. "firstName", "lastName", "DYNAMIC"
  inputType?: string; // Only applicable if mapping === 'DYNAMIC'
  isRequired: boolean;
}

// Options for standard customer fields
const customerFieldOptions = [
  { value: 'firstName', label: 'Förnamn' },
  { value: 'lastName', label: 'Efternamn' },
  { value: 'address', label: 'Adress' },
  { value: 'postalCode', label: 'Postnummer' },
  { value: 'city', label: 'Ort' },
  { value: 'country', label: 'Land' },
  { value: 'dateOfBirth', label: 'Födelsedatum' },
  { value: 'email', label: 'E-post' },
  { value: 'phoneNumber', label: 'Telefon' },
  { value: 'newsletter', label: 'Nyhetsbrev' },
  { value: 'loyal', label: 'Stamkund' },
  { value: 'DYNAMIC', label: 'Eget fält' },
];

// Input type options for dynamic fields
const inputTypeOptions = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Siffror' },
  { value: 'DATE', label: 'Datum' },
];

export default function KundkortsmallPage() {
  const { data: session } = useSession();
  const [templates, setTemplates] = useState<CustomerCardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomerCardTemplate | null>(null);

  // Form state
  const [templateName, setTemplateName] = useState('');
  const [fields, setFields] = useState<Field[]>([
    { mapping: 'firstName', isRequired: true },
    { mapping: 'email', isRequired: true }
  ]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Edit form state
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editFields, setEditFields] = useState<Field[]>([]);

  // Fetch existing templates on component mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/customerCards');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      } else {
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte hämta kundkortsmallar',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid hämtning av mallar:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid hämtning av mallar',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setLoading(false);
    }
  };

  const addField = () => {
    setFields([...fields, { mapping: '', isRequired: false }]);
  };

  const addEditField = () => {
    setEditFields([...editFields, { mapping: '', isRequired: false }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const removeEditField = (index: number) => {
    setEditFields(editFields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updatedField: Partial<Field>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updatedField };
    setFields(newFields);
  };

  const updateEditField = (index: number, updatedField: Partial<Field>) => {
    const newFields = [...editFields];
    newFields[index] = { ...newFields[index], ...updatedField };
    setEditFields(newFields);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    // Validate form
    const errors: Record<string, string> = {};
    if (!templateName.trim()) {
      errors.templateName = 'Mall-namn är obligatoriskt';
    }

    fields.forEach((field, index) => {
      if (!field.mapping) {
        errors[`field_${index}_mapping`] = 'Fälttyp är obligatoriskt';
      }
      if (field.mapping === 'DYNAMIC' && !field.fieldName?.trim()) {
        errors[`field_${index}_fieldName`] = 'Namn för eget fält är obligatoriskt';
      }
      if (field.mapping === 'DYNAMIC' && !field.inputType) {
        errors[`field_${index}_inputType`] = 'Inputtyp är obligatoriskt för egna fält';
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Prepare the data for the API
    const dynamicFields: Record<string, string> = {};
    
    fields.forEach((field, index) => {
      const fieldData = {
        mapping: field.mapping,
        inputType: field.inputType,
        isRequired: field.isRequired,
        order: index // Add order information to maintain sequence
      };
      
      if (field.mapping === 'DYNAMIC' && field.fieldName) {
        dynamicFields[field.fieldName] = JSON.stringify(fieldData);
      } else {
        // Standard fields are included in the root of the payload
        dynamicFields[field.mapping] = JSON.stringify(fieldData);
      }
    });

    const payload = {
      cardName: templateName,
      dynamicFields
    };

    try {
      const response = await fetch('/api/customerCards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const newTemplate = await response.json();
        addToast({
          title: 'Framgång',
          description: 'Kundkortsmall skapades',
          color: 'success',
          variant: 'flat'
        });
        setTemplates([...templates, newTemplate]);
        setCreateModalOpen(false);
        resetForm();
      } else {
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte skapa mall',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid skapande av mall:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid skapande av mallen',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    // Similar validation as in handleSubmit
    const errors: Record<string, string> = {};
    if (!editTemplateName.trim()) {
      errors.editTemplateName = 'Mall-namn är obligatoriskt';
    }

    editFields.forEach((field, index) => {
      if (!field.mapping) {
        errors[`editField_${index}_mapping`] = 'Fälttyp är obligatoriskt';
      }
      if (field.mapping === 'DYNAMIC' && !field.fieldName?.trim()) {
        errors[`editField_${index}_fieldName`] = 'Namn för eget fält är obligatoriskt';
      }
      if (field.mapping === 'DYNAMIC' && !field.inputType) {
        errors[`editField_${index}_inputType`] = 'Inputtyp är obligatoriskt för egna fält';
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Prepare data for API
    const dynamicFields: Record<string, string> = {};
    
    editFields.forEach((field, index) => {
      const fieldData = {
        mapping: field.mapping,
        inputType: field.inputType,
        isRequired: field.isRequired,
        order: index // Add order information to maintain sequence
      };
      
      if (field.mapping === 'DYNAMIC' && field.fieldName) {
        dynamicFields[field.fieldName] = JSON.stringify(fieldData);
      } else {
        dynamicFields[field.mapping] = JSON.stringify(fieldData);
      }
    });

    const payload = {
      cardName: editTemplateName,
      dynamicFields
    };

    try {
      const response = await fetch(`/api/customerCards/${editingTemplate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const updatedTemplate = await response.json();
        addToast({
          title: 'Framgång',
          description: 'Mallen uppdaterades',
          color: 'success',
          variant: 'flat'
        });
        setTemplates(templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
        setEditModalOpen(false);
        setEditingTemplate(null);
      } else {
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte uppdatera mall',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid uppdatering av mall:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid uppdatering av mallen',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Är du säker på att du vill ta bort denna mall?')) return;

    try {
      const response = await fetch(`/api/customerCards/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        addToast({
          title: 'Framgång',
          description: 'Mallen togs bort',
          color: 'success',
          variant: 'flat'
        });
        setTemplates(templates.filter(t => t.id !== id));
      } else {
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte ta bort mall',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid borttagning av mall:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid borttagning av mallen',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      const response = await fetch(`/api/customerCards/${id}/setDefault`, {
        method: 'PUT'
      });

      if (response.ok) {
        addToast({
          title: 'Framgång',
          description: 'Standardmall uppdaterad',
          color: 'success',
          variant: 'flat'
        });
        // Update local state to reflect the change
        setTemplates(
          templates.map(t => ({
            ...t,
            isDefault: t.id === id
          }))
        );
      } else {
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte uppdatera standardmall',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid inställning av standardmall:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid uppdatering av standardmall',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const resetForm = () => {
    setTemplateName('');
    setFields([
      { mapping: 'firstName', isRequired: true },
      { mapping: 'email', isRequired: true }
    ]);
    setValidationErrors({});
  };

  const handleEditTemplate = (template: CustomerCardTemplate) => {
    setEditingTemplate(template);
    setEditTemplateName(template.cardName);
    
    // Parse the dynamic fields from the template
    const parsedFields: (Field & { order?: number })[] = [];
    if (template.dynamicFields) {
      Object.entries(template.dynamicFields).forEach(([key, value]) => {
        try {
          const fieldData = JSON.parse(value as string);
          if (fieldData.mapping === 'DYNAMIC') {
            parsedFields.push({
              fieldName: key,
              mapping: 'DYNAMIC',
              inputType: fieldData.inputType,
              isRequired: fieldData.isRequired,
              order: fieldData.order || 0
            });
          } else {
            parsedFields.push({
              mapping: fieldData.mapping,
              isRequired: fieldData.isRequired,
              order: fieldData.order || 0
            });
          }
        } catch (e) {
          console.error('Error parsing field data:', e);
        }
      });
      
      // Sort fields by their order property
      parsedFields.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    
    setEditFields(parsedFields.length > 0 ? parsedFields : [
      { mapping: 'firstName', isRequired: true },
      { mapping: 'email', isRequired: true }
    ]);
    
    setEditModalOpen(true);
  };

  if (!session) {
    return <div className="p-8">Vänligen logga in för att komma åt denna sida</div>;
  }

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center">
        <h1 className={title({ size: 'sm' })}>Kundkortsmallar</h1>
        <p className="mb-4">Skapa och hantera mallar för kundinformation</p>
        <Button 
          type="button" 
          onPress={() => setCreateModalOpen(true)} 
          color="primary"
          variant="flat"
        >
          Skapa ny mall
        </Button>
      </div>

      {/* Templates Table */}
      <div className="w-full max-w-6xl mt-8">
        <h2 className="text-lg font-semibold mb-4">Dina mallar</h2>
        {loading ? (
          <p>Laddar mallar...</p>
        ) : (
          <Table aria-label="Customer card templates">
            <TableHeader>
              <TableColumn>Namn</TableColumn>
              <TableColumn>Fält</TableColumn>
              <TableColumn>Standard</TableColumn>
              <TableColumn>Åtgärder</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Inga mallar skapade ännu.">
              {templates.map(template => (
                <TableRow key={template.id}>
                  <TableCell>{template.cardName}</TableCell>
                  <TableCell>
                    {template.dynamicFields ? (
                      <div className="max-h-24 overflow-y-auto">
                        {(() => {
                          // Extract and sort fields by order
                          const fields = Object.entries(template.dynamicFields)
                            .map(([key, value]) => {
                              try {
                                const fieldData = JSON.parse(value as string);
                                return {
                                  key,
                                  data: fieldData
                                };
                              } catch (e) {
                                return {
                                  key,
                                  data: { order: 999 } // Default high order for failed parsing
                                };
                              }
                            })
                            .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
                          
                          return fields.map(({ key, data }) => (
                            <div key={key} className="text-sm">
                              {data.mapping === 'DYNAMIC' ? key : 
                                customerFieldOptions.find(opt => opt.value === data.mapping)?.label || data.mapping}
                              {data.isRequired && <span className="text-danger ml-1">*</span>}
                            </div>
                          ));
                        })()}
                      </div>
                    ) : (
                      <span className="text-gray-500">Inga fält valda</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {template.isDefault ? (
                      <span className="text-success font-medium">Standard</span>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="flat" 
                        onPress={() => handleSetDefault(template.id)}
                      >
                        Sätt som standard
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        type="button" 
                        variant="flat" 
                        isIconOnly
                        onPress={() => handleEditTemplate(template)}
                      >
                        <EditIcon />
                      </Button>
                      <Button 
                        type="button" 
                        variant="flat" 
                        isIconOnly
                        color="danger"
                        onPress={() => handleDeleteTemplate(template.id)}
                        isDisabled={template.isDefault}
                      >
                        <DeleteIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Template Modal */}
      <Modal
        isOpen={createModalOpen}
        onOpenChange={setCreateModalOpen}
        scrollBehavior="inside"
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Skapa kundkortsmall</h2>
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="templateName" className="block text-sm font-medium mb-1">
                  Mallnamn
                </label>
                <Input
                  id="templateName"
                  value={templateName}
                  onValueChange={setTemplateName}
                  placeholder="Skriv mallens namn"
                  isInvalid={!!validationErrors.templateName}
                  errorMessage={validationErrors.templateName}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-md font-medium">Kundfält</h3>
                  <Button 
                    type="button" 
                    size="sm"
                    variant="flat"
                    color="primary"
                    onPress={addField}
                  >
                    Lägg till fält
                  </Button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={index} className="p-4 border rounded-md">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-medium">Fält {index + 1}</h4>
                        {fields.length > 2 && (
                          <Button
                            type="button"
                            size="sm"
                            isIconOnly
                            variant="flat"
                            color="danger"
                            onPress={() => removeField(index)}
                          >
                            <DeleteIcon />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`field-${index}-mapping`} className="block text-sm mb-1">
                            Fälttyp
                          </label>
                          <Dropdown>
                            <DropdownTrigger>
                              <Button 
                                variant="flat" 
                                className="w-full justify-start"
                                isInvalid={!!validationErrors[`field_${index}_mapping`]}
                              >
                                {field.mapping 
                                  ? customerFieldOptions.find(opt => opt.value === field.mapping)?.label 
                                  : "Välj fälttyp"}
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu 
                              aria-label="Field type options"
                              onAction={(key) => updateField(index, { mapping: key as string })}
                            >
                              {customerFieldOptions.map(option => (
                                <DropdownItem key={option.value}>
                                  {option.label}
                                </DropdownItem>
                              ))}
                            </DropdownMenu>
                          </Dropdown>
                          {validationErrors[`field_${index}_mapping`] && (
                            <p className="text-danger text-xs mt-1">
                              {validationErrors[`field_${index}_mapping`]}
                            </p>
                          )}
                        </div>

                        {field.mapping === 'DYNAMIC' && (
                          <>
                            <div>
                              <label htmlFor={`field-${index}-name`} className="block text-sm mb-1">
                                Dynamiskt fältnamn
                              </label>
                              <Input
                                id={`field-${index}-name`}
                                value={field.fieldName || ''}
                                onValueChange={(value) => updateField(index, { fieldName: value })}
                                placeholder="Skriv fältnamnet"
                                isInvalid={!!validationErrors[`field_${index}_fieldName`]}
                                errorMessage={validationErrors[`field_${index}_fieldName`]}
                              />
                            </div>
                            <div>
                              <label htmlFor={`field-${index}-inputType`} className="block text-sm mb-1">
                                Input Typ
                              </label>
                              <Dropdown>
                                <DropdownTrigger>
                                  <Button 
                                    variant="flat" 
                                    className="w-full justify-start"
                                    isInvalid={!!validationErrors[`field_${index}_inputType`]}
                                  >
                                    {field.inputType 
                                      ? inputTypeOptions.find(opt => opt.value === field.inputType)?.label 
                                      : "Välj input typ"}
                                  </Button>
                                </DropdownTrigger>
                                <DropdownMenu 
                                  aria-label="Input type options"
                                  onAction={(key) => updateField(index, { inputType: key as string })}
                                >
                                  {inputTypeOptions.map(option => (
                                    <DropdownItem key={option.value}>
                                      {option.label}
                                    </DropdownItem>
                                  ))}
                                </DropdownMenu>
                              </Dropdown>
                              {validationErrors[`field_${index}_inputType`] && (
                                <p className="text-danger text-xs mt-1">
                                  {validationErrors[`field_${index}_inputType`]}
                                </p>
                              )}
                            </div>
                          </>
                        )}

                        {/* Specialhantering för nyhetsbrev och stamkund - de använder checkbox i formuläret */}
                        {(field.mapping === 'newsletter' || field.mapping === 'loyal') ? (
                          <div className="sm:col-span-2">
                            <p className="text-sm text-default-600">
                              {field.mapping === 'newsletter' ? 'Detta fält kommer visas som en checkbox för nyhetsbrev' : 'Detta fält kommer visas som en checkbox för stamkund'}
                            </p>
                          </div>
                        ) : (
                          <div className="sm:col-span-2">
                            <Checkbox
                              isSelected={field.isRequired}
                              onValueChange={(checked) => updateField(index, { isRequired: checked })}
                            >
                              Obligatoriskt fält
                            </Checkbox>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="flat" 
                  onPress={() => {
                    resetForm();
                    setCreateModalOpen(false);
                  }}
                >
                  Avbryt
                </Button>
                <Button type="submit" color="primary">
                  Skapa mall
                </Button>
              </div>
            </Form>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Edit Template Modal */}
      <Modal
        isOpen={editModalOpen}
        onOpenChange={setEditModalOpen}
        scrollBehavior="inside"
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Redigera kundkortsmall</h2>
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={handleEditSubmit} className="space-y-6">
              <div>
                <label htmlFor="editTemplateName" className="block text-sm font-medium mb-1">
                  Mallnamn
                </label>
                <Input
                  id="editTemplateName"
                  value={editTemplateName}
                  onValueChange={setEditTemplateName}
                  placeholder="Skriv mallens namn"
                  isInvalid={!!validationErrors.editTemplateName}
                  errorMessage={validationErrors.editTemplateName}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-md font-medium">Kundfält</h3>
                  <Button 
                    type="button" 
                    size="sm"
                    variant="flat"
                    color="primary"
                    onPress={addEditField}
                  >
                    Lägg till fält
                  </Button>
                </div>

                <div className="space-y-4">
                  {editFields.map((field, index) => (
                    <div key={index} className="p-4 border rounded-md">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-medium">Fält {index + 1}</h4>
                        {editFields.length > 2 && (
                          <Button
                            type="button"
                            size="sm"
                            isIconOnly
                            variant="flat"
                            color="danger"
                            onPress={() => removeEditField(index)}
                          >
                            <DeleteIcon />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`editField-${index}-mapping`} className="block text-sm mb-1">
                            Fälttyp
                          </label>
                          <Dropdown>
                            <DropdownTrigger>
                              <Button 
                                variant="flat" 
                                className="w-full justify-start"
                                isInvalid={!!validationErrors[`editField_${index}_mapping`]}
                              >
                                {field.mapping 
                                  ? customerFieldOptions.find(opt => opt.value === field.mapping)?.label 
                                  : "Välj fälttyp"}
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu 
                              aria-label="Field type options"
                              onAction={(key) => updateEditField(index, { mapping: key as string })}
                            >
                              {customerFieldOptions.map(option => (
                                <DropdownItem key={option.value}>
                                  {option.label}
                                </DropdownItem>
                              ))}
                            </DropdownMenu>
                          </Dropdown>
                          {validationErrors[`editField_${index}_mapping`] && (
                            <p className="text-danger text-xs mt-1">
                              {validationErrors[`editField_${index}_mapping`]}
                            </p>
                          )}
                        </div>

                        {field.mapping === 'DYNAMIC' && (
                          <>
                            <div>
                              <label htmlFor={`editField-${index}-name`} className="block text-sm mb-1">
                                Dynamiskt fältnamn
                              </label>
                              <Input
                                id={`editField-${index}-name`}
                                value={field.fieldName || ''}
                                onValueChange={(value) => updateEditField(index, { fieldName: value })}
                                placeholder="Skriv fältnamnet"
                                isInvalid={!!validationErrors[`editField_${index}_fieldName`]}
                                errorMessage={validationErrors[`editField_${index}_fieldName`]}
                              />
                            </div>
                            <div>
                              <label htmlFor={`editField-${index}-inputType`} className="block text-sm mb-1">
                                Input Typ
                              </label>
                              <Dropdown>
                                <DropdownTrigger>
                                  <Button 
                                    variant="flat" 
                                    className="w-full justify-start"
                                    isInvalid={!!validationErrors[`editField_${index}_inputType`]}
                                  >
                                    {field.inputType 
                                      ? inputTypeOptions.find(opt => opt.value === field.inputType)?.label 
                                      : "Välj input typ"}
                                  </Button>
                                </DropdownTrigger>
                                <DropdownMenu 
                                  aria-label="Input type options"
                                  onAction={(key) => updateEditField(index, { inputType: key as string })}
                                >
                                  {inputTypeOptions.map(option => (
                                    <DropdownItem key={option.value}>
                                      {option.label}
                                    </DropdownItem>
                                  ))}
                                </DropdownMenu>
                              </Dropdown>
                              {validationErrors[`editField_${index}_inputType`] && (
                                <p className="text-danger text-xs mt-1">
                                  {validationErrors[`editField_${index}_inputType`]}
                                </p>
                              )}
                            </div>
                          </>
                        )}

                        {/* Specialhantering för nyhetsbrev och stamkund - de använder checkbox i formuläret */}
                        {(field.mapping === 'newsletter' || field.mapping === 'loyal') ? (
                          <div className="sm:col-span-2">
                            <p className="text-sm text-default-600">
                              {field.mapping === 'newsletter' ? 'Detta fält kommer visas som en checkbox för nyhetsbrev' : 'Detta fält kommer visas som en checkbox för stamkund'}
                            </p>
                          </div>
                        ) : (
                          <div className="sm:col-span-2">
                            <Checkbox
                              isSelected={field.isRequired}
                              onValueChange={(checked) => updateEditField(index, { isRequired: checked })}
                            >
                              Obligatoriskt fält
                            </Checkbox>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="flat" 
                  onPress={() => {
                    setEditModalOpen(false);
                    setEditingTemplate(null);
                  }}
                >
                  Avbryt
                </Button>
                <Button type="submit" color="primary">
                  Spara ändringar
                </Button>
              </div>
            </Form>
          </ModalBody>
        </ModalContent>
      </Modal>
    </section>
  );
}