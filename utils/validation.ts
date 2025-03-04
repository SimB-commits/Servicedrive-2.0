// src/utils/validation.ts

import { z } from 'zod';
import { Prisma } from '@prisma/client';

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
