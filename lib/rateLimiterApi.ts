// src/lib/rateLimiterApi.ts

import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
  points: 100, // Antal tillåtna förfrågningar
  duration: 60, // Tidsperiod i sekunder
});

export default rateLimiter;
