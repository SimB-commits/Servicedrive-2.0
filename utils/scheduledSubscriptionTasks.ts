// utils/scheduledSubscriptionTasks.ts
import { PrismaClient, SubscriptionPlan } from '@prisma/client';
import { logger } from './logger';
import { sendEmail } from './mail-service';

const prisma = new PrismaClient();

/**
 * Kontrollerar och förnyar prenumerationer om de är inställda på automatisk förnyelse
 * Denna funktion bör köras dagligen
 */
export async function checkAndRenewSubscriptions(): Promise<void> {
  try {
    logger.info('Kontrollerar prenumerationsförnyelser');
    
    // Dagens datum
    const today = new Date();
    
    // Hitta alla butiker med prenumerationer som går ut inom 7 dagar
    // och som har automatisk förnyelse aktiverad
    const expiringStores = await prisma.store.findMany({
      where: {
        subscriptionEndDate: {
          not: null,
          lte: new Date(today.setDate(today.getDate() + 7)) // Inom 7 dagar
        },
        subscriptionAutoRenew: true
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true
              }
            }
          }
        }
      }
    });
    
    logger.info(`Hittade ${expiringStores.length} prenumerationer som snart går ut`);
    
    for (const store of expiringStores) {
      try {
        // Hitta admin-användare för denna butik
        const adminUsers = store.users
          .map(userStore => userStore.user)
          .filter(user => user.role === 'ADMIN');
        
        // Kontrollera om prenumerationen går ut idag
        const isExpiringToday = store.subscriptionEndDate && 
          new Date(store.subscriptionEndDate).toDateString() === today.toDateString();
        
        if (isExpiringToday) {
          logger.info(`Förnyar prenumeration för butik ${store.id} (${store.name})`);
          
          // Utför förnyelsen
          const renewalResult = await renewSubscription(store.id, store.subscriptionPlan);
          
          // Skicka bekräftelsemail till admin-användare
          for (const admin of adminUsers) {
            await sendRenewalNotification(
              admin.email,
              store.name,
              store.subscriptionPlan,
              true, // Förnyad
              renewalResult.newEndDate
            );
          }
        } else {
          // Skicka påminnelse om kommande förnyelse till admin-användare
          for (const admin of adminUsers) {
            await sendRenewalNotification(
              admin.email,
              store.name,
              store.subscriptionPlan,
              false, // Påminnelse
              store.subscriptionEndDate
            );
          }
        }
      } catch (storeError) {
        logger.error(`Fel vid hantering av prenumerationsförnyelse för butik ${store.id}`, {
          error: storeError instanceof Error ? storeError.message : 'Okänt fel',
          storeId: store.id
        });
        // Fortsätt med nästa butik
      }
    }
    
    // Kontrollera även butiker där prenumerationen har gått ut utan förnyelse
    const expiredStores = await prisma.store.findMany({
      where: {
        subscriptionEndDate: {
          not: null,
          lt: today // Redan utgått
        },
        subscriptionAutoRenew: false
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true
              }
            }
          }
        }
      }
    });
    
    logger.info(`Hittade ${expiredStores.length} utgångna prenumerationer`);
    
    for (const store of expiredStores) {
      // Nedgradera till STARTUP-plan
      await prisma.store.update({
        where: { id: store.id },
        data: {
          subscriptionPlan: 'STARTUP',
          subscriptionEndDate: null // Ingen utgångsdatum för STARTUP
        }
      });
      
      logger.info(`Nedgraderade utgången prenumeration för butik ${store.id} till STARTUP`);
      
      // Skicka mail om nedgradering till admin-användare
      const adminUsers = store.users
        .map(userStore => userStore.user)
        .filter(user => user.role === 'ADMIN');
      
      for (const admin of adminUsers) {
        await sendExpiredNotification(
          admin.email,
          store.name,
          store.subscriptionPlan
        );
      }
    }
  } catch (error) {
    logger.error('Fel vid kontroll av prenumerationsförnyelser', {
      error: error instanceof Error ? error.message : 'Okänt fel'
    });
  }
}

/**
 * Kontrollerar och skickar notifieringar om att användare närmar sig sina plangränser
 */
export async function checkUsageLimits(): Promise<void> {
  try {
    logger.info('Kontrollerar användning mot plangränser');
    
    // Hämta alla butiker med deras användningsmått
    const stores = await prisma.store.findMany({
      include: {
        StoreUsageMetrics: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true
              }
            }
          }
        }
      }
    });
    
    for (const store of stores) {
      // Om butiken inte har mätvärden, skapa en ny post
      if (store.StoreUsageMetrics.length === 0) {
        continue;
      }
      
      const metrics = store.StoreUsageMetrics[0];
      
      // Hämta gränser för den aktuella planen
      const planLimits = getPlanLimits(store.subscriptionPlan);
      
      // Beräkna procentuell användning
      const adminUsagePercent = metrics.adminCount / planLimits.adminUsers * 100;
      const typeUsagePercent = planLimits.ticketTypes === Number.POSITIVE_INFINITY ? 0 : 
        metrics.customTicketTypeCount / planLimits.ticketTypes * 100;
      const statusUsagePercent = planLimits.customStatuses === Number.POSITIVE_INFINITY ? 0 : 
        metrics.customStatusCount / planLimits.customStatuses * 100;
      const ticketUsagePercent = planLimits.ticketsPerMonth === Number.POSITIVE_INFINITY ? 0 : 
        store.monthlyTicketCount / planLimits.ticketsPerMonth * 100;
      
      // Kontrollera om användningen överstiger 80%
      const isNearLimit = adminUsagePercent >= 80 || 
                         typeUsagePercent >= 80 || 
                         statusUsagePercent >= 80 || 
                         ticketUsagePercent >= 80;
      
      if (isNearLimit) {
        logger.info(`Butik ${store.id} (${store.name}) närmar sig sina plangränser`);
        
        // Sammanställ information om förbrukning
        const limitInfo = [];
        
        if (adminUsagePercent >= 80) {
          limitInfo.push(`Administratörer: ${metrics.adminCount}/${planLimits.adminUsers} (${Math.round(adminUsagePercent)}%)`);
        }
        
        if (typeUsagePercent >= 80) {
          limitInfo.push(`Ärendetyper: ${metrics.customTicketTypeCount}/${planLimits.ticketTypes} (${Math.round(typeUsagePercent)}%)`);
        }
        
        if (statusUsagePercent >= 80) {
          limitInfo.push(`Anpassade statusar: ${metrics.customStatusCount}/${planLimits.customStatuses} (${Math.round(statusUsagePercent)}%)`);
        }
        
        if (ticketUsagePercent >= 80) {
          limitInfo.push(`Ärenden denna månad: ${store.monthlyTicketCount}/${planLimits.ticketsPerMonth} (${Math.round(ticketUsagePercent)}%)`);
        }
        
        // Hämta admin-användare för denna butik
        const adminUsers = store.users
          .map(userStore => userStore.user)
          .filter(user => user.role === 'ADMIN');
        
        // Skicka notifieringar till admin-användare
        for (const admin of adminUsers) {
          await sendLimitNotification(
            admin.email,
            store.name,
            store.subscriptionPlan,
            limitInfo
          );
        }
      }
    }
  } catch (error) {
    logger.error('Fel vid kontroll av plangränser', {
      error: error instanceof Error ? error.message : 'Okänt fel'
    });
  }
}

/**
 * Förnya en prenumeration
 */
async function renewSubscription(
  storeId: number, 
  plan: SubscriptionPlan
): Promise<{ success: boolean; newEndDate: Date }> {
  // Beräkna nytt slutdatum (1 år från nu)
  const newEndDate = new Date();
  newEndDate.setFullYear(newEndDate.getFullYear() + 1);
  
  await prisma.store.update({
    where: { id: storeId },
    data: {
      subscriptionStartDate: new Date(),
      subscriptionEndDate: newEndDate
    }
  });
  
  logger.info(`Förnyade prenumeration för butik ${storeId} till ${newEndDate.toISOString()}`);
  
  return { success: true, newEndDate };
}

/**
 * Skicka notifikation om förnyelse/förnyelsepåminnelse
 */
async function sendRenewalNotification(
  email: string,
  storeName: string,
  plan: SubscriptionPlan,
  isRenewed: boolean,
  endDate: Date | null
): Promise<void> {
  const formattedDate = endDate ? 
    new Date(endDate).toLocaleDateString('sv-SE') : 
    'löpande';

  const planName = getPlanDisplayName(plan);
  
  const subject = isRenewed ? 
    `Din prenumeration har förnyats - ${storeName}` : 
    `Påminnelse: Din prenumeration förnyas snart - ${storeName}`;
  
  const content = isRenewed ?
    `<h2>Din prenumeration har förnyats</h2>
     <p>Din ${planName}-prenumeration för ${storeName} har förnyats.</p>
     <p>Nytt slutdatum: ${formattedDate}</p>
     <p>Om du inte vill att din prenumeration ska förnyas automatiskt i framtiden, 
     kan du stänga av automatisk förnyelse i inställningarna.</p>` :
    
    `<h2>Påminnelse om kommande förnyelse</h2>
     <p>Din ${planName}-prenumeration för ${storeName} kommer att förnyas automatiskt ${formattedDate}.</p>
     <p>Om du inte vill förnya, kan du avaktivera automatisk förnyelse i inställningarna.</p>`;
  
  try {
    await sendEmail({
      to: email,
      from: process.env.EMAIL_FROM || 'no-reply@servicedrive.se',
      subject: subject,
      html: content,
      text: content.replace(/<[^>]*>/g, ''),
      categories: ['subscription', isRenewed ? 'renewal' : 'reminder']
    });
    
    logger.info(`Skickade ${isRenewed ? 'förnyelse' : 'påminnelse'} till ${email.substring(0, 3)}***@${email.split('@')[1]}`);
  } catch (error) {
    logger.error(`Fel vid skickande av ${isRenewed ? 'förnyelse' : 'påminnelse'}`, {
      error: error instanceof Error ? error.message : 'Okänt fel',
      email: `${email.substring(0, 3)}***@${email.split('@')[1]}`
    });
  }
}

/**
 * Skicka notifikation om utgången prenumeration
 */
async function sendExpiredNotification(
  email: string,
  storeName: string,
  previousPlan: SubscriptionPlan
): Promise<void> {
  const planName = getPlanDisplayName(previousPlan);
  
  const subject = `Din prenumeration har gått ut - ${storeName}`;
  
  const content = `<h2>Din prenumeration har gått ut</h2>
                  <p>Din ${planName}-prenumeration för ${storeName} har gått ut och inte förnyats.</p>
                  <p>Din butik har automatiskt nedgraderats till Startup-planen (gratis).</p>
                  <p>Observera att vissa funktioner inte längre är tillgängliga med gratisplanen. 
                  För att återaktivera alla funktioner, vänligen förnya din prenumeration.</p>`;
  
  try {
    await sendEmail({
      to: email,
      from: process.env.EMAIL_FROM || 'no-reply@servicedrive.se',
      subject: subject,
      html: content,
      text: content.replace(/<[^>]*>/g, ''),
      categories: ['subscription', 'expiration']
    });
    
    logger.info(`Skickade meddelande om utgången prenumeration till ${email.substring(0, 3)}***@${email.split('@')[1]}`);
  } catch (error) {
    logger.error(`Fel vid skickande av meddelande om utgången prenumeration`, {
      error: error instanceof Error ? error.message : 'Okänt fel',
      email: `${email.substring(0, 3)}***@${email.split('@')[1]}`
    });
  }
}

/**
 * Skicka notifikation om att användaren närmar sig sina gränser
 */
async function sendLimitNotification(
  email: string,
  storeName: string,
  plan: SubscriptionPlan,
  limitInfo: string[]
): Promise<void> {
  const planName = getPlanDisplayName(plan);
  
  const subject = `Du närmar dig dina användningsgränser - ${storeName}`;
  
  const limitList = limitInfo.map(info => `<li>${info}</li>`).join('');
  
  const content = `<h2>Du närmar dig dina användningsgränser</h2>
                  <p>Din butik ${storeName} med ${planName}-plan närmar sig följande användningsgränser:</p>
                  <ul>
                    ${limitList}
                  </ul>
                  <p>För att undvika begränsningar och säkerställa kontinuerlig tillgång till alla funktioner, 
                  överväg att uppgradera din prenumeration.</p>
                  <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/installningar?tab=subscription">Hantera prenumeration</a></p>`;
  
  try {
    await sendEmail({
      to: email,
      from: process.env.EMAIL_FROM || 'no-reply@servicedrive.se',
      subject: subject,
      html: content,
      text: content.replace(/<[^>]*>/g, ''),
      categories: ['subscription', 'limit-warning']
    });
    
    logger.info(`Skickade varning om användningsgränser till ${email.substring(0, 3)}***@${email.split('@')[1]}`);
  } catch (error) {
    logger.error(`Fel vid skickande av varning om användningsgränser`, {
      error: error instanceof Error ? error.message : 'Okänt fel',
      email: `${email.substring(0, 3)}***@${email.split('@')[1]}`
    });
  }
}

/**
 * Hjälpfunktion för att konvertera plannamn till visningsnamn
 */
function getPlanDisplayName(plan: SubscriptionPlan): string {
  switch(plan) {
    case 'STARTUP': return 'Startup (Gratis)';
    case 'TEAM': return 'Team';
    case 'GROWING': return 'Växande';
    case 'PROFESSIONAL': return 'Professionell';
    default: return plan;
  }
}

/**
 * Hjälpfunktion för att hämta plangränser
 */
function getPlanLimits(plan: SubscriptionPlan): { 
  ticketsPerMonth: number; 
  ticketTypes: number; 
  customStatuses: number; 
  adminUsers: number;
  historyMonths: number;
} {
  switch(plan) {
    case 'STARTUP':
      return {
        ticketsPerMonth: 50,
        ticketTypes: 2,
        customStatuses: 0,
        adminUsers: 1,
        historyMonths: 3
      };
    case 'TEAM':
      return {
        ticketsPerMonth: Number.POSITIVE_INFINITY, // Obegränsat
        ticketTypes: 5,
        customStatuses: 3,
        adminUsers: 3,
        historyMonths: 12
      };
    case 'GROWING':
      return {
        ticketsPerMonth: Number.POSITIVE_INFINITY,
        ticketTypes: 10,
        customStatuses: 5,
        adminUsers: 5,
        historyMonths: 24
      };
    case 'PROFESSIONAL':
      return {
        ticketsPerMonth: Number.POSITIVE_INFINITY,
        ticketTypes: Number.POSITIVE_INFINITY,
        customStatuses: 10,
        adminUsers: 10,
        historyMonths: 60
      };
    default:
      return {
        ticketsPerMonth: 50,
        ticketTypes: 2,
        customStatuses: 0,
        adminUsers: 1,
        historyMonths: 3
      };
  }
}