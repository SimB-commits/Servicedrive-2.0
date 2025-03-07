// utils/import-export.ts
// Hjälpfunktioner för import/export-funktionalitet

/**
 * Identifierar filtyp baserat på filnamn
 */
export const detectFileType = (filename: string): string | null => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'csv':
        return 'csv';
      case 'xlsx':
      case 'xls':
        return 'excel';
      case 'json':
        return 'json';
      default:
        return null;
    }
  };
  
  /**
   * Validera importfilens data mot det förväntade formatet
   */
  export const validateImport = (
    data: any[], 
    fieldMapping: Record<string, string>, 
    importTarget: 'customers' | 'tickets'
  ): { valid: boolean; message?: string } => {
    // Kontrollera att det finns data
    if (!Array.isArray(data) || data.length === 0) {
      return { 
        valid: false, 
        message: 'Ingen data hittades i filen' 
      };
    }
    
    // Kontrollera att vi har mappningar
    if (Object.keys(fieldMapping).length === 0) {
      return { 
        valid: false, 
        message: 'Ingen fältmappning har angivits' 
      };
    }
    
    // För kundimport: Kontrollera att e-post finns
    if (importTarget === 'customers') {
      const hasEmailMapping = Object.values(fieldMapping).includes('email');
      
      if (!hasEmailMapping) {
        return { 
          valid: false, 
          message: 'E-postfält måste mappas för kundimport' 
        };
      }
      
      // Kontrollera att varje rad har en e-post
      const sourceEmailField = Object.entries(fieldMapping)
        .find(([_, target]) => target === 'email')?.[0];
      
      if (sourceEmailField) {
        const missingEmails = data.some(row => 
          !row[sourceEmailField] || row[sourceEmailField].trim() === ''
        );
        
        if (missingEmails) {
          return { 
            valid: false, 
            message: 'Vissa rader saknar e-postvärden, vilket krävs för kunder' 
          };
        }
      }
    }
    
    // För ärendeimport: Kontrollera att kundkoppling finns
    if (importTarget === 'tickets') {
      const hasCustomerMapping = Object.values(fieldMapping).includes('customerEmail');
      
      if (!hasCustomerMapping) {
        return { 
          valid: false, 
          message: 'Kundens e-post måste mappas för ärendeimport' 
        };
      }
    }
  
    return { valid: true };
  };
  
  /**
   * Transformera kundfält baserat på fältmappning
   */
  export const mapCustomerFields = (
    data: any[], 
    fieldMapping: Record<string, string>
  ): any[] => {
    return data.map(row => {
      const mappedRow: Record<string, any> = {};
      
      for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
        if (targetField && row[sourceField] !== undefined) {
          let value = row[sourceField];
          
          // Typkonvertering baserat på målfält
          switch (targetField) {
            case 'newsletter':
            case 'loyal':
              // Konvertera till boolean
              if (typeof value === 'string') {
                value = ['true', 'yes', 'ja', '1', 'y'].includes(value.toLowerCase());
              } else if (typeof value === 'number') {
                value = value === 1;
              }
              break;
              
            case 'dateOfBirth':
              // Konvertera till datum
              if (value && typeof value === 'string') {
                // Försök tolka datumet
                try {
                  const date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    value = date.toISOString();
                  } else {
                    // Försök med olika datumformat
                    const parts = value.split(/[\/\-\.]/);
                    if (parts.length === 3) {
                      // Anta MM/DD/YYYY eller DD/MM/YYYY
                      if (parseInt(parts[0]) > 12) {
                        // Sannolikt DD/MM/YYYY
                        const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        if (!isNaN(date.getTime())) {
                          value = date.toISOString();
                        }
                      } else {
                        // Anta MM/DD/YYYY
                        const date = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
                        if (!isNaN(date.getTime())) {
                          value = date.toISOString();
                        }
                      }
                    }
                  }
                } catch (error) {
                  // Om vi inte kunde tolka datumet, behåll originalvärdet
                  console.warn(`Kunde inte tolka datum: ${value}`, error);
                }
              }
              break;
            
            default:
              // Standardkonvertering för textvärden
              if (value === null) {
                value = undefined;
              } else if (typeof value !== 'string' && typeof value !== 'number') {
                value = String(value);
              }
              break;
          }
          
          mappedRow[targetField] = value;
        }
      }
      
      return mappedRow;
    });
  };
  
  /**
   * Transformera ärenden baserat på fältmappning
   */
  export const mapTicketFields = (
    data: any[], 
    fieldMapping: Record<string, string>
  ): any[] => {
    return data.map(row => {
      const mappedRow: Record<string, any> = {};
      
      for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
        if (targetField && row[sourceField] !== undefined) {
          let value = row[sourceField];
          
          // Typkonvertering baserat på målfält
          switch (targetField) {
            case 'dueDate':
              // Konvertera till datum
              if (value && typeof value === 'string') {
                try {
                  const date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    value = date.toISOString();
                  } else {
                    // Försök med olika datumformat
                    const parts = value.split(/[\/\-\.]/);
                    if (parts.length === 3) {
                      // Anta MM/DD/YYYY eller DD/MM/YYYY
                      if (parseInt(parts[0]) > 12) {
                        // Sannolikt DD/MM/YYYY
                        const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        if (!isNaN(date.getTime())) {
                          value = date.toISOString();
                        }
                      } else {
                        // Anta MM/DD/YYYY
                        const date = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
                        if (!isNaN(date.getTime())) {
                          value = date.toISOString();
                        }
                      }
                    }
                  }
                } catch (error) {
                  // Om vi inte kunde tolka datumet, behåll originalvärdet
                  console.warn(`Kunde inte tolka datum: ${value}`, error);
                }
              }
              break;
              
            case 'status':
              // Normalisera status
              if (typeof value === 'string') {
                const normalizedStatus = value.toUpperCase().trim();
                
                // Mappa vanliga statusar till systemets statusar
                const statusMap: Record<string, string> = {
                  'OPEN': 'OPEN',
                  'OPENED': 'OPEN',
                  'NEW': 'OPEN',
                  'NYA': 'OPEN',
                  'ÖPPEN': 'OPEN',
                  'ÖPPET': 'OPEN',
                  'ÖPPNA': 'OPEN',
                  
                  'IN PROGRESS': 'IN_PROGRESS',
                  'INPROGRESS': 'IN_PROGRESS',
                  'IN-PROGRESS': 'IN_PROGRESS',
                  'ONGOING': 'IN_PROGRESS',
                  'PÅGÅR': 'IN_PROGRESS',
                  'PÅGÅENDE': 'IN_PROGRESS',
                  
                  'RESOLVED': 'RESOLVED',
                  'LÖST': 'RESOLVED',
                  'SOLVED': 'RESOLVED',
                  
                  'CLOSED': 'CLOSED',
                  'CLOSE': 'CLOSED',
                  'DONE': 'CLOSED',
                  'COMPLETED': 'CLOSED',
                  'FÄRDIG': 'CLOSED',
                  'KLAR': 'CLOSED',
                  'AVSLUTAD': 'CLOSED',
                  'STÄNGD': 'CLOSED'
                };
                
                value = statusMap[normalizedStatus] || normalizedStatus;
              }
              break;
            
            default:
              // Standardkonvertering för textvärden
              if (value === null) {
                value = undefined;
              } else if (typeof value !== 'string' && typeof value !== 'number') {
                value = String(value);
              }
              break;
          }
          
          mappedRow[targetField] = value;
        }
      }
      
      return mappedRow;
    });
  };
  
  /**
   * Generisk funktion för att exportera data
   */
  export const prepareDataForExport = (
    data: any[],
    exportType: 'customers' | 'tickets' | 'all',
    includeRelations: boolean = false
  ): any[] => {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    // För varje exporttyp, formatera data på lämpligt sätt
    switch (exportType) {
      case 'customers':
        return data.map(customer => {
          const exportedCustomer = {
            // Baskundinformation
            id: customer.id,
            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            email: customer.email || '',
            phoneNumber: customer.phoneNumber || '',
            address: customer.address || '',
            postalCode: customer.postalCode || '',
            city: customer.city || '',
            country: customer.country || '',
            dateOfBirth: customer.dateOfBirth ? new Date(customer.dateOfBirth).toISOString().split('T')[0] : '',
            newsletter: customer.newsletter || false,
            loyal: customer.loyal || false,
            
            // Relationer
            ...(includeRelations && customer.tickets ? {
              ticketCount: customer.tickets.length
            } : {})
          };
          
          // Lägg till dynamiska fält om de finns
          if (customer.dynamicFields && typeof customer.dynamicFields === 'object') {
            Object.entries(customer.dynamicFields).forEach(([key, value]) => {
              exportedCustomer[`custom_${key}`] = value;
            });
          }
          
          return exportedCustomer;
        });
        
      case 'tickets':
        return data.map(ticket => {
          const exportedTicket = {
            // Basärendeinformation
            id: ticket.id,
            title: ticket.title || '',
            description: ticket.description || '',
            status: ticket.status || '',
            createdAt: ticket.createdAt ? new Date(ticket.createdAt).toISOString().split('T')[0] : '',
            updatedAt: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString().split('T')[0] : '',
            dueDate: ticket.dueDate ? new Date(ticket.dueDate).toISOString().split('T')[0] : '',
            
            // Kopplingar
            customerId: ticket.customerId,
            customerEmail: ticket.customer?.email || '',
            ticketTypeId: ticket.ticketTypeId,
            ticketTypeName: ticket.ticketType?.name || '',
          };
          
          // Lägg till anpassad status om det finns
          if (ticket.customStatus) {
            exportedTicket.customStatus = ticket.customStatus.name;
          }
          
          // Lägg till dynamiska fält
          if (ticket.dynamicFields && typeof ticket.dynamicFields === 'object') {
            Object.entries(ticket.dynamicFields).forEach(([key, value]) => {
              exportedTicket[`field_${key}`] = value;
            });
          }
          
          // Lägg till relationer om de önskas
          if (includeRelations) {
            if (ticket.messages && Array.isArray(ticket.messages)) {
              exportedTicket.messageCount = ticket.messages.length;
            }
            
            if (ticket.customer) {
              exportedTicket.customerName = `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim();
            }
          }
          
          return exportedTicket;
        });
        
      case 'all':
        // För 'all' exporterar vi både kunder och ärenden i samma struktur
        return {
          customers: prepareDataForExport(data.customers || [], 'customers', includeRelations),
          tickets: prepareDataForExport(data.tickets || [], 'tickets', includeRelations)
        };
        
      default:
        return data;
    }
  };
  
  /**
   * Validera e-postadress
   */
  export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  /**
   * Normalisera fältnamn för automatisk mappning
   */
  export const normalizeFieldName = (fieldName: string): string => {
    return fieldName
      .toLowerCase()
      .replace(/[^a-z0-9åäö]/g, '')
      .replace(/kundens?|kund/, 'customer')
      .replace(/epost|email|epostadress|mail/, 'email')
      .replace(/telefon|tel|mobil|phone|phonenumber/, 'phoneNumber')
      .replace(/namn|name/, 'name')
      .replace(/fornamn|förnamn|first|firstname/, 'firstName')
      .replace(/efternamn|last|lastname/, 'lastName')
      .replace(/adress|address/, 'address')
      .replace(/postnr|postnummer|postalcode|zipcode|zip/, 'postalCode')
      .replace(/stad|city|ort/, 'city')
      .replace(/land|country/, 'country')
      .replace(/fodelsedag|födelsedatum|birthdate|dateofbirth|birth/, 'dateOfBirth')
      .replace(/nyhetsbrev|newsletter/, 'newsletter')
      .replace(/stamkund|loyal|vip/, 'loyal')
      .replace(/titel|title/, 'title')
      .replace(/beskrivning|description/, 'description')
      .replace(/status/, 'status')
      .replace(/deadline|duedate|due/, 'dueDate');
  };