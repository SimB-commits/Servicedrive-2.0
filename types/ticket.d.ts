// src/types/ticket.ts

export interface Ticket {
  id: number;
  title?: string;
  description?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  customerId: number;
  assignedTo?: string; // Görs optionellt
  storeId: number;
  userId: string;
  ticketTypeId: number;
  dynamicFields: Record<string, string | number>;
  customer: Customer;
  assignedUser?: User;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: number;
  name: string;
  // Lägg till andra fält som behövs
}

export interface User {
  id: string;
  email: string;
  // Lägg till andra fält som behövs
}

export interface Message {
  id: number;
  // Lägg till andra fält som behövs
}

export interface TicketType {
  id: number;
  name: string;
  storeId: number;
  fields: TicketField[];
}

export interface TicketField {
  name: string;
  fieldType: 'TEXT' | 'NUMBER';
  isRequired: boolean;
}

  
