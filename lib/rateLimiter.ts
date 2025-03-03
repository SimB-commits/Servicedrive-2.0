// lib/rateLimiter.ts

import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

let loginRateLimiter: RateLimiterMemory | RateLimiterRedis;

if (/*process.env.NODE_ENV === 'production' && */process.env.REDIS_HOST && process.env.REDIS_PORT) {
  const redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || undefined,
    enableReadyCheck: false,
  });

  loginRateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    points: 5,
    duration: 60,
    blockDuration: 60,
  });

  redisClient.on('error', (err) => {
    console.error('Redis error:', err);
    console.warn('Falling back to in-memory rate limiter');
    loginRateLimiter = new RateLimiterMemory({
      points: 5,
      duration: 60,
      blockDuration: 60,
    });
  });
} else {
  // Använd in-memory rate limiter för utveckling och icke-produktion
  loginRateLimiter = new RateLimiterMemory({
    points: 5,
    duration: 60,
    blockDuration: 60,
  });
}

export default loginRateLimiter;


