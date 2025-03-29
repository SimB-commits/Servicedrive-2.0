// utils/searchService.ts

/**
 * Central sökservice för att söka över olika typer av data i applikationen
 */

export type SearchableResource = 'customers' | 'tickets' | 'settings' | 'templateCards' | 'templates';

export type SearchResult = {
  id: number | string;
  type: SearchableResource;
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
  relevance: number;
  createdAt?: string;
  updatedAt?: string;
  originalData: any;
};

export interface SearchOptions {
  limit?: number;
  offset?: number;
  types?: SearchableResource[];
  includeArchived?: boolean;
}

const defaultOptions: SearchOptions = {
  limit: 50,
  types: ['customers', 'tickets', 'settings', 'templateCards', 'templates'],
  includeArchived: false
};

/**
 * Utför en sökning i systemet över olika typer av data
 */
export async function search(
  query: string, 
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  // Kombinera standardalternativ med de angivna
  const searchOptions = { ...defaultOptions, ...options };
  
  // Trimma sökningen och returnera tom array om sökningen är tom
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return [];
  }
  
  // Parallella sökningar över valda resurser
  const searchPromises: Promise<SearchResult[]>[] = [];
  
  // Sökning i kunder
  if (searchOptions.types?.includes('customers')) {
    searchPromises.push(searchCustomers(trimmedQuery));
  }
  
  // Sökning i ärenden
  if (searchOptions.types?.includes('tickets')) {
    searchPromises.push(searchTickets(trimmedQuery));
  }
  
  // Sökning i inställningar
  if (searchOptions.types?.includes('settings')) {
    searchPromises.push(searchSettings(trimmedQuery));
  }
  
  // Sökning i kundkort
  if (searchOptions.types?.includes('templateCards')) {
    searchPromises.push(searchCustomerCards(trimmedQuery));
  }
  
  // Sökning i mallar
  if (searchOptions.types?.includes('templates')) {
    searchPromises.push(searchTemplates(trimmedQuery));
  }
  
  // Vänta på att alla sökningar är klara
  const resultArrays = await Promise.all(searchPromises);
  
  // Kombinera alla resultat till en enda array
  let combinedResults = resultArrays.flat();
  
  // Sortera efter relevans (högre poäng först)
  combinedResults = combinedResults.sort((a, b) => b.relevance - a.relevance);
  
  // Begränsa antalet resultat enligt limit
  if (searchOptions.limit) {
    combinedResults = combinedResults.slice(0, searchOptions.limit);
  }
  
  return combinedResults;
}

/**
 * Söker efter kunder baserat på given söktext
 * Returnerar matchande kunder som sökresultat
 */
async function searchCustomers(query: string): Promise<SearchResult[]> {
  try {
    // Utför API-anrop för att söka kunder
    const response = await fetch(`/api/customers?search=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const customers = await response.json();
    
    // Mappa kunderna till sökresultat
    return customers.map((customer: any) => {
      // Beräkna relevans baserat på matchningar i olika fält
      let relevance = 0;
      
      // Utför matchningslogik för relevanspoäng
      const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.toLowerCase();
      if (fullName.includes(query)) relevance += 8;
      if (customer.email?.toLowerCase().includes(query)) relevance += 7;
      if (customer.phoneNumber?.toLowerCase().includes(query)) relevance += 6;
      if (customer.address?.toLowerCase().includes(query)) relevance += 4;
      if (customer.city?.toLowerCase().includes(query)) relevance += 4;
      if (customer.postalCode?.toLowerCase().includes(query)) relevance += 3;
      
      const displayName = fullName.trim() || customer.email || `Kund #${customer.id}`;
      
      return {
        id: customer.id,
        type: 'customers' as SearchableResource,
        title: displayName,
        subtitle: customer.email,
        description: customer.phoneNumber 
          ? `Tel: ${customer.phoneNumber}${customer.address ? `, ${customer.address}` : ''}`
          : customer.address || undefined,
        url: `/kunder/${customer.id}`,
        relevance,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        originalData: customer
      };
    });
  } catch (error) {
    console.error('Error searching customers:', error);
    return [];
  }
}

/**
 * Söker efter ärenden baserat på given söktext
 * Returnerar matchande ärenden som sökresultat
 */
async function searchTickets(query: string): Promise<SearchResult[]> {
  try {
    // Utför API-anrop för att söka ärenden
    const response = await fetch(`/api/tickets?search=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const tickets = await response.json();
    
    // Mappa ärendena till sökresultat
    return tickets.map((ticket: any) => {
      // Beräkna relevans baserat på matchningar i olika fält
      let relevance = 0;
      
      // Utför matchningslogik för relevanspoäng
      if (ticket.id.toString().includes(query)) relevance += 10;
      if (ticket.ticketType?.name?.toLowerCase().includes(query)) relevance += 7;
      
      // Sök i dynamiska fält
      if (ticket.dynamicFields) {
        Object.entries(ticket.dynamicFields).forEach(([key, value]: [string, any]) => {
          // Ge extra poäng för matchningar i namnet på fältet
          if (key.toLowerCase().includes(query)) relevance += 3;
          
          // Och för matchningar i värdet
          if (value && String(value).toLowerCase().includes(query)) relevance += 5;
        });
      }
      
      // Sök i kundinformation
      if (ticket.customer) {
        const customerName = `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.toLowerCase();
        if (customerName.includes(query)) relevance += 6;
        if (ticket.customer.email?.toLowerCase().includes(query)) relevance += 5;
      }
      
      // Bestäm status för visning
      let statusDisplay = ticket.status;
      if (ticket.customStatus) {
        statusDisplay = ticket.customStatus.name;
      } else if (ticket.status === 'OPEN') {
        statusDisplay = 'Öppen';
      } else if (ticket.status === 'IN_PROGRESS') {
        statusDisplay = 'Pågående';
      } else if (ticket.status === 'RESOLVED') {
        statusDisplay = 'Löst';
      } else if (ticket.status === 'CLOSED') {
        statusDisplay = 'Avslutad';
      }
      
      return {
        id: ticket.id,
        type: 'tickets' as SearchableResource,
        title: `Ärende #${ticket.id}`,
        subtitle: ticket.ticketType?.name || 'Okänd ärendetyp',
        description: `Status: ${statusDisplay}${ticket.customer ? `, Kund: ${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() : ''}`,
        url: `/arenden/${ticket.id}`,
        relevance,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        originalData: ticket
      };
    });
  } catch (error) {
    console.error('Error searching tickets:', error);
    return [];
  }
}

/**
 * Söker efter inställningar baserat på given söktext
 */
async function searchSettings(query: string): Promise<SearchResult[]> {
  // Detta är en förenklad implementering eftersom vi inte har ett specifikt API för inställningar
  const settingPages = [
    { 
      id: 'arendetyper', 
      name: 'Ärendetyper', 
      description: 'Hantera dina ärendetyper', 
      url: '/installningar?tab=arendetyper' 
    },
    { 
      id: 'arendestatusar', 
      name: 'Ärendestatusar', 
      description: 'Hantera statusar för ärenden', 
      url: '/installningar?tab=arendestatusar' 
    },
    { 
      id: 'kundkortsmallar', 
      name: 'Kundkortsmallar', 
      description: 'Hantera mallar för kundkort', 
      url: '/installningar?tab=kundkortsmallar' 
    },
    { 
      id: 'mailmallar', 
      name: 'Mailmallar', 
      description: 'Hantera mallar för e-post', 
      url: '/installningar?tab=mailmallar' 
    },
    { 
      id: 'dataimport', 
      name: 'Import/Export', 
      description: 'Importera eller exportera data', 
      url: '/installningar?tab=dataimport' 
    },
    { 
      id: 'butiker', 
      name: 'Butiker', 
      description: 'Hantera dina butiker', 
      url: '/installningar?tab=butiker' 
    },
    { 
      id: 'email', 
      name: 'E-postinställningar', 
      description: 'Konfigurera e-postinställningar', 
      url: '/installningar?tab=email' 
    },
    { 
      id: 'konto', 
      name: 'Kontoinställningar', 
      description: 'Hantera ditt konto och lösenord', 
      url: '/installningar?tab=konto' 
    }
  ];
  
  // Filtrera inställningar som matchar sökningen
  return settingPages
    .filter(page => 
      page.name.toLowerCase().includes(query) || 
      page.description.toLowerCase().includes(query)
    )
    .map(page => {
      // Beräkna relevans
      let relevance = 0;
      
      if (page.name.toLowerCase().includes(query)) relevance += 7;
      if (page.description.toLowerCase().includes(query)) relevance += 5;
      
      return {
        id: page.id,
        type: 'settings' as SearchableResource,
        title: page.name,
        subtitle: 'Inställning',
        description: page.description,
        url: page.url,
        relevance,
        originalData: page
      };
    });
}

/**
 * Söker efter kundkort baserat på given söktext
 */
async function searchCustomerCards(query: string): Promise<SearchResult[]> {
  try {
    // Utför API-anrop för att söka kundkortsmallar
    const response = await fetch('/api/customerCards');
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const cards = await response.json();
    
    // Filtrera och mappa kundkort som matchar sökningen
    return cards
      .filter((card: any) => 
        card.cardName?.toLowerCase().includes(query) ||
        JSON.stringify(card.dynamicFields).toLowerCase().includes(query)
      )
      .map((card: any) => {
        // Beräkna relevans
        let relevance = 0;
        
        if (card.cardName?.toLowerCase().includes(query)) relevance += 8;
        
        // Sök i dynamiska fält
        if (card.dynamicFields) {
          try {
            const dynamicFields = card.dynamicFields;
            const fieldNames = Object.keys(dynamicFields);
            
            fieldNames.forEach(key => {
              if (key.toLowerCase().includes(query)) relevance += 4;
              
              try {
                // Försök parsa varje värde som JSON om det är en sträng
                const fieldData = typeof dynamicFields[key] === 'string' 
                  ? JSON.parse(dynamicFields[key]) 
                  : dynamicFields[key];
                
                if (fieldData.mapping?.toLowerCase().includes(query)) relevance += 3;
                if (fieldData.fieldName?.toLowerCase().includes(query)) relevance += 3;
              } catch (e) {
                // Ignorera fel vid parsing
              }
            });
          } catch (e) {
            console.error('Error parsing dynamic fields:', e);
          }
        }
        
        return {
          id: card.id,
          type: 'templateCards' as SearchableResource,
          title: card.cardName || `Kundkortsmall #${card.id}`,
          subtitle: 'Kundkortsmall',
          description: card.isDefault ? 'Standard kundkortsmall' : '',
          url: '/installningar?tab=kundkortsmallar',
          relevance,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
          originalData: card
        };
      });
  } catch (error) {
    console.error('Error searching customer cards:', error);
    return [];
  }
}

/**
 * Söker efter mallar baserat på given söktext
 */
async function searchTemplates(query: string): Promise<SearchResult[]> {
  try {
    // Utför API-anrop för att söka mailmallar
    const response = await fetch('/api/mail/templates');
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const templates = await response.json();
    
    // Filtrera och mappa mallar som matchar sökningen
    return templates
      .filter((template: any) => 
        template.name?.toLowerCase().includes(query) ||
        template.subject?.toLowerCase().includes(query) ||
        template.body?.toLowerCase().includes(query)
      )
      .map((template: any) => {
        // Beräkna relevans
        let relevance = 0;
        
        if (template.name?.toLowerCase().includes(query)) relevance += 8;
        if (template.subject?.toLowerCase().includes(query)) relevance += 6;
        if (template.body?.toLowerCase().includes(query)) relevance += 4;
        
        return {
          id: template.id,
          type: 'templates' as SearchableResource,
          title: template.name || `Mailmall #${template.id}`,
          subtitle: 'Mailmall',
          description: template.subject || '',
          url: '/installningar?tab=mailmallar',
          relevance,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          originalData: template
        };
      });
  } catch (error) {
    console.error('Error searching mail templates:', error);
    return [];
  }
}

/**
 * Exporterar en sökfunktion för användning i komponenter
 */
export default {
  search,
};