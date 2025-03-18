// utils/date-formatter.ts
// Ny hjälpfunktion för att hantera datumformatering

/**
 * Försöker konvertera olika datumformat till ett ISO-datumformat
 * Stödjer flera vanliga format, inklusive svenska format
 */
export function parseDate(dateString: string | Date | null | undefined): string | null {
    if (!dateString) return null;
    
    // Om det redan är ett Date-objekt, konvertera till ISO-sträng
    if (dateString instanceof Date) {
      return dateString.toISOString();
    }
    
    if (typeof dateString !== 'string') {
      return null;
    }
    
    // Försök först med standardparsning
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    try {
      // Rensa indata (ta bort extra mellanslag, etc.)
      const cleanedInput = dateString.trim();
      
      // Testa svenskt format (YYYY-MM-DD)
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanedInput)) {
        const [year, month, day] = cleanedInput.split('-').map(Number);
        const parsedDate = new Date(year, month - 1, day);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      }
      
      // Testa svenskt format med punkter (DD.MM.YYYY)
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(cleanedInput)) {
        const [day, month, year] = cleanedInput.split('.').map(Number);
        const parsedDate = new Date(year, month - 1, day);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      }
      
      // Testa svenskt/europeiskt format med snedstreck (DD/MM/YYYY)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanedInput)) {
        const [day, month, year] = cleanedInput.split('/').map(Number);
        const parsedDate = new Date(year, month - 1, day);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      }
      
      // Testa amerikanskt format med snedstreck (MM/DD/YYYY)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanedInput)) {
        const [month, day, year] = cleanedInput.split('/').map(Number);
        const parsedDate = new Date(year, month - 1, day);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      }
      
      // Testa format som "2023-01-01T00:00:00.000Z"
      if (cleanedInput.includes('T') && cleanedInput.includes('Z')) {
        const parsedDate = new Date(cleanedInput);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      }
      
      // Testa format som "1 januari 2023" eller "1 jan 2023" (svenska)
      const monthNamesSwedish = [
        "januari", "februari", "mars", "april", "maj", "juni", 
        "juli", "augusti", "september", "oktober", "november", "december",
        "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "okt", "nov", "dec"
      ];
      
      for (const monthName of monthNamesSwedish) {
        if (cleanedInput.toLowerCase().includes(monthName)) {
          const regex = new RegExp(`(\\d{1,2})\\s+${monthName}\\s+(\\d{4})`, 'i');
          const match = cleanedInput.match(regex);
          
          if (match && match.length >= 3) {
            const day = parseInt(match[1]);
            const year = parseInt(match[2]);
            let month = monthNamesSwedish.indexOf(monthName.toLowerCase());
            
            // Justera för förkortade månadsnamn
            if (month >= 12) {
              month = month - 12;
            }
            
            const parsedDate = new Date(year, month, day);
            if (!isNaN(parsedDate.getTime())) {
              return parsedDate.toISOString();
            }
          }
        }
      }
      
      // Om allt annat misslyckas, försök ta en kvalificerad gissning baserat på delad sträng
      const parts = cleanedInput.split(/[\/\-\.]/);
      if (parts.length === 3) {
        // Om första värdet är > 31, anta att det är år först (YYYY-MM-DD)
        if (parseInt(parts[0]) > 31) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          const day = parseInt(parts[2]);
          const parsedDate = new Date(year, month - 1, day);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
        // Om första värdet är > 12, anta att det är dag först (DD-MM-YYYY)
        else if (parseInt(parts[0]) > 12) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          const year = parseInt(parts[2]);
          const parsedDate = new Date(year, month - 1, day);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
        // Annars, anta att det är månad först (MM-DD-YYYY)
        else {
          const month = parseInt(parts[0]);
          const day = parseInt(parts[1]);
          const year = parseInt(parts[2]);
          const parsedDate = new Date(year, month - 1, day);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
      }
    } catch (error) {
      console.warn(`Kunde inte parse datum: ${dateString}`, error);
    }
    
    // Om ingen av metoderna fungerade
    return null;
  }