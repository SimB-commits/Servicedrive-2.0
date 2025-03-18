// src/utils/validation.ts

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { parseDate } from './date-formatter';

const dateOrString = z.preprocess((arg) => {
  // If no value is sent, return as is
  if (arg === null || arg === undefined || arg === '') {
    return null;
  }
  
  // If it's a string
  if (typeof arg === "string") {
    // If the string is empty, return null
    if (arg.trim() === "") {
      return null;
    }
    
    // Try to parse the date
    try {
      // First try standard Date.parse
      const parsed = Date.parse(arg);
      if (!isNaN(parsed)) {
        return new Date(parsed);
      }
      
      // Try different date formats
      // For Swedish format (dd/mm/yyyy or dd-mm-yyyy)
      if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(arg)) {
        const parts = arg.split(/[\/\-\.]/);
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    } catch (e) {
      // If parsing fails, return the original string
      return arg;
    }
  }
  return arg;
}, z.union([z.string(), z.date(), z.null()]));

// Definiera ett schema för change-password
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8, 'Nuvarande lösenord måste vara minst 8 tecken'),
  newPassword: z
    .string()
    .min(8, 'Nytt lösenord måste vara minst 8 tecken')
    .refine((val) => /[A-Z]/.test(val), {
      message: 'Nytt lösenord måste innehålla minst en stor bokstav',
    })
    .refine((val) => /[a-z]/.test(val), {
      message: 'Nytt lösenord måste innehålla minst en liten bokstav',
    })
    .refine((val) => /[0-9]/.test(val), {
      message: 'Nytt lösenord måste innehålla minst en siffra',
    }),
});

  //Schema för registrering
  
export const signupSchema = z.object({
    email: z.string().email('Ogiltig email-adress'),
    password: z
      .string()
      .min(8, 'Lösenordet måste vara minst 8 tecken')
      .refine((val) => /[A-Z]/.test(val), {
        message: 'Lösenordet måste innehålla minst en stor bokstav',
      })
      .refine((val) => /[a-z]/.test(val), {
        message: 'Lösenordet måste innehålla minst en liten bokstav',
      })
      .refine((val) => /[0-9]/.test(val), {
        message: 'Lösenordet måste innehålla minst en siffra',
      }),
    company: z.string().min(2, 'Företagets namn måste vara minst 2 tecken'),
    address: z.string().min(5, 'Adress måste vara minst 5 tecken'),
  });

  // Schema för kundhantering 

export const createCustomerSchema = z.object({
  firstName: z.string().min(2, 'Förnamn måste vara minst 2 tecken').optional(),
  lastName: z.string().min(2, 'Efternamn måste vara minst 2 tecken').optional(),
  address: z.string().min(2, 'Adress måste vara minst 2 tecken').optional(),
  postalCode: z.string().min(2, 'Postnummer måste vara minst 2 tecken').optional(),
  city: z.string().min(2, 'Ort måste vara minst 2 tecken').optional(),
  country: z.string().min(2, 'Land måste vara minst 2 tecken').optional(),
  dateOfBirth: z.string().refine(date => !isNaN(new Date(date).getTime()), {
    message: 'Ogiltigt datum',
  }).optional(),
  email: z.string().email('Ogiltig email-adress').optional(),
  phoneNumber: z.string().min(7, 'Telefonnummer måste vara minst 7 tecken').optional(),
  newsletter: z.boolean().optional(),
  loyal: z.boolean().optional(),
  dynamicFields: z.record(z.string()).optional(),
});

export const updateCustomerSchema = z.object({
  firstName: z.string().min(2, 'Förnamn måste vara minst 2 tecken').optional(),
  lastName: z.string().min(2, 'Efternamn måste vara minst 2 tecken').optional(),
  address: z.string().min(2, 'Adress måste vara minst 2 tecken').optional(),
  postalCode: z.string().min(2, 'Postnummer måste vara minst 2 tecken').optional(),
  city: z.string().min(2, 'Ort måste vara minst 2 tecken').optional(),
  country: z.string().min(2, 'Land måste vara minst 2 tecken').optional(),
  dateOfBirth: z.string().refine(date => !date || !isNaN(new Date(date).getTime()), {
    message: 'Ogiltigt datum',
  }).optional().nullable(),
  email: z.string().email('Ogiltig email-adress').optional(),
  phoneNumber: z.string().min(7, 'Telefonnummer måste vara minst 7 tecken').optional(),
  newsletter: z.boolean().optional(),
  loyal: z.boolean().optional(),
  dynamicFields: z.record(z.string()).optional(),
});

export const createCustomerCardSchema = z.object({
  cardName: z.string().min(1, 'Mallnamn krävs'),
  firstName: z.string().min(1, 'Förnamn bör anges').nullable().optional(),
  lastName: z.string().min(1, 'Efternamn bör anges').nullable().optional(),
  address: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  email: z.string().email('Ogiltig email-adress').nullable().optional(),
  phoneNumber: z.string().min(7, 'Telefonnummer måste vara minst 7 tecken').nullable().optional(),
  newsletter: z.boolean().optional(),
  loyal: z.boolean().optional(),
  dynamicFields: z.record(z.any()).nullable().optional(),
});

export const updateCustomerCardSchema = createCustomerCardSchema.partial();



  // **Nya scheman för TicketTypes**

  export const createTicketTypeSchema = z.object({
    name: z.string().min(1, 'Namn krävs'),
    storeId: z.number(), // Om storeId krävs
    fields: z
      .array(
        z.object({
          name: z.string()
            .min(1, 'Fältnamn krävs')
            .regex(/^[A-Za-zÅÄÖåäö0-9\s\- ]+$/, 'Fältnamn kan endast innehålla bokstäver, siffror och mellanslag'),
          fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', "DUE_DATE", "CHECKBOX"]),
          isRequired: z.boolean().optional(), // Checkbox
        })
      )
      .max(10, 'Max 10 fält per TicketType'),
  });

  export const updateTicketTypeSchema = z.object({
    name: z.string().min(1, 'Namn krävs').optional(),
    fields: z
      .array(
        z.object({
          name: z.string()
            .min(1, 'Fältnamn krävs')
            .regex(/^[A-Za-zÅÄÖåäö0-9\s\- ]+$/, 'Fältnamn kan endast innehålla bokstäver, siffror och mellanslag'),
          fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'DUE_DATE', 'CHECKBOX']),
          isRequired: z.boolean().optional(), // Checkbox
        })
      )
      .max(10, 'Max 10 fält per TicketType')
      .optional(),
  });

// **Nya scheman för Tickets**

export const createTicketSchema = z.object({
  ticketTypeId: z.number().int().positive({ message: 'Välj en giltig Ticket Type' }),
  customerId: z.number().int().positive({ message: 'Välj en giltig Customer' }),
  dueDate: z.string().optional().nullable(),
  dynamicFields: z.record(z.string())

});

export const updateTicketSchema = z.object({
  description: z.string().min(1, 'Beskrivning krävs').optional(),
  status: z.string().optional(),
  dueDate: z.string().optional(),
  dynamicFields: z.record(z.string())
});

export const createTicketStatusSchema = z.object({
  name: z.string().min(1, { message: 'Namn är obligatoriskt' }),
  mailTemplateId: z.number().nullable().optional(), // tillåter att ingen mall väljs
  color: z.string().min(4, { message: 'Ange en giltig färgkod' }),
});

export const updateTicketStatusSchema = z.object({
  name: z.string().optional(),
  mailTemplateId: z.number().nullable().optional(), // tillåter att ingen mall väljs
  color: z.string().min(4, { message: 'Ange en giltig färgkod' }).optional(),
});

export const createMailTemplateSchema = z.object({
  name: z.string().min(1, { message: 'Namn är obligatoriskt' }),
  subject: z.string().min(1, { message: 'Ämne är obligatoriskt' }),
  body: z.string().min(1, { message: 'Brödtext är obligatorisk' }),
});

export const updateMailTemplateSchema = z.object({
  name: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

// Schema för kundimport med flexiblare valideringsregler
export const importCustomerSchema = z.object({
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  dateOfBirth: z.union([z.string(), z.date()]).optional().nullable(),
  email: z.string().email('Ogiltig email-adress'), // Email är fortfarande obligatoriskt
  phoneNumber: z.union([z.string(), z.number()]).optional().nullable()
    .transform(val => val ? String(val) : null),
  newsletter: z.union([z.boolean(), z.string(), z.number()]).optional()
    .transform(val => {
      if (typeof val === 'string') {
        return ['true', 'yes', 'ja', '1', 'y'].includes(val.toLowerCase());
      }
      if (typeof val === 'number') {
        return val === 1;
      }
      return Boolean(val);
    }),
  loyal: z.union([z.boolean(), z.string(), z.number()]).optional()
    .transform(val => {
      if (typeof val === 'string') {
        return ['true', 'yes', 'ja', '1', 'y'].includes(val.toLowerCase());
      }
      if (typeof val === 'number') {
        return val === 1;
      }
      return Boolean(val);
    }),
  dynamicFields: z.record(z.any()).optional().nullable(),
  
  // VIKTIGT: Det följande används för upptäckt av externa ID, men sparas INTE i resultatet
  externalId: z.union([z.string(), z.number()]).optional(),
  external_id: z.union([z.string(), z.number()]).optional().transform(() => undefined), // Rensa detta fält
  customer_id: z.union([z.string(), z.number()]).optional().transform(() => undefined), // Rensa detta fält
  kundnummer: z.union([z.string(), z.number()]).optional().transform(() => undefined)   // Rensa detta fält
}).transform(data => {
  // Ta bort de extra fälten från det slutliga objektet
  // Detta säkerställer att endast de fält som matchar Prisma-schemat skickas till databasen
  const result = { ...data };
  
  // Ta bort fält som vi endast använder för upptäckt men inte vill skicka till Prisma
  delete result.external_id;
  delete result.customer_id;
  delete result.kundnummer;
  
  return result;
});

// Schema för ärendeimport med flexiblare valideringsregler
export const importTicketSchema = z.object({
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  
  // Använd dateOrString för mer flexibel validering av dueDate
  dueDate: dateOrString.optional().nullable(),

  // Nya fält för att stödja importerade ärenden med ursprungliga datum
  createdAt: dateOrString.optional().nullable(),
  updatedAt: dateOrString.optional().nullable(),
  
  customerId: z.number().optional().nullable(),
  customerEmail: z.string().email('Ogiltig email-adress').optional().nullable(), 
  
  // Externa kund-ID fält
  customer_external_id: z.union([z.string(), z.number()]).optional()
    .transform(val => val !== undefined ? String(val) : undefined),
  external_id: z.union([z.string(), z.number()]).optional()
    .transform(val => val !== undefined ? String(val) : undefined),
  customer_id: z.union([z.string(), z.number()]).optional()
    .transform(val => val !== undefined ? String(val) : undefined),
  kundnummer: z.union([z.string(), z.number()]).optional()
    .transform(val => val !== undefined ? String(val) : undefined),
    
  ticketTypeId: z.number().optional().nullable(),
  dynamicFields: z.record(z.any()).optional().nullable(),
}).refine(data => 
  data.customerId || 
  data.customerEmail || 
  data.customer_external_id || 
  data.external_id || 
  data.customer_id || 
  data.kundnummer, {
    message: "En kundidentifierare måste anges (customerId, customerEmail eller externt ID)",
    path: ["customerEmail"],
  }
).transform(data => {
  // Om vi har ett dueDate-fält som är en sträng, försök konvertera det till ett datum
  if (data.dueDate && typeof data.dueDate === 'string') {
    const parsedDate = parseDate(data.dueDate);
    if (parsedDate) {
      data.dueDate = parsedDate;
    }
  }
  
  // Försök konvertera createdAt/updatedAt om de finns
  if (data.createdAt) {
    const parsedDate = parseDate(data.createdAt);
    if (parsedDate) {
      data.createdAt = parsedDate;
    }
  }
  
  if (data.updatedAt) {
    const parsedDate = parseDate(data.updatedAt);
    if (parsedDate) {
      data.updatedAt = parsedDate;
    }
  }
  
  // Kontrollera även dynamiska fält för datum och dueDate relaterade fält
  if (data.dynamicFields) {
    Object.keys(data.dynamicFields).forEach(key => {
      const value = data.dynamicFields?.[key];
      const keyLower = key.toLowerCase();
      
      // Om detta ser ut som ett dueDate-fält och vi inte har ett dueDate redan
      if (!data.dueDate && 
         (keyLower.includes('due') || 
          keyLower.includes('deadline') || 
          keyLower.includes('date') ||
          keyLower.includes('datum') ||
          keyLower.includes('förfall'))) {
        
        const parsedDate = parseDate(value);
        if (parsedDate) {
          data.dueDate = parsedDate;
        }
      }
      
      // Om detta ser ut som ett createdAt-fält och vi inte har createdAt redan
      if (!data.createdAt &&
         (keyLower.includes('created') ||
          keyLower.includes('skapad') ||
          keyLower.includes('skapades') ||
          keyLower.includes('creation'))) {
        
        const parsedDate = parseDate(value);
        if (parsedDate) {
          data.createdAt = parsedDate;
        }
      }
    });
  }
  
  return data;
});

// Typ för importdata
export type ImportCustomerData = z.infer<typeof importCustomerSchema>;
export type ImportTicketData = z.infer<typeof importTicketSchema>;

// Typ för att skapa TicketType
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;

// Typ för att uppdatera TicketType
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;

// Typ för att skapa Ticket
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

// Typ för att uppdatera Ticket
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

// Typ för att skapa TicketStatus
export type CreateTicketStatusInput = z.infer<typeof createTicketStatusSchema>;

// Typ för att uppdatera TicketStatus
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;

// Typ för att skapa mailmall
export type CreateMailTemplateInput = z.infer<typeof createMailTemplateSchema>;

// Typ för att uppdatera mailmall
export type UpdateMailTemplateInput = z.infer<typeof updateMailTemplateSchema>;

// Typ för att skapa kundkort
export type createCustomerCardSchemaType = z.infer<typeof createCustomerCardSchema>;

// Typ för att uppdatera kundkort
export type updateCustomerCardSchemaType = z.infer<typeof updateCustomerCardSchema>;

// Om du har andra valideringsscheman kan du lägga till dem här
