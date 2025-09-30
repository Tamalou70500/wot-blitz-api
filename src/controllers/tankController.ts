import { Request, Response } from 'express';
import { TankModel } from '../models/tankModel';
import { WargamingService } from '../services/wargamingService';
import { CacheService } from '../database/redis';
import { TankFilters, SortOptions, PaginationOptions, ApiResponse, Tank } from '../types';

export class TankController {
  private tankModel: TankModel;
  private wargamingService: WargamingService;

  constructor() {
    this.tankModel = new TankModel();
    this.wargamingService = new WargamingService();
  }

  /**
   * GET /api/tanks
   * Récupère la liste des chars avec filtres, tri et pagination
   */
  getTanks = async (req: Request, res: Response): Promise<void> => {
    try {
      // Extraction des paramètres de requête
      const filters: TankFilters = {
        tier: req.query.tier ? (Array.isArray(req.query.tier) ? req.query.tier.map(Number) : [Number(req.query.tier)]) : undefined,
        type: req.query.type ? (Array.isArray(req.query.type) ? req.query.type as any[] : [req.query.type]) : undefined,
        nation: req.query.nation ? (Array.isArray(req.query.nation) ? req.query.nation as any[] : [req.query.nation]) : undefined,
        is_premium: req.query.is_premium ? req.query.is_premium === 'true' : undefined,
        search: req.query.search as string
      };

      const sort: SortOptions = {
        field: (req.query.sort_field as string) || 'score_overall',
        order: (req.query.sort_order as 'asc' | 'desc') || 'desc'
      };

      const pagination: PaginationOptions = {
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 50, 100) // Max 100 par page
      };

      // Génération de la clé de cache
      const cacheKey = CacheService.getTankListCacheKey(
        JSON.stringify({ filters, sort, pagination })
      );

      // Vérification du cache
      const cached = await CacheService.get<{ tanks: Tank[]; total: number }>(cacheKey);
      if (cached) {
        const response: ApiResponse<Tank[]> = {
          success: true,
          data: cached.tanks,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: cached.total,
            totalPages: Math.ceil(cached.total / pagination.limit)
          }
        };
        res.json(response);
        return;
      }

      // Récupération depuis la base de données
      const result = await this.tankModel.getTanks(filters, sort, pagination);

      // Mise en cache pour 5 minutes
      await CacheService.set(cacheKey, result, 300);

      const response: ApiResponse<Tank[]> = {
        success: true,
        data: result.tanks,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / pagination.limit)
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors de la récupération des chars:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur interne du serveur'
      };
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/tanks/:id
   * Récupère un char spécifique par son ID
   */
  getTankById = async (req: Request, res: Response): Promise<void> => {
    try {
      const tankId = parseInt(req.params.id);

      if (isNaN(tankId)) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'ID de char invalide'
        };
        res.status(400).json(response);
        return;
      }

      // Vérification du cache
      const cacheKey = CacheService.getTankCacheKey(tankId);
      const cached = await CacheService.get<Tank>(cacheKey);
      
      if (cached) {
        const response: ApiResponse<Tank> = {
          success: true,
          data: cached
        };
        res.json(response);
        return;
      }

      // Récupération depuis la base de données
      const tank = await this.tankModel.getTankById(tankId);

      if (!tank) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Char non trouvé'
        };
        res.status(404).json(response);
        return;
      }

      // Mise en cache pour 1 heure
      await CacheService.set(cacheKey, tank, 3600);

      const response: ApiResponse<Tank> = {
        success: true,
        data: tank
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors de la récupération du char:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur interne du serveur'
      };
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/tanks/rankings/:category
   * Récupère le classement des chars par catégorie
   */
  getRankings = async (req: Request, res: Response): Promise<void> => {
    try {
      const category = req.params.category as 'overall' | 'tier' | 'type';
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const tier = req.query.tier ? parseInt(req.query.tier as string) : undefined;
      const type = req.query.type as any;

      if (!['overall', 'tier', 'type'].includes(category)) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Catégorie de classement invalide'
        };
        res.status(400).json(response);
        return;
      }

      // Génération de la clé de cache
      const cacheKey = CacheService.getRankingCacheKey(
        `${category}_${limit}_${tier || 'all'}_${type || 'all'}`
      );

      // Vérification du cache
      const cached = await CacheService.get<Tank[]>(cacheKey);
      if (cached) {
        const response: ApiResponse<Tank[]> = {
          success: true,
          data: cached
        };
        res.json(response);
        return;
      }

      // Récupération depuis la base de données
      const tanks = await this.tankModel.getTopTanks(category, limit, tier, type);

      // Mise en cache pour 10 minutes
      await CacheService.set(cacheKey, tanks, 600);

      const response: ApiResponse<Tank[]> = {
        success: true,
        data: tanks
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors de la récupération du classement:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur interne du serveur'
      };
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/tanks/stats
   * Récupère les statistiques générales des chars
   */
  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const cacheKey = 'tanks:stats';
      
      // Vérification du cache
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        const response: ApiResponse<any> = {
          success: true,
          data: cached
        };
        res.json(response);
        return;
      }

      // Récupération depuis la base de données
      const stats = await this.tankModel.getStats();

      // Mise en cache pour 30 minutes
      await CacheService.set(cacheKey, stats, 1800);

      const response: ApiResponse<any> = {
        success: true,
        data: stats
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur interne du serveur'
      };
      res.status(500).json(response);
    }
  };

  /**
   * POST /api/tanks/sync
   * Synchronise les données depuis l'API Wargaming
   */
  syncTanks = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('🔄 Début de la synchronisation des chars...');

      // Récupération des données depuis Wargaming
      const tanks = await this.wargamingService.getAllTanks();

      if (tanks.length === 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Aucune donnée récupérée depuis l\'API Wargaming'
        };
        res.status(500).json(response);
        return;
      }

      // Insertion en base de données
      const insertedCount = await this.tankModel.bulkUpsertTanks(tanks);

      // Invalidation du cache
      await this.invalidateCache();

      const response: ApiResponse<{ count: number }> = {
        success: true,
        data: { count: insertedCount },
        message: `${insertedCount} chars synchronisés avec succès`
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur lors de la synchronisation des données'
      };
      res.status(500).json(response);
    }
  };

  /**
   * POST /api/tanks/compare
   * Compare plusieurs chars
   */
  compareTanks = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tankIds } = req.body;

      if (!Array.isArray(tankIds) || tankIds.length < 2 || tankIds.length > 4) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Veuillez fournir entre 2 et 4 IDs de chars à comparer'
        };
        res.status(400).json(response);
        return;
      }

      // Récupération des chars
      const tanks = await Promise.all(
        tankIds.map(id => this.tankModel.getTankById(parseInt(id)))
      );

      // Vérification que tous les chars existent
      const validTanks = tanks.filter(tank => tank !== null) as Tank[];
      
      if (validTanks.length !== tankIds.length) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Un ou plusieurs chars n\'ont pas été trouvés'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<Tank[]> = {
        success: true,
        data: validTanks
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors de la comparaison:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur interne du serveur'
      };
      res.status(500).json(response);
    }
  };

  /**
   * Invalide le cache des chars
   */
  private async invalidateCache(): Promise<void> {
    try {
      // Suppression des clés de cache liées aux chars
      const keys = [
        'wargaming:all_tanks',
        'tanks:stats'
      ];

      await Promise.all(keys.map(key => CacheService.del(key)));
      console.log('🗑️ Cache invalidé');
    } catch (error) {
      console.error('Erreur lors de l\'invalidation du cache:', error);
    }
  }
}
