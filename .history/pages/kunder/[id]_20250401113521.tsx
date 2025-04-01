// pages/kunder/[id].tsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { z } from 'zod';
import { updateCustomerSchema } from '@/utils/validation';

import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Button,
  Spinner,
  Tabs,
  Tab,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Checkbox,
  addToast
} from "@heroui/react";

import { title } from "@/components/primitives";
import { DeleteIcon, EditIcon, PrinterIcon } from "@/components/icons";
import CustomerInfo from "@/components/customer/CustomerInfo";
import CustomerTicketHistory from "@/components/customer/CustomerTicketHistory";
import CustomerActions from "@/components/customer/CustomerActions";
import { logger } from "@/utils/logger";

// Formatera datum för input
const formatDateForInput = (dateString: string | undefined): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Fel vid datumformatering:', error);
    return '';
  }
};

export default function CustomerPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status: sessionStatus } = useSession();
  
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("info");
  
  // State för redigera-formuläret
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormValues, setEditFormValues] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // State för bekräfta borttagning
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Hämta kund när id ändras
  useEffect(() => {
    if (!id || id === "undefined" || sessionStatus === "loading") return;
    
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    
    fetchCustomer(Number(id));
  }, [id, sessionStatus, router]);

  const fetchCustomer = async (customerId: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/customers/${customerId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("Kunden hittades inte");
        } else if (response.status === 403) {
          setError("Du har inte behörighet att se denna kund");
        } else {
          setError("Ett fel uppstod vid hämtning av kunddata");
        }
        return;
      }
      
      const data = await response.json();
      setCustomer(data);
      
      // GDPR-loggning: Notera att någon har tittat på kunddata (utan att logga hela kundobjektet)
      logger.info(`Användare ${session?.user?.email} tittade på kund #${customerId}`, {
        userId: session?.user?.id,
        action: "view_customer"
      });
    } catch (error) {
      console.error("Fel vid hämtning av kund:", error);
      setError("Ett oväntat fel uppstod vid hämtning av kunddata");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (!customer) return;
    
    const formValues = {
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phoneNumber: customer.phoneNumber || '',
      address: customer.address || '',
      postalCode: customer.postalCode || '',
      city: customer.city || '',
      country: customer.country || '',
      dateOfBirth: formatDateForInput(customer.dateOfBirth),
      newsletter: customer.newsletter || false,
      loyal: customer.loyal || false,
    };
    
    // Lägg till dynamiska fält om de finns
    if (customer.dynamicFields) {
      Object.entries(customer.dynamicFields).forEach(([key, value]) => {
        formValues[key] = value;
      });
    }
    
    setEditFormValues(formValues);
    setEditModalOpen(true);
  };

  const handleEditInputChange = (value: any, fieldName: string): void => {
    setEditFormValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleEditSubmit = async () => {
    console.log("handleEditSubmit anropades!");
    if (!customer) {
      console.log("Kund saknas, avbryter");
      return;
    }
    
    setValidationErrors({});
    console.log("Formulärvärden att validera:", editFormValues);
  
    try {
      // Validera med Zod schema
      console.log("Försöker validera med Zod schema");
      const validationResult = updateCustomerSchema.safeParse(editFormValues);
      
      if (!validationResult.success) {
        console.log("Valideringsfel:", validationResult.error.errors);
        // Omvandla Zod-fel till formatet som komponenten förväntar sig
        const formattedErrors = {};
        validationResult.error.errors.forEach((err) => {
          formattedErrors[err.path[0]] = err.message;
        });
        
        setValidationErrors(formattedErrors);
        console.log("Satte valideringsfel:", formattedErrors);
        return;
      }
      
      console.log("Validering lyckades, fortsätter med API-anrop");
      // Använd den validerade datan från Zod
      const customerInput = validationResult.data;
      console.log("Data att skicka:", customerInput);
  
      console.log("Skickar PUT-förfrågan till /api/customers/" + customer.id);
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerInput),
      });
  
      console.log("Svar från API:", response.status, response.statusText);
      
      if (!response.ok) {
        const data = await response.json();
        console.log("API returnerade feldata:", data);
        
        if (data.message === 'Valideringsfel' && data.errors) {
          const formattedErrors = {};
          data.errors.forEach((err) => {
            formattedErrors[err.field] = err.message;
          });
          setValidationErrors(formattedErrors);
          console.log("Satte valideringsfel från API:", formattedErrors);
          throw new Error(`Valideringsfel: ${Object.values(formattedErrors).join(', ')}`);
        }
        
        throw new Error(data.message || 'Kunde inte uppdatera kund');
      }
  
      const data = await response.json();
      console.log("Lyckad uppdatering, data:", data);
  
      // Uppdatera kunddata i state
      setCustomer(data);
      console.log("Uppdaterade customer state");
      
      addToast({
        title: 'Framgång',
        description: 'Kunden uppdaterades!',
        color: 'success',
        variant: 'flat'
      });
      console.log("Visade toast meddelande");
      
      setEditModalOpen(false);
      console.log("Stängde modal");
    } catch (error) {
      console.error('Fel vid uppdatering av kund:', error);
      addToast({
        title: 'Fel',
        description: error instanceof Error ? error.message : 'Ett fel inträffade',
        color: 'danger',
        variant: 'flat'
      });
      console.log("Visade felmeddelande");
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Kunde inte ta bort kunden');
      }
      
      addToast({
        title: 'Framgång',
        description: 'Kunden och alla tillhörande ärenden togs bort!',
        color: 'success',
        variant: 'flat'
      });
      
      // GDPR-loggning
      logger.info(`Användare ${session?.user?.email} raderade kund #${customer.id}`, {
        userId: session?.user?.id,
        action: "delete_customer"
      });
      
      // Navigera tillbaka till kundlistan
      router.push('/kunder');
    } catch (error) {
      console.error('Fel vid borttagning av kund:', error);
      addToast({
        title: 'Fel',
        description: error instanceof Error ? error.message : 'Ett fel inträffade',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setDeleteConfirmOpen(false);
    }
  };
  
  const handlePrint = () => {
    if (!customer) return;
    
    // Öppna ett nytt fönster för utskrift
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast({
        title: 'Fel',
        description: 'Kunde inte öppna utskriftsfönster',
        color: 'danger',
        variant: 'flat'
      });
      return;
    }
    
    // Generera HTML för utskrift
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kundprofil: ${customer.firstName || ''} ${customer.lastName || ''}</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #000;
            }
            
            .header {
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            
            h1, h2 {
              margin-top: 0;
            }
            
            .section {
              margin-bottom: 30px;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            
            th, td {
              text-align: left;
              padding: 8px;
              border-bottom: 1px solid #ddd;
            }
            
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            
            @media print {
              body {
                padding: 0;
              }
              
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Kundprofil</h1>
            <p>Utskriven: ${new Date().toLocaleDateString('sv-SE')}</p>
          </div>
          
          <div class="section">
            <h2>Kundinformation</h2>
            <table>
              <tr>
                <th style="width: 30%;">Namn</th>
                <td>${customer.firstName || ''} ${customer.lastName || ''}</td>
              </tr>
              <tr>
                <th>E-post</th>
                <td>${customer.email || '-'}</td>
              </tr>
              <tr>
                <th>Telefon</th>
                <td>${customer.phoneNumber || '-'}</td>
              </tr>
              <tr>
                <th>Adress</th>
                <td>${customer.address || '-'}</td>
              </tr>
              <tr>
                <th>Postnummer</th>
                <td>${customer.postalCode || '-'}</td>
              </tr>
              <tr>
                <th>Ort</th>
                <td>${customer.city || '-'}</td>
              </tr>
              <tr>
                <th>Land</th>
                <td>${customer.country || '-'}</td>
              </tr>
              <tr>
                <th>Födelsedatum</th>
                <td>${customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString('sv-SE') : '-'}</td>
              </tr>
              <tr>
                <th>Nyhetsbrev</th>
                <td>${customer.newsletter ? 'Ja' : 'Nej'}</td>
              </tr>
              <tr>
                <th>Stamkund</th>
                <td>${customer.loyal ? 'Ja' : 'Nej'}</td>
              </tr>
              <tr>
                <th>Kund sedan</th>
                <td>${customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('sv-SE') : '-'}</td>
              </tr>
            </table>
          </div>
        </body>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Du måste vara inloggad för att se denna sida.</div>
        <Button color="primary" onPress={() => router.push("/auth/login")}>
          Logga in
        </Button>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="text-danger">{error}</div>
        <Button color="primary" onPress={() => router.push("/kunder")}>
          Tillbaka till kundlistan
        </Button>
      </section>
    );
  }

  if (!customer) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Kunden hittades inte.</div>
        <Button color="primary" onPress={() => router.push("/kunder")}>
          Tillbaka till kundlistan
        </Button>
      </section>
    );
  }

  // Skapa ett visningsnamn för kunden
  const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || `Kund #${customer.id}`;
  
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="w-full max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className={title({ size: 'sm' })}>{customerName}</h1>
            <p className="text-default-500 mt-1">
              Kund #{customer.id} • Kund sedan {new Date(customer.createdAt).toLocaleDateString('sv-SE')}
            </p>
          </div>
          
          <CustomerActions 
            customer={customer}
            onEdit={handleEdit}
            onDelete={() => setDeleteConfirmOpen(true)}
            onPrint={handlePrint}
          />
        </div>

        <Tabs 
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          variant="underlined"
          color="primary"
          className="mb-4"
        >
          <Tab key="info" title="Kundinformation" />
          <Tab key="tickets" title="Ärendehistorik" />
        </Tabs>

        {activeTab === 'info' && (
          <CustomerInfo customer={customer} />
        )}

        {activeTab === 'tickets' && (
          <CustomerTicketHistory customerId={customer.id} />
        )}

        {/* Redigera-modal */}
        <Modal
          isOpen={editModalOpen}
          onOpenChange={(isOpen) => setEditModalOpen(isOpen)}
          scrollBehavior="inside"
          size="3xl"
          isDismissable={false}  // Kritisk ändring!
          closeButton={true}
        >
          <ModalContent>
            <ModalHeader>
              <h2 className="text-xl font-bold">Redigera kund</h2>
            </ModalHeader>
            <ModalBody>
              <form onSubmit={handleEditSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <Input
                      label="Förnamn"
                      name="firstName"
                      value={editFormValues.firstName || ''}
                      onValueChange={(value) => handleEditInputChange(value, 'firstName')}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      label="Efternamn"
                      name="lastName"
                      value={editFormValues.lastName || ''}
                      onValueChange={(value) => handleEditInputChange(value, 'lastName')}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      label="E-post"
                      name="email"
                      type="email"
                      isRequired
                      value={editFormValues.email || ''}
                      onValueChange={(value) => handleEditInputChange(value, 'email')}
                      isInvalid={!!validationErrors.email}
                      errorMessage={validationErrors.email}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      label="Telefon"
                      name="phoneNumber"
                      value={editFormValues.phoneNumber || ''}
                      onValueChange={(value) => handleEditInputChange(value, 'phoneNumber')}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label="Adress"
                      name="address"
                      value={editFormValues.address || ''}
                      onValueChange={(value) => handleEditInputChange(value, 'address')}
                      isInvalid={!!validationErrors.address}
                      errorMessage={validationErrors.address}
                    />
                  </div>

                  <div className="col-span-1">
                    <Input
                      label="Postnummer"
                      name="postalCode"
                      value={editFormValues.postalCode || ''}
                      onValueChange={(value) => handleEditInputChange(value, 'postalCode')}
                      isInvalid={!!validationErrors.postalCode}
                      errorMessage={validationErrors.postalCode}
                    />
                  </div>

                  <div className="col-span-1">
                    <Input
                      label="Ort"
                      name="city"
                      value={editFormValues.city || ''}
                      onValueChange={(value) => handleEditInputChange(value, 'city')}
                      isInvalid={!!validationErrors.city}
                      errorMessage={validationErrors.city}
                    />
                  </div>

                  <div className="col-span-1">
                    <Input
                      label="Land"
                      name="country"
                      value={editFormValues.country || ''}
                      onValueChange={(value) => handleEditInputChange(value, 'country')}
                      isInvalid={!!validationErrors.country}
                      errorMessage={validationErrors.country}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      label="Födelsedatum"
                      name="dateOfBirth"
                      type="date"
                      value={editFormValues.dateOfBirth || ''}
                      onValueChange={(value) => handleEditInputChange(value || undefined, 'dateOfBirth')}
                    />
                  </div>
                  <div className="col-span-1 mt-2">
                    <Checkbox
                      isSelected={editFormValues.newsletter || false}
                      onValueChange={(checked) => handleEditInputChange(checked, 'newsletter')}
                    >
                      Nyhetsbrev
                    </Checkbox>
                  </div>
                  <div className="col-span-1 mt-2">
                    <Checkbox
                      isSelected={editFormValues.loyal || false}
                      onValueChange={(checked) => handleEditInputChange(checked, 'loyal')}
                    >
                      Stamkund
                    </Checkbox>
                  </div>
                  
                  {customer.dynamicFields && Object.entries(customer.dynamicFields).map(([key, value]) => {
                    if (key === 'newsletter' || key === 'loyal') return null;
                    
                    return (
                      <div key={key} className="col-span-2">
                        <Input
                          label={key}
                          name={key}
                          value={editFormValues[key] || ''}
                          onValueChange={(value) => handleEditInputChange(value, key)}
                        />
                      </div>
                    );
                  })}
                </div>
              </form>
            </ModalBody>
            <ModalFooter>
              <Button 
                type="button" 
                variant="flat" 
                onPress={() => setEditModalOpen(false)}
              >
                Avbryt
              </Button>
              <Button 
                color="primary" 
                onPress={() => handleEditSubmit()}
              >
                Spara ändringar
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Bekräftelse-dialog för borttagning */}
        <Modal
          isOpen={deleteConfirmOpen}
          onOpenChange={(isOpen) => setDeleteConfirmOpen(isOpen)}
        >
          <ModalContent>
            <ModalHeader>
              <h3 className="text-xl">Bekräfta borttagning</h3>
            </ModalHeader>
            <ModalBody>
              <p>
                Är du säker på att du vill ta bort kunden <strong>{customerName}</strong>?
              </p>
              <p className="text-danger font-medium mt-2">
                Detta kommer även ta bort alla ärenden kopplade till kunden och kan inte ångras.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button 
                variant="flat" 
                onPress={() => setDeleteConfirmOpen(false)}
              >
                Avbryt
              </Button>
              <Button 
                color="danger" 
                onPress={handleDelete}
              >
                Ta bort
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </section>
  );
}