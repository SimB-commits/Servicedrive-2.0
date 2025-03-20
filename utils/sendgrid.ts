// utils/sendgrid.ts
import sgMail from '@sendgrid/mail';
import { logger } from './logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define the default domain as a constant for consistent usage
const DEFAULT_DOMAIN = 'servicedrive.se';

/**
 * SendGrid configuration - centralize all settings
 */
export const sendgridConfig = {
  apiKey: process.env.SENDGRID_API_KEY,
  defaultFromEmail: process.env.EMAIL_FROM || `no-reply@${DEFAULT_DOMAIN}`,
  companySupportEmail: process.env.SUPPORT_EMAIL || `support@${DEFAULT_DOMAIN}`,
  maxRetries: 3,
  debugMode: process.env.NODE_ENV !== 'production',
  // Parse verified domains from environment variable, always include servicedrive.se
  get verifiedDomains() {
    // Always include the default domain, plus any from environment variables
    const domainsFromEnv = (process.env.SENDGRID_VERIFIED_DOMAINS || '')
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);
    
    return [...new Set([DEFAULT_DOMAIN, ...domainsFromEnv])];
  }
};

// Cache mechanism for verified domains
let domainCache: Record<number, string[]> = {}; // Store domains by storeId
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize the domain cache on module start
 */
const initDomainCache = async () => {
  try {
    // Get all verified domains from the database
    const dbDomains = await prisma.verifiedDomain.findMany({
      where: { status: 'verified' },
      select: { domain: true, storeId: true }
    });
    
    // Group domains by storeId, always include DEFAULT_DOMAIN
    domainCache = {};
    
    // Get all stores to ensure each one has at least DEFAULT_DOMAIN
    const stores = await prisma.store.findMany({
      select: { id: true }
    });
    
    // Initialize with DEFAULT_DOMAIN for all stores
    stores.forEach(store => {
      domainCache[store.id] = [DEFAULT_DOMAIN];
    });
    
    // Add other verified domains
    dbDomains.forEach(({ domain, storeId }) => {
      if (!domainCache[storeId]) {
        domainCache[storeId] = [DEFAULT_DOMAIN];
      }
      
      const normalizedDomain = domain.toLowerCase();
      if (normalizedDomain !== DEFAULT_DOMAIN && !domainCache[storeId].includes(normalizedDomain)) {
        domainCache[storeId].push(normalizedDomain);
      }
    });
    
    lastCacheTime = Date.now();
    logger.info('Domain cache initialized', { 
      stores: Object.keys(domainCache).length,
      totalDomains: dbDomains.length
    });
  } catch (error) {
    logger.error('Error initializing domain cache', { error: error.message });
    
    // Ensure at least an empty cache exists
    domainCache = {};
  }
};

/**
 * Refresh the cache if necessary
 */
const refreshDomainCache = async () => {
  if (Date.now() - lastCacheTime > CACHE_TTL) {
    await initDomainCache();
  }
};

/**
 * Get verified domains for a store
 */
export const getVerifiedDomains = async (storeId: number): Promise<string[]> => {
  await refreshDomainCache();
  return domainCache[storeId] || [DEFAULT_DOMAIN];
};

/**
 * Validate if a sender email is approved for SendGrid
 * Check against domains in the database
 */
export const validateSenderEmailByStore = async (email: string, storeId: number): Promise<{ valid: boolean; reason?: string }> => {
  if (!email || !email.includes('@')) {
    return { valid: false, reason: 'Ogiltig e-postadressformat' };
  }
  
  // Extract domain from email
  const emailDomain = email.split('@')[1]?.toLowerCase();
  
  // Always allow DEFAULT_DOMAIN
  if (emailDomain === DEFAULT_DOMAIN) {
    return { valid: true };
  }
  
  // In development mode, accept all addresses
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(`Sender verification bypassed in development mode for: ${email}`);
    return { valid: true };
  }
  
  // Refresh the cache if necessary
  await refreshDomainCache();
  
  // Ensure storeId has an entry in the cache
  if (!domainCache[storeId]) {
    domainCache[storeId] = [DEFAULT_DOMAIN];
    
    // Ensure default domain exists in DB
    await ensureDefaultDomain(storeId);
  }
  
  // Check if domain is in the store's list
  if (domainCache[storeId]?.some(domain => emailDomain === domain)) {
    return { valid: true };
  }
  
  // Get verified domains for this store for error message
  const domains = domainCache[storeId] || [DEFAULT_DOMAIN];
  
  return { 
    valid: false, 
    reason: `Domänen ${emailDomain} är inte verifierad för din butik. Verifierade domäner: ${domains.join(', ')}`
  };
};

/**
 * Create a standard servicedrive.se domain for the store if it doesn't already exist
 */
export const ensureDefaultDomain = async (storeId: number): Promise<void> => {
  try {
    // Check if DEFAULT_DOMAIN already exists for this store
    const existingDomain = await prisma.verifiedDomain.findFirst({
      where: {
        storeId,
        domain: DEFAULT_DOMAIN
      }
    });
    
    // If it doesn't exist, create it
    if (!existingDomain) {
      await prisma.verifiedDomain.create({
        data: {
          domain: DEFAULT_DOMAIN,
          domainId: `default-${DEFAULT_DOMAIN.replace('.', '-')}-${storeId}`,
          storeId,
          status: 'verified',
          verifiedAt: new Date()
        }
      });
      
      logger.info(`Added ${DEFAULT_DOMAIN} as verified domain for store ${storeId}`);
      
      // Update cache immediately
      if (!domainCache[storeId]) {
        domainCache[storeId] = [DEFAULT_DOMAIN];
      } else if (!domainCache[storeId].includes(DEFAULT_DOMAIN)) {
        domainCache[storeId].push(DEFAULT_DOMAIN);
      }
    }
  } catch (error) {
    logger.error('Error ensuring default domain', { error: error.message, storeId });
  }
};

/**
 * Validate that a sender email is approved for SendGrid
 * SendGrid requires verified senders to prevent spoofing
 */
export const validateSenderEmail = (email: string): { valid: boolean; reason?: string } => {
  if (!email || !email.includes('@')) {
    return { valid: false, reason: 'Ogiltig e-postadressformat' };
  }
  
  // Extract domain from email
  const emailDomain = email.split('@')[1]?.toLowerCase();
  
  // Always allow DEFAULT_DOMAIN
  if (emailDomain === DEFAULT_DOMAIN) {
    return { valid: true };
  }
  
  // In development mode and no domains configured, accept all
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(`Sender verification bypassed in development mode for: ${email}`);
    return { valid: true };
  }
  
  // Check if domain is in the verified domains list
  const isVerified = sendgridConfig.verifiedDomains.some(domain => 
    emailDomain === domain.toLowerCase()
  );
  
  if (!isVerified) {
    return { 
      valid: false, 
      reason: `Domänen ${emailDomain} är inte verifierad i SendGrid. Verifierade domäner: ${sendgridConfig.verifiedDomains.join(', ')}`
    };
  }
  
  return { valid: true };
};

/**
 * Get all verified sender addresses for a store
 */
export const getVerifiedSenderAddresses = async (storeId: number): Promise<SenderAddress[]> => {
  try {
    // Get the store's configured sender addresses from database
    const senderAddresses = await prisma.senderAddress.findMany({
      where: { storeId: storeId }
    });
    
    // If the store has configured addresses, return them
    if (senderAddresses.length > 0) {
      return senderAddresses.map(addr => ({
        id: addr.id,
        email: addr.email,
        name: addr.name || undefined,
        default: addr.isDefault,
        isVerified: true  // Already verified in database
      }));
    }
    
    // If no addresses are configured, generate from verified domains
    const defaultAddresses: SenderAddress[] = [];
    
    // Add DEFAULT_DOMAIN addresses as options
    defaultAddresses.push({
      email: `no-reply@${DEFAULT_DOMAIN}`,
      name: 'Servicedrive',
      default: true,
      isVerified: true
    });
    
    defaultAddresses.push({
      email: `support@${DEFAULT_DOMAIN}`,
      name: 'Kundsupport',
      default: false,
      isVerified: true
    });
    
    // Get verified domains for this store
    const storeDomains = await getVerifiedDomains(storeId);
    
    // Generate addresses from verified domains (excluding DEFAULT_DOMAIN which we already added)
    storeDomains
      .filter(domain => domain !== DEFAULT_DOMAIN)
      .forEach(domain => {
        // Create some suggestions based on the domain
        defaultAddresses.push({
          email: `no-reply@${domain}`,
          name: 'Automatiskt Utskick',
          default: false,
          isVerified: true
        });
        
        defaultAddresses.push({
          email: `info@${domain}`,
          name: 'Information',
          default: false,
          isVerified: true
        });
      });
    
    return defaultAddresses;
  } catch (error) {
    logger.error('Error getting verified sender addresses', { error: error.message });
    
    // Return at least the default address on error
    return [{
      email: `no-reply@${DEFAULT_DOMAIN}`,
      name: 'Servicedrive',
      default: true,
      isVerified: true
    }];
  }
};

/**
 * Save a new sender address for a store after verification
 */
export const saveSenderAddress = async (
  storeId: number, 
  email: string, 
  name?: string, 
  setDefault: boolean = false
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    // Special case for DEFAULT_DOMAIN which is always verified
    const emailDomain = email.split('@')[1]?.toLowerCase();
    let validation = { valid: emailDomain === DEFAULT_DOMAIN };
    
    // For non-default domains, validate
    if (emailDomain !== DEFAULT_DOMAIN) {
      validation = await validateSenderEmailByStore(email, storeId);
    }
    
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }
    
    // If this should be default, deactivate other default addresses
    if (setDefault) {
      await prisma.senderAddress.updateMany({
        where: { storeId, isDefault: true },
        data: { isDefault: false }
      });
    }
    
    // Try to update if address already exists
    const existingAddress = await prisma.senderAddress.findFirst({
      where: { storeId, email }
    });
    
    if (existingAddress) {
      // Update existing address
      const updated = await prisma.senderAddress.update({
        where: { id: existingAddress.id },
        data: { name, isDefault: setDefault }
      });
      
      return { success: true, data: updated };
    } else {
      // Create new address
      const created = await prisma.senderAddress.create({
        data: { storeId, email, name, isDefault: setDefault }
      });
      
      return { success: true, data: created };
    }
  } catch (error) {
    logger.error('Error saving sender address', { error: error.message });
    return { success: false, error: 'Kunde inte spara avsändaradressen: ' + error.message };
  }
};

// Interface for mail data
export interface EmailData {
  to: string | string[];
  from: string;
  fromName?: string; // Name of sender (display name)
  subject: string;
  text?: string;
  html: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: any[];
  categories?: string[]; // Useful for tracking
}

// Interface for sender address
export interface SenderAddress {
  id?: number;
  email: string;
  name?: string;
  default?: boolean;
  isVerified: boolean;
}

// Interface for mail template variables
export interface TemplateVariables {
  [key: string]: string | number | boolean | Date | null | undefined;
}

/**
 * Initialize SendGrid with API key and validate configuration
 * @returns Boolean indicating if initialization was successful
 */
export const initSendGrid = (): boolean => {
  // Validate that API key exists
  if (!sendgridConfig.apiKey) {
    logger.error('SendGrid API key missing in environment variables. Email functions will not work.');
    return false;
  }
  
  try {
    sgMail.setApiKey(sendgridConfig.apiKey);
    logger.info('SendGrid initialized successfully');
    
    // Warn if no additional verified domains are configured
    if (sendgridConfig.verifiedDomains.length <= 1 && process.env.NODE_ENV === 'production') {
      logger.warn('No additional verified domains configured for SendGrid. Set SENDGRID_VERIFIED_DOMAINS environment variable.');
    }
    
    return true;
  } catch (error) {
    logger.error('Error initializing SendGrid', { error: error.message });
    return false;
  }
};

/**
 * Replace variables in template text with actual values
 */
export const processTemplate = (template: string, variables: TemplateVariables): string => {
  if (!template) return '';
  
  let processedTemplate = template;
  
  // Replace all variables in the template
  Object.entries(variables).forEach(([key, value]) => {
    // Convert value if it's a date
    let displayValue = value;
    
    if (value instanceof Date) {
      displayValue = value.toLocaleDateString('sv-SE');
    } else if (value === null || value === undefined) {
      displayValue = '';
    }
    
    // Replace all occurrences of the variable
    const regex = new RegExp(`{${key}}`, 'g');
    processedTemplate = processedTemplate.replace(regex, String(displayValue));
  });
  
  return processedTemplate;
};

/**
 * Build an email from a mail template with variable data
 */
export const buildEmailFromTemplate = (
  template: { subject: string; body: string },
  variables: TemplateVariables,
  toEmail: string,
  fromEmail: string = sendgridConfig.defaultFromEmail,
  fromName?: string
): EmailData => {
  // Process both subject and content to replace variables
  const processedSubject = processTemplate(template.subject, variables);
  const processedHtml = processTemplate(template.body, variables);
  
  // Create a text version by removing HTML tags
  const textContent = processedHtml.replace(/<[^>]*>/g, '');
  
  // Format the sender address with display name if provided
  const formattedFrom = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  
  return {
    to: toEmail,
    from: formattedFrom,
    subject: processedSubject,
    html: processedHtml,
    text: textContent,
    categories: ['template-based'], // Useful for tracking in SendGrid
  };
};

/**
 * Send an email via SendGrid with automatic retries
 */
export const sendEmail = async (
  emailData: EmailData, 
  retries: number = 0
): Promise<[any, any]> => {
  try {
    // Automatic initialization if needed
    if (!sgMail.axios) {
      const initialized = initSendGrid();
      if (!initialized) {
        throw new Error('Could not initialize SendGrid. Check the API key.');
      }
    }
    
    // Extract sender email from from field
    let senderEmail = emailData.from;
    
    // If from contains a name, extract the email address
    if (senderEmail.includes('<') && senderEmail.includes('>')) {
      senderEmail = senderEmail.match(/<([^>]+)>/)?.[1] || senderEmail;
    }
    
    // Extract domain from sender email
    const emailDomain = senderEmail.split('@')[1]?.toLowerCase();
    
    // Always allow DEFAULT_DOMAIN without further validation
    if (emailDomain !== DEFAULT_DOMAIN) {
      // Validate sender email for non-default domains
      const validation = validateSenderEmail(senderEmail);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }
    }
    
    // Remove any undefined or null values in emailData
    const cleanedEmailData = Object.fromEntries(
      Object.entries(emailData).filter(([_, value]) => value !== undefined && value !== null)
    );
    
    // Log that we're sending an email (without sensitive information)
    logger.info('Sending email', { 
      to: typeof cleanedEmailData.to === 'string' 
        ? cleanedEmailData.to.substring(0, 3) + '***' 
        : 'multiple-recipients',
      subject: cleanedEmailData.subject,
      from: senderEmail.split('@')[0].substring(0, 2) + '***@' + senderEmail.split('@')[1],
      templateBased: !!cleanedEmailData.categories?.includes('template-based')
    });
    
    // Send the email
    return await sgMail.send(cleanedEmailData as EmailData);
  } catch (error) {
    // Handle retries for certain types of errors
    const isRetryableError = error.code >= 500 || 
      error.response?.body?.errors?.some(e => e.message?.includes('rate limit exceeded'));
    
    if (isRetryableError && retries < sendgridConfig.maxRetries) {
      // Exponential backoff (1s, 2s, 4s, etc)
      const backoffTime = Math.pow(2, retries) * 1000;
      logger.warn(`Temporary error sending email. Trying again in ${backoffTime}ms`, { 
        retryCount: retries + 1 
      });
      
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      return sendEmail(emailData, retries + 1);
    }
    
    // Structured logging of errors
    logger.error('Error sending email', { 
      error: error.message,
      code: error.code,
      response: error.response?.body ? JSON.stringify(error.response.body).substring(0, 200) : null
    });
    
    throw error;
  }
};

// Export a function to explicitly refresh the cache (useful after domain operations)
export const refreshVerifiedDomains = initDomainCache;

// Initialize cache on module start
initDomainCache().catch(err => {
  logger.error('Could not initialize domain cache', { error: err.message });
});

// Export a consolidated object for easier import
export default {
  initSendGrid,
  sendEmail,
  processTemplate,
  buildEmailFromTemplate,
  validateSenderEmailByStore,
  validateSenderEmail,
  getVerifiedSenderAddresses,
  saveSenderAddress,
  ensureDefaultDomain,
  refreshVerifiedDomains,
  config: sendgridConfig
};