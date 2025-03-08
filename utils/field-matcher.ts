// utils/field-matcher.ts

/**
 * Beräknar likheten mellan två strängar med Levenshtein-avstånd
 * Returnerar ett värde mellan 0 (helt olika) och 1 (identiska)
 */
export function getStringSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0; // Identiska strängar
    if (s1.length === 0 || s2.length === 0) return 0.0; // En sträng är tom
    
    // Konvertera till lowercase för att ignorera skillnader i versaler/gemener
    const a = s1.toLowerCase();
    const b = s2.toLowerCase();
    
    // Beräkna Levenshtein-avstånd
    const matrix = [];
    
    // Förbereda matrisen
    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fylla matrisen
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // Borttagning
          matrix[i][j - 1] + 1, // Infogning
          matrix[i - 1][j - 1] + cost // Ersättning
        );
      }
    }
    
    // Maximal längd av båda strängarna
    const maxLength = Math.max(a.length, b.length);
    
    // Returnera likhet mellan 0-1
    if (maxLength === 0) return 1.0; // Båda strängarna tomma
    return 1.0 - matrix[a.length][b.length] / maxLength;
  }
  
  /**
   * Normaliserar ett fältnamn för jämförelse
   * Fokuserar på att ta bort specialtecken och normalisera versaler/gemener
   */
  export function normalizeFieldName(fieldName: string): string {
    if (!fieldName) return '';
    
    // Behåll field_ prefix om det finns
    if (fieldName.toLowerCase().startsWith('field_')) {
      // Extrahera endast delen efter field_ för normalisering
      const prefix = 'field_';
      const name = fieldName.substring(prefix.length);
      return prefix + normalizeGenericFieldName(name);
    }
    
    return normalizeGenericFieldName(fieldName);
  }
  
  /**
   * Utför generisk normalisering av ett fältnamn
   */
  function normalizeGenericFieldName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      // Ersätt svenska specialtecken med deras "vanliga" motsvarigheter för bättre matchning
      .replace(/å/g, 'a')
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      // Ta bort alla andra specialtecken och behåll bara alfanumeriska tecken
      .replace(/[^a-z0-9]/g, ' ')
      // Komprimera flera mellanslag till ett
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * En mer intelligent fältmatchare som använder olika strategier för att hitta den bästa matchningen
   */
  export class FieldMatcher {
    private commonPrefixes: string[] = ['field_', 'custom_', 'meta_', 'data_', 'user_', 'sys_'];
    private commonSuffixes: string[] = ['_id', '_date', '_time', '_name', '_type', '_value'];
    
    // Vanliga fältnamn som är generiska mellan olika verksamheter
    private commonFieldNames: Record<string, string[]> = {
      // Standardfält för kunder
      'customers': [
        'email', 'mail',
        'firstname', 'first name', 'fname', 'förnamn', 'given name',
        'lastname', 'last name', 'lname', 'efternamn', 'family name', 'surname',
        'name', 'fullname', 'full name', 'namn',
        'phone', 'telephone', 'mobile', 'telefon', 'mobilnummer',
        'address', 'adress', 'street',
        'city', 'stad', 'ort',
        'zip', 'zipcode', 'postal', 'postalcode', 'postnummer',
        'country', 'land',
        'company', 'organization', 'organisation', 'företag',
        'birth', 'birthday', 'birthdate', 'dateofbirth', 'födelsedatum',
        'newsletter', 'nyhetsbrev',
        'loyal', 'vip', 'membership', 'stamkund'
      ],
      
      // Standardfält för ärenden
      'tickets': [
        'title', 'subject', 'titel', 'ämne',
        'description', 'desc', 'text', 'beskrivning',
        'status', 'state',
        'priority', 'prioritet',
        'assignedto', 'assigned', 'tilldelad',
        'duedate', 'due', 'deadline', 'förfallodag',
        'created', 'createddate', 'created date', 'skapad',
        'updated', 'updateddate', 'updated date', 'uppdaterad',
        'comment', 'comments', 'kommentar', 'kommentarer', 'note', 'notes', 'anteckningar',
        'customerid', 'customer', 'kund', 'kundid',
        'customeremail', 'customer email', 'kundepost',
        'tickettypeid', 'tickettype', 'type', 'typ', 'ärendetyp'
      ]
    };
    
    /**
     * Hittar bästa matchning för ett källfält bland målfälten
     */
    findBestMatch(
        sourceField: string, 
        targetFields: string[], 
        targetType: 'customers' | 'tickets',
        threshold: number = 0.6 // Sänkt tröskel för att fånga fler matchningar
      ): { field: string, score: number } | null {
        // Kontrollera om vi redan har en exakt matchning
        const exactMatch = targetFields.find(f => 
          f.toLowerCase() === sourceField.toLowerCase()
        );
        if (exactMatch) {
          return { field: exactMatch, score: 1.0 };
        }
      
      // Specialhantering för field_ prefix
      if (sourceField.toLowerCase().startsWith('field_')) {
        const fieldName = sourceField.substring(6); // 'field_'.length = 6
        
        // För tickets, kolla om samma field_X finns i målfälten eller en variant
        if (targetType === 'tickets') {
          // Exact match med field_prefix
          const exactMatchWithPrefix = targetFields.find(t => 
            t.toLowerCase() === sourceField.toLowerCase()
          );
          if (exactMatchWithPrefix) {
            return { field: exactMatchWithPrefix, score: 1.0 };
          }
          const partialMatchesWithPrefix = targetFields
        .filter(t => t.toLowerCase().startsWith('field_'))
        .map(t => {
          const targetFieldName = t.substring(6).toLowerCase();
          const similarity = getStringSimilarity(fieldName.toLowerCase(), targetFieldName);
          return { field: t, score: similarity };
        })
        .filter(match => match.score > threshold);
      
      // Sortera på score och välj bästa match
      if (partialMatchesWithPrefix.length > 0) {
        partialMatchesWithPrefix.sort((a, b) => b.score - a.score);
        return partialMatchesWithPrefix[0];
      }
    }
        // För customers, försök mappa field_X till motsvarande kundfält X
        else {
          const matchingTarget = targetFields.find(t => 
            t.toLowerCase() === fieldName.toLowerCase()
          );
          if (matchingTarget) {
            return { field: matchingTarget, score: 0.95 };
          }
        }
      }

      if (!sourceField.toLowerCase().startsWith('field_') && targetType === 'tickets') {
        const matchesWithPrefix = targetFields
          .filter(t => t.toLowerCase().startsWith('field_'))
          .map(t => {
            const targetFieldName = t.substring(6).toLowerCase();
            const similarity = getStringSimilarity(sourceField.toLowerCase(), targetFieldName);
            return { field: t, score: similarity };
          })
          .filter(match => match.score > threshold);
        
        if (matchesWithPrefix.length > 0) {
          matchesWithPrefix.sort((a, b) => b.score - a.score);
          return matchesWithPrefix[0];
        }
      }
      
      // Normalisera källfält för jämförelse
      const normalizedSource = normalizeFieldName(sourceField);
      
      // Håll reda på bästa matchning
      let bestMatch = '';
      let bestScore = 0;
      
      // Steg 1: Först försök med exakta matchningar av normaliserade strängar
  for (const targetField of targetFields) {
    const normalizedTarget = normalizeFieldName(targetField);
    
    if (normalizedSource === normalizedTarget) {
      return { field: targetField, score: 1.0 };
    }
  }
  
  // Steg 2: Kontrollera vanliga grundläggande fältnamn
  if (this.commonFieldNames[targetType]) {
    for (const commonField of this.commonFieldNames[targetType]) {
      // Leta efter delsträngar i källfältet som matchar vanliga fältnamn
      if (normalizedSource.includes(commonField)) {
        // Hitta motsvarande målfält för detta vanliga fältnamn
        for (const targetField of targetFields) {
          const normalizedTarget = normalizeFieldName(targetField);
          if (normalizedTarget.includes(commonField)) {
            const similarity = getStringSimilarity(normalizedSource, normalizedTarget);
            if (similarity > bestScore) {
              bestMatch = targetField;
              bestScore = similarity;
            }
          }
        }
      }
    }
  }
  
  // Steg 3: Hantera specialfall med svenska tecken och vanliga variationer
  for (const targetField of targetFields) {
    const normalizedTarget = normalizeFieldName(targetField);
    
    // Ignorera om vi redan har en hög poäng
    if (bestScore > 0.9) continue;
    
    // Specialfall för dynamiska fält inom tickets
    if (targetType === 'tickets' && targetField.startsWith('field_')) {
      // För fält som "field_Sulmått" vs "sulmatt", jämför utan prefix och normalisera
      const targetWithoutPrefix = targetField.substring(6).toLowerCase();
      const cleanedSource = sourceField.toLowerCase().replace(/[^a-zåäö0-9]/g, '');
      const cleanedTarget = targetWithoutPrefix.replace(/[^a-zåäö0-9]/g, '');
      
      // Ersätt svenska tecken för jämförelse
      const simplifiedSource = cleanedSource
        .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
      const simplifiedTarget = cleanedTarget
        .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
      
      // Kontrollera om de liknar varandra
      if (simplifiedSource.includes(simplifiedTarget) || 
          simplifiedTarget.includes(simplifiedSource)) {
        const len = Math.min(simplifiedSource.length, simplifiedTarget.length);
        const score = len / Math.max(simplifiedSource.length, simplifiedTarget.length) * 0.9;
        if (score > bestScore) {
          bestMatch = targetField;
          bestScore = score;
        }
      }
    }
    
    // Kontrollera matchande prefix
    for (const prefix of this.commonPrefixes) {
      if (normalizedSource.startsWith(prefix) && normalizedTarget.startsWith(prefix)) {
        // Ta bort prefix och jämför resten
        const sourceWithoutPrefix = normalizedSource.substring(prefix.length);
        const targetWithoutPrefix = normalizedTarget.substring(prefix.length);
        const similarity = getStringSimilarity(sourceWithoutPrefix, targetWithoutPrefix);
        
        // Ge extra poäng för matchande prefix
        const adjustedScore = similarity * 1.1;
        if (adjustedScore > bestScore) {
          bestMatch = targetField;
          bestScore = Math.min(adjustedScore, 1.0);
        }
      }
    }
    
    // Kontrollera matchande suffix
    for (const suffix of this.commonSuffixes) {
      if (normalizedSource.endsWith(suffix) && normalizedTarget.endsWith(suffix)) {
        // Ta bort suffix och jämför resten
        const sourceWithoutSuffix = normalizedSource.substring(0, normalizedSource.length - suffix.length);
        const targetWithoutSuffix = normalizedTarget.substring(0, normalizedTarget.length - suffix.length);
        const similarity = getStringSimilarity(sourceWithoutSuffix, targetWithoutSuffix);
        
        // Ge extra poäng för matchande suffix
        const adjustedScore = similarity * 1.1;
        if (adjustedScore > bestScore) {
          bestMatch = targetField;
          bestScore = Math.min(adjustedScore, 1.0);
        }
      }
    }
  }
  
  // Steg 4: Fallback till generell stränglikhet om inget annat matchade
  if (bestScore < threshold) {
    for (const targetField of targetFields) {
      const normalizedTarget = normalizeFieldName(targetField);
      const similarity = getStringSimilarity(normalizedSource, normalizedTarget);
      
      if (similarity > bestScore) {
        bestMatch = targetField;
        bestScore = similarity;
      }
    }
  }
  
  // Returnera matchningen om den uppfyller tröskelvärdet
  return bestScore >= threshold ? { field: bestMatch, score: bestScore } : null;
}
    
    /**
     * Skapar en mapping från källfält till målfält
     */
    createMapping(
        sourceFields: string[], 
        targetFields: string[], 
        targetType: 'customers' | 'tickets'
      ): Record<string, string> {
        console.log("Skapa mappning för:", sourceFields.length, "källfält och", targetFields.length, "målfält");
        console.log("Källfält:", sourceFields);
        console.log("Målfält:", targetFields);
        
        const mapping: Record<string, string> = {};
        
        // Spåra redan använda målfält för att undvika dubbletter
        const usedTargetFields = new Set<string>();
        
        // Steg 1: Hitta exakta matchningar först (oavsett case)
        sourceFields.forEach(sourceField => {
          const exactMatch = targetFields.find(t => 
            !usedTargetFields.has(t) && 
            t.toLowerCase() === sourceField.toLowerCase()
          );
          
          if (exactMatch) {
            mapping[sourceField] = exactMatch;
            usedTargetFields.add(exactMatch);
            console.log(`Exakt matchning: ${sourceField} -> ${exactMatch}`);
          }
        });
        
        // Steg 2: Prioritera field_-prefix matchningar 
        const fieldPrefixSourceFields = sourceFields
          .filter(sourceField => !mapping[sourceField]) // Hoppa över redan mappade
          .filter(sourceField => sourceField.toLowerCase().startsWith('field_'));
        
        console.log("Källfält med field_ prefix:", fieldPrefixSourceFields);
        
        fieldPrefixSourceFields.forEach(sourceField => {
          const fieldName = sourceField.substring(6); // 'field_'.length = 6
          
          if (targetType === 'tickets') {
            // För tickets, leta efter exakt samma field_X eller liknande
            const fieldsWithPrefix = targetFields.filter(t => 
              !usedTargetFields.has(t) && 
              t.toLowerCase().startsWith('field_')
            );
            
            console.log(`Söker matchning för ${sourceField} bland ${fieldsWithPrefix.length} fält med prefix`);
            
            // Först leta efter exakt matchning
            const exactPrefixMatch = fieldsWithPrefix.find(t => 
              t.toLowerCase() === sourceField.toLowerCase()
            );
            
            if (exactPrefixMatch) {
              mapping[sourceField] = exactPrefixMatch;
              usedTargetFields.add(exactPrefixMatch);
              console.log(`Exakt prefix-matchning: ${sourceField} -> ${exactPrefixMatch}`);
              return;
            }
            
            // Sedan leta efter partiell matchning mellan det som kommer efter prefixen
            const bestPartialMatches = fieldsWithPrefix
              .map(targetField => {
                const targetWithoutPrefix = targetField.substring(6).toLowerCase();
                const similarity = getStringSimilarity(fieldName.toLowerCase(), targetWithoutPrefix);
                return { field: targetField, score: similarity };
              })
              .filter(match => match.score > 0.6)
              .sort((a, b) => b.score - a.score);
            
            if (bestPartialMatches.length > 0) {
              const bestMatch = bestPartialMatches[0];
              mapping[sourceField] = bestMatch.field;
              usedTargetFields.add(bestMatch.field);
              console.log(`Partiell prefix-matchning: ${sourceField} -> ${bestMatch.field} (score: ${bestMatch.score.toFixed(2)})`);
              return;
            }
          } 
          // För customers, mappa field_X till X
          else {
            const matchingTarget = targetFields.find(t => 
              !usedTargetFields.has(t) &&
              t.toLowerCase() === fieldName.toLowerCase()
            );
            
            if (matchingTarget) {
              mapping[sourceField] = matchingTarget;
              usedTargetFields.add(matchingTarget);
              console.log(`Customer field_-matchning: ${sourceField} -> ${matchingTarget}`);
            }
          }
        });
        
        // Steg 3: Kolla om några källfält utan prefix matchar målfält med prefix
        if (targetType === 'tickets') {
          const nonPrefixedSourceFields = sourceFields
            .filter(sourceField => !mapping[sourceField]) // Hoppa över redan mappade
            .filter(sourceField => !sourceField.toLowerCase().startsWith('field_'));
          
          nonPrefixedSourceFields.forEach(sourceField => {
            // Leta efter field_X där X liknar sourceField
            const targetFieldsWithPrefix = targetFields
              .filter(t => !usedTargetFields.has(t) && t.toLowerCase().startsWith('field_'))
              .map(t => {
                const fieldNameAfterPrefix = t.substring(6).toLowerCase();
                const similarity = getStringSimilarity(sourceField.toLowerCase(), fieldNameAfterPrefix);
                return { field: t, score: similarity };
              })
              .filter(match => match.score > 0.7)
              .sort((a, b) => b.score - a.score);
            
            if (targetFieldsWithPrefix.length > 0) {
              const bestMatch = targetFieldsWithPrefix[0];
              mapping[sourceField] = bestMatch.field;
              usedTargetFields.add(bestMatch.field);
              console.log(`Matchning utan prefix -> med prefix: ${sourceField} -> ${bestMatch.field} (score: ${bestMatch.score.toFixed(2)})`);
            }
          });
        }
        
        // Steg 4: Använd findBestMatch för resten
        sourceFields
          .filter(sourceField => !mapping[sourceField]) // Hoppa över redan mappade
          .forEach(sourceField => {
            // Filtrera bort redan använda målfält
            const availableTargets = targetFields.filter(t => !usedTargetFields.has(t));
            
            const match = this.findBestMatch(sourceField, availableTargets, targetType);
            if (match) {
              mapping[sourceField] = match.field;
              usedTargetFields.add(match.field);
              console.log(`Best match: ${sourceField} -> ${match.field} (score: ${match.score.toFixed(2)})`);
            } else {
              console.log(`Ingen matchning hittades för: ${sourceField}`);
            }
          });
        
        console.log("Slutlig mappning:", mapping);
        return mapping;
      }
  }
