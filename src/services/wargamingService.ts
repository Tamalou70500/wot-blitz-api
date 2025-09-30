import axios, { AxiosInstance } from 'axios';
import { WargamingTankResponse, WargamingTank, Tank, TankType, Nation } from '../types';
import { CacheService } from '../database/redis';

export class WargamingService {
  private api: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.WARGAMING_API_KEY || '';
    this.api = axios.create({
      baseURL: process.env.WARGAMING_BASE_URL || 'https://api.wotblitz.eu/wotb',
      timeout: 10000,
    });
  }

  /**
   * Récupère tous les chars depuis l'API Wargaming
   */
  async getAllTanks(): Promise<Tank[]> {
    try {
      const cacheKey = 'wargaming:all_tanks';
      const cached = await CacheService.get<Tank[]>(cacheKey);
      
      if (cached) {
        console.log('📦 Données des chars récupérées depuis le cache');
        return cached;
      }

      console.log('🌐 Récupération des chars depuis l\'API Wargaming...');
      
      const response = await this.api.get<WargamingTankResponse>('/encyclopedia/vehicles/', {
        params: {
          application_id: this.apiKey,
          fields: 'tank_id,name,tier,type,nation,is_premium,images,description,engines,guns,armor,speed_forward,hp'
        }
      });

      if (response.data.status !== 'ok') {
        throw new Error(`Erreur API Wargaming: ${response.data.status}`);
      }

      const tanks = this.transformWargamingData(response.data.data);
      
      // Cache pour 6 heures
      await CacheService.set(cacheKey, tanks, 21600);
      
      console.log(`✅ ${tanks.length} chars récupérés et mis en cache`);
      return tanks;

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des chars:', error);
      throw new Error('Impossible de récupérer les données des chars');
    }
  }

  /**
   * Récupère un char spécifique par son ID
   */
  async getTankById(tankId: number): Promise<Tank | null> {
    try {
      const cacheKey = CacheService.getTankCacheKey(tankId);
      const cached = await CacheService.get<Tank>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const response = await this.api.get<WargamingTankResponse>('/encyclopedia/vehicles/', {
        params: {
          application_id: this.apiKey,
          tank_id: tankId,
          fields: 'tank_id,name,tier,type,nation,is_premium,images,description,engines,guns,armor,speed_forward,hp'
        }
      });

      if (response.data.status !== 'ok' || !response.data.data[tankId]) {
        return null;
      }

      const tank = this.transformSingleTank(response.data.data[tankId]);
      
      // Cache pour 1 heure
      await CacheService.set(cacheKey, tank, 3600);
      
      return tank;

    } catch (error) {
      console.error(`❌ Erreur lors de la récupération du char ${tankId}:`, error);
      return null;
    }
  }

  /**
   * Transforme les données Wargaming en format interne
   */
  private transformWargamingData(data: { [key: string]: WargamingTank }): Tank[] {
    return Object.values(data).map(tank => this.transformSingleTank(tank));
  }

  /**
   * Transforme un char Wargaming en format interne
   */
  private transformSingleTank(wgTank: WargamingTank): Tank {
    // Calcul des statistiques moyennes pour les chars avec plusieurs configurations
    const avgGunDamage = wgTank.guns.length > 0 
      ? Math.round(wgTank.guns.reduce((sum, gun) => sum + (gun.damage[0] || 0), 0) / wgTank.guns.length)
      : 0;

    const avgGunPenetration = wgTank.guns.length > 0
      ? Math.round(wgTank.guns.reduce((sum, gun) => sum + (gun.penetration[0] || 0), 0) / wgTank.guns.length)
      : 0;

    const avgGunRof = wgTank.guns.length > 0
      ? Math.round((wgTank.guns.reduce((sum, gun) => sum + (gun.rate || 0), 0) / wgTank.guns.length) * 100) / 100
      : 0;

    const maxEnginePower = wgTank.engines.length > 0
      ? Math.max(...wgTank.engines.map(engine => engine.power))
      : 0;

    return {
      id: wgTank.tank_id,
      name: wgTank.name,
      tier: wgTank.tier,
      type: this.mapTankType(wgTank.type),
      nation: this.mapNation(wgTank.nation),
      is_premium: wgTank.is_premium,
      image_url: wgTank.images?.big_icon || wgTank.images?.small_icon,
      description: wgTank.description,
      health: wgTank.hp,
      armor_front: Math.max(wgTank.armor?.hull?.front || 0, wgTank.armor?.turret?.front || 0),
      armor_side: Math.max(wgTank.armor?.hull?.sides || 0, wgTank.armor?.turret?.sides || 0),
      armor_rear: Math.max(wgTank.armor?.hull?.rear || 0, wgTank.armor?.turret?.rear || 0),
      gun_damage: avgGunDamage,
      gun_penetration: avgGunPenetration,
      gun_rof: avgGunRof,
      mobility_speed: wgTank.speed_forward,
      mobility_power: maxEnginePower,
    };
  }

  /**
   * Mappe les types de chars Wargaming vers notre enum
   */
  private mapTankType(wgType: string): TankType {
    switch (wgType) {
      case 'lightTank':
        return TankType.LIGHT;
      case 'mediumTank':
        return TankType.MEDIUM;
      case 'heavyTank':
        return TankType.HEAVY;
      case 'AT-SPG':
        return TankType.DESTROYER;
      case 'SPG':
        return TankType.SPG;
      default:
        return TankType.MEDIUM;
    }
  }

  /**
   * Mappe les nations Wargaming vers notre enum
   */
  private mapNation(wgNation: string): Nation {
    switch (wgNation) {
      case 'ussr':
        return Nation.USSR;
      case 'germany':
        return Nation.GERMANY;
      case 'usa':
        return Nation.USA;
      case 'china':
        return Nation.CHINA;
      case 'france':
        return Nation.FRANCE;
      case 'uk':
        return Nation.UK;
      case 'japan':
        return Nation.JAPAN;
      default:
        return Nation.OTHER;
    }
  }

  /**
   * Vérifie la validité de la clé API
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.api.get('/encyclopedia/info/', {
        params: {
          application_id: this.apiKey
        }
      });
      
      return response.data.status === 'ok';
    } catch (error) {
      console.error('❌ Clé API Wargaming invalide:', error);
      return false;
    }
  }
}
