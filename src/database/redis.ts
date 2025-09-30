import Redis from 'ioredis';
import { RedisConfig } from '../types';

const config: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const redis = new Redis({
  host: config.host,
  port: config.port,
  password: config.password,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
});

redis.on('connect', () => {
  console.log('✅ Connexion à Redis établie');
});

redis.on('error', (err) => {
  console.error('❌ Erreur Redis:', err);
});

// Utilitaires pour le cache
export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 heure

  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Erreur lors de la lecture du cache:', error);
      return null;
    }
  }

  static async set(key: string, value: any, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'écriture du cache:', error);
      return false;
    }
  }

  static async del(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression du cache:', error);
      return false;
    }
  }

  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Erreur lors de la vérification du cache:', error);
      return false;
    }
  }

  // Clés de cache spécifiques
  static getTankCacheKey(tankId: number): string {
    return `tank:${tankId}`;
  }

  static getTankListCacheKey(filters: string): string {
    return `tanks:list:${filters}`;
  }

  static getRankingCacheKey(category: string): string {
    return `ranking:${category}`;
  }
}

export default redis;
