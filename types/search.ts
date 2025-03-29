// types/search.ts
export interface SearchCustomer {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
    phoneNumber?: string;
  }
  
  export interface SearchTicket {
    id: number;
    status?: string;
    customer?: SearchCustomer;
    ticketType?: {
      name: string;
    };
    customStatus?: {
      name: string;
      color: string;
    };
  }
  
  export interface SearchSetting {
    type: string;
    name: string;
    description: string;
    url: string;
  }
  
  export interface SearchResults {
    customers: SearchCustomer[];
    tickets: SearchTicket[];
    settings: SearchSetting[];
  }
  
  export interface SearchResponse {
    query: string;
    results: SearchResults;
    totalCount: {
      customers: number;
      tickets: number;
      settings: number;
      total: number;
    };
  }