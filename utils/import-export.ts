// utils/import-export.ts
// Hjälpfunktioner för import/export-funktionalitet

import { parseDate } from "./date-formatter";

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
      
      // Initialize dynamic fields as an empty object
      mappedRow.dynamicFields = {};
      
      // For each source field, map to target field according to field mapping
      for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
        if (targetField && row[sourceField] !== undefined) {
          let value = row[sourceField];
          
          // Specialhantering för field_* prefixade fält
          if (targetField.startsWith('field_')) {
            // Extrahera fältnamnet utan prefix
            const fieldName = targetField.substring(6); // 'field_'.length = 6
            
            // Spara värdet i dynamicFields med rätt namn
            if (mappedRow.dynamicFields) {
              mappedRow.dynamicFields[fieldName] = value;
            }
            continue; // Hoppa över att lägga till i root-objektet
          }
          
          // Type conversion based on target field
          switch (targetField) {
            case 'dueDate':
            // Använd den nya parseDate-funktionen för robust datumhantering
            if (value !== null && value !== undefined) {
              const parsedDate = parseDate(value);
              if (parsedDate) {
                value = parsedDate;
              } else {
                console.warn(`Kunde inte tolka dueDate-värde: ${value}`);
                // Behåll originalvärdet om parsning misslyckas
              }
            }
            break;
              
            case 'status':
              // Normalize status
              if (typeof value === 'string') {
                const normalizedStatus = value.toUpperCase().trim();
                
                // Map common statuses to system statuses
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
  
            case 'ticketTypeId':
              // Convert to number
              if (value !== null && value !== undefined) {
                if (typeof value === 'string') {
                  // If it's a string with a ticket type name, keep for later matching
                  if (isNaN(Number(value))) {
                    mappedRow.ticketTypeName = value;
                    continue; // Skip setting this as ID for now
                  } else {
                    // If it's a numeric string, convert to number
                    value = Number(value);
                  }
                } else if (typeof value === 'number') {
                  // If it's already a number, keep it
                  value = value;
                }
              }
              break;
              
            case 'customerId':
              // Convert to number
              if (value !== null && value !== undefined) {
                value = Number(value) || null;
              }
              break;
  
            case 'dynamicFields':
              // Check if value is already an object
              if (typeof value === 'object' && value !== null) {
                // If it's an object, use it
                Object.assign(mappedRow.dynamicFields, value);
                continue; // Skip adding to mappedRow
              } else if (typeof value === 'string') {
                // Try to parse as JSON if it's a string
                try {
                  const parsedValue = JSON.parse(value);
                  if (typeof parsedValue === 'object' && parsedValue !== null) {
                    Object.assign(mappedRow.dynamicFields, parsedValue);
                    continue; // Skip adding to mappedRow
                  }
                } catch (e) {
                  // If parsing fails, add as a string in dynamicFields
                  if (mappedRow.dynamicFields) {
                    mappedRow.dynamicFields['rawValue'] = value;
                  }
                  continue; // Skip adding to mappedRow
                }
              }
              break;
            
            default:
              // Standard conversion for text values
              if (value === null) {
                value = undefined;
              } else if (typeof value !== 'string' && typeof value !== 'number') {
                value = String(value);
              }
              break;
          }
          
          // Add to mappedRow
          mappedRow[targetField] = value;
        }
      }
      
      // Specialhantering för field_* prefix i importdata
      for (const key in row) {
        // Hoppa över redan mappade fält
        if (Object.keys(fieldMapping).includes(key)) {
          continue;
        }
        
        // Hantera field_* prefixade kolumner automatiskt
        if (key.startsWith('field_')) {
          const fieldName = key.substring(6); // Remove "field_" prefix
          if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
            // Ensure dynamicFields is initialized
            if (!mappedRow.dynamicFields) {
              mappedRow.dynamicFields = {};
            }
            mappedRow.dynamicFields[fieldName] = row[key];
          }
        }
        if (mappedRow.dynamicFields) {
          for (const key in mappedRow.dynamicFields) {
            // Kontrollera om nyckeln ser ut som ett datum (enkel heuristik)
            const valueLower = String(mappedRow.dynamicFields[key]).toLowerCase();
            const keyLower = key.toLowerCase();
            
            const isLikelyDateField = 
              keyLower.includes('date') || 
              keyLower.includes('datum') || 
              keyLower.includes('due') || 
              keyLower.includes('deadline') ||
              keyLower.includes('förfall') ||
              keyLower.includes('klar');
        
            // Om vi inte redan har ett dueDate och detta fält ser ut som ett datum
            if (!mappedRow.dueDate && isLikelyDateField) {
              const parsedDate = parseDate(mappedRow.dynamicFields[key]);
              if (parsedDate) {
                mappedRow.dueDate = parsedDate;
              }
            }
          }
        }
      }
      
      return mappedRow;
    });
  };
  
  // Förbered data för export

  export const prepareDataForExport = (
    data: any[],
    exportType: 'customers' | 'tickets' | 'all',
    includeRelations: boolean = false
  ): any[] => {
    console.log(`Running updated prepareDataForExport with type: ${exportType}`);
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    // For each export type, format data appropriately
    switch (exportType) {
      case 'customers':
        return data.map(customer => {
          const exportedCustomer = {
            // Basic customer information
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
            
            // Relations
            ...(includeRelations && customer.tickets ? {
              ticketCount: customer.tickets.length
            } : {})
          };
          
          // Add dynamic fields if they exist
          if (customer.dynamicFields && typeof customer.dynamicFields === 'object') {
            Object.entries(customer.dynamicFields).forEach(([key, value]) => {
              exportedCustomer[`custom_${key}`] = value;
            });
          }
          
          return exportedCustomer;
        });
        
      case 'tickets':
        // First collect all dynamic field names
        const allDynamicFields = new Set<string>();
        
        data.forEach(ticket => {
          if (ticket.dynamicFields && typeof ticket.dynamicFields === 'object') {
            Object.keys(ticket.dynamicFields).forEach(key => {
              allDynamicFields.add(key);
            });
          }
        });
        
        return data.map(ticket => {
          const exportedTicket = {
            // Basic ticket information
            id: ticket.id,
            title: ticket.title || '',
            description: ticket.description || '',
            status: ticket.status || '',
            createdAt: ticket.createdAt ? new Date(ticket.createdAt).toISOString().split('T')[0] : '',
            updatedAt: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString().split('T')[0] : '',
            dueDate: ticket.dueDate ? new Date(ticket.dueDate).toISOString().split('T')[0] : '',
            
            // Connections
            customerId: ticket.customerId,
            customerEmail: ticket.customer?.email || '',
            customerName: ticket.customer ? `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() : '',
            ticketTypeId: ticket.ticketTypeId,
            ticketTypeName: ticket.ticketType?.name || '',
          };
          
          // Add custom status if it exists
          if (ticket.customStatus) {
            exportedTicket.customStatus = ticket.customStatus.name;
          }
          
          // ADD ONLY field_ PREFIX FORMAT - NOT ticket type prefixed fields
          
          // First add all possible dynamic fields with empty values
          Array.from(allDynamicFields).forEach(fieldName => {
            exportedTicket[`field_${fieldName}`] = '';
          });
          
          // Then add this ticket's actual dynamic field values
          if (ticket.dynamicFields && typeof ticket.dynamicFields === 'object') {
            Object.entries(ticket.dynamicFields).forEach(([key, value]) => {
              exportedTicket[`field_${key}`] = value !== null && value !== undefined ? value : '';
            });
          }
          
          // Add relations if desired
          if (includeRelations) {
            if (ticket.messages && Array.isArray(ticket.messages)) {
              exportedTicket.messageCount = ticket.messages.length;
              
              // Add last message date if available
              if (ticket.messages.length > 0) {
                const sortedMessages = [...ticket.messages].sort((a, b) => 
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                if (sortedMessages[0]?.createdAt) {
                  exportedTicket.lastMessageDate = new Date(sortedMessages[0].createdAt).toISOString().split('T')[0];
                } else {
                  exportedTicket.lastMessageDate = '';
                }
              } else {
                exportedTicket.lastMessageDate = '';
              }
            } else {
              exportedTicket.messageCount = 0;
              exportedTicket.lastMessageDate = '';
            }
          }
          
          return exportedTicket;
        });
        
      case 'all':
        // For 'all' we export both customers and tickets in the same structure
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
    // Behåll ursprungligt field_ prefix om det finns
    if (fieldName.startsWith('field_')) {
      return fieldName.toLowerCase();
    }
    
    // Normalisera fältnamnet för jämförelse
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
      .replace(/deadline|duedate|due/, 'dueDate')
      .replace(/sulm(a|å)tt|solm(a|å)tt|width/, 'sulmått') // Lägg till för sulbredd/sulmått
      .replace(/skidor?|ski/, 'skida')
      .replace(/pj(a|ä)x(a|or)|boot/, 'pjäxa')
      .replace(/binding|bindings/, 'bindning')
      .replace(/servicetyp|service/, 'servicetyp')
      .replace(/kommentar|comments?|note|notes?/, 'kommentar')
      .replace(/monterings?punkt/, 'monteringspunkt');
  };