import { Request, Response } from 'express';
import { ScoringService } from '../services/scoringService';
import { TankModel } from '../models/tankModel';
import { ApiResponse, ScoringWeights } from '../types';

export class ScoringController {
  private scoringService: ScoringService;
  private tankModel: TankModel;

  constructor() {
    this.scoringService = new ScoringService();
    this.tankModel = new TankModel();
  }

  /**
   * POST /api/scoring/recalculate
   * Recalcule tous les scores
   */
  recalculateScores = async (req: Request, res: Response): Promise<void> => {
    try {
      const { weights } = req.body;
      
      console.log('🔄 Début du recalcul des scores...');
      const result = await this.scoringService.recalculateAllScores(weights);

      const response: ApiResponse<{ updated: number; errors: number }> = {
        success: true,
        data: result,
        message: `Recalcul terminé: ${result.updated} chars mis à jour, ${result.errors} erreurs`
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors du recalcul des scores:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur lors du recalcul des scores'
      };
      res.status(500).json(response);
    }
  };

  /**
   * POST /api/scoring/tank/:id
   * Recalcule le score d'un char spécifique
   */
  recalculateTankScore = async (req: Request, res: Response): Promise<void> => {
    try {
      const tankId = parseInt(req.params.id);
      const { weights } = req.body;

      if (isNaN(tankId)) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'ID de char invalide'
        };
        res.status(400).json(response);
        return;
      }

      const tank = await this.tankModel.getTankById(tankId);
      if (!tank) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Char non trouvé'
        };
        res.status(404).json(response);
        return;
      }

      const updatedTank = await this.scoringService.updateTankScores(tank, weights);

      const response: ApiResponse<any> = {
        success: true,
        data: updatedTank,
        message: 'Score du char mis à jour avec succès'
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors du recalcul du score du char:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur lors du recalcul du score du char'
      };
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/scoring/report
   * Génère un rapport d'analyse des scores
   */
  getScoreReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const report = await this.scoringService.generateScoreReport();

      const response: ApiResponse<any> = {
        success: true,
        data: report
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur lors de la génération du rapport'
      };
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/scoring/weights
   * Récupère les poids actuels de scoring
   */
  getWeights = async (req: Request, res: Response): Promise<void> => {
    try {
      const weights = this.scoringService.getCurrentWeights();

      const response: ApiResponse<ScoringWeights> = {
        success: true,
        data: weights
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors de la récupération des poids:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur lors de la récupération des poids'
      };
      res.status(500).json(response);
    }
  };

  /**
   * PUT /api/scoring/weights
   * Met à jour les poids de scoring
   */
  updateWeights = async (req: Request, res: Response): Promise<void> => {
    try {
      const { weights } = req.body;

      if (!weights || typeof weights !== 'object') {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Poids de scoring invalides'
        };
        res.status(400).json(response);
        return;
      }

      // Validation des poids
      const validKeys = ['damage', 'winRate', 'survival', 'armor', 'mobility', 'penetration'];
      const providedKeys = Object.keys(weights);
      
      for (const key of providedKeys) {
        if (!validKeys.includes(key)) {
          const response: ApiResponse<null> = {
            success: false,
            error: `Clé de poids invalide: ${key}`
          };
          res.status(400).json(response);
          return;
        }

        if (typeof weights[key] !== 'number' || weights[key] < 0 || weights[key] > 1) {
          const response: ApiResponse<null> = {
            success: false,
            error: `Valeur de poids invalide pour ${key}: doit être un nombre entre 0 et 1`
          };
          res.status(400).json(response);
          return;
        }
      }

      const updatedWeights = this.scoringService.updateScoringWeights(weights);

      const response: ApiResponse<ScoringWeights> = {
        success: true,
        data: updatedWeights,
        message: 'Poids de scoring mis à jour avec succès'
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors de la mise à jour des poids:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur lors de la mise à jour des poids'
      };
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/scoring/simulate/:id
   * Simule le score d'un char avec différents poids
   */
  simulateScore = async (req: Request, res: Response): Promise<void> => {
    try {
      const tankId = parseInt(req.params.id);
      const { weights } = req.query;

      if (isNaN(tankId)) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'ID de char invalide'
        };
        res.status(400).json(response);
        return;
      }

      const tank = await this.tankModel.getTankById(tankId);
      if (!tank) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Char non trouvé'
        };
        res.status(404).json(response);
        return;
      }

      let simulationWeights;
      if (weights && typeof weights === 'string') {
        try {
          simulationWeights = JSON.parse(weights);
        } catch {
          const response: ApiResponse<null> = {
            success: false,
            error: 'Format de poids invalide'
          };
          res.status(400).json(response);
          return;
        }
      }

      // Calcul du score avec les poids actuels
      const currentScore = this.scoringService.calculateOverallScore(tank);
      
      // Calcul du score avec les poids de simulation
      const simulatedScore = simulationWeights 
        ? this.scoringService.calculateOverallScore(tank, simulationWeights)
        : currentScore;

      const response: ApiResponse<{
        tankId: number;
        tankName: string;
        currentScore: number;
        simulatedScore: number;
        difference: number;
        weights: ScoringWeights;
      }> = {
        success: true,
        data: {
          tankId: tank.id,
          tankName: tank.name,
          currentScore,
          simulatedScore,
          difference: simulatedScore - currentScore,
          weights: simulationWeights || this.scoringService.getCurrentWeights()
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Erreur lors de la simulation:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Erreur lors de la simulation'
      };
      res.status(500).json(response);
    }
  };
}
