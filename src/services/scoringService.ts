import { Tank, TankType, ScoringWeights } from '../types';
import { TankModel } from '../models/tankModel';
import { CacheService } from '../database/redis';

export class ScoringService {
  private tankModel: TankModel;
  
  // Poids par défaut pour le calcul du score
  private defaultWeights: ScoringWeights = {
    damage: 0.25,        // 25% - Dégâts par tir
    winRate: 0.20,       // 20% - Taux de victoire (simulé)
    survival: 0.15,      // 15% - Capacité de survie (PV + blindage)
    armor: 0.15,         // 15% - Protection
    mobility: 0.15,      // 15% - Mobilité
    penetration: 0.10    // 10% - Pénétration
  };

  // Valeurs de référence pour la normalisation
  private referenceValues = {
    maxDamage: 750,      // Dégâts maximum observés
    maxHealth: 2500,     // PV maximum
    maxArmor: 300,       // Blindage maximum
    maxSpeed: 70,        // Vitesse maximum
    maxPenetration: 300, // Pénétration maximum
    maxPower: 1000       // Puissance maximum
  };

  constructor() {
    this.tankModel = new TankModel();
  }

  /**
   * Calcule le score global d'un char
   */
  calculateOverallScore(tank: Tank, weights: ScoringWeights = this.defaultWeights): number {
    const damageScore = this.calculateDamageScore(tank);
    const survivalScore = this.calculateSurvivalScore(tank);
    const armorScore = this.calculateArmorScore(tank);
    const mobilityScore = this.calculateMobilityScore(tank);
    const penetrationScore = this.calculatePenetrationScore(tank);
    const winRateScore = this.calculateWinRateScore(tank); // Simulé

    const overallScore = 
      (damageScore * weights.damage) +
      (winRateScore * weights.winRate) +
      (survivalScore * weights.survival) +
      (armorScore * weights.armor) +
      (mobilityScore * weights.mobility) +
      (penetrationScore * weights.penetration);

    return Math.round(overallScore * 100) / 100;
  }

  /**
   * Calcule le score de dégâts
   */
  private calculateDamageScore(tank: Tank): number {
    // Score basé sur les dégâts par tir et la cadence
    const damagePerShot = tank.gun_damage;
    const rateOfFire = tank.gun_rof;
    const dpm = damagePerShot * rateOfFire; // Dégâts par minute

    // Normalisation par rapport aux valeurs de référence
    const damageRatio = damagePerShot / this.referenceValues.maxDamage;
    const dpmRatio = dpm / (this.referenceValues.maxDamage * 10); // DPM de référence

    // Pondération : 60% dégâts par tir, 40% DPM
    return Math.min(100, (damageRatio * 0.6 + dpmRatio * 0.4) * 100);
  }

  /**
   * Calcule le score de survie
   */
  private calculateSurvivalScore(tank: Tank): number {
    const healthRatio = tank.health / this.referenceValues.maxHealth;
    const avgArmorRatio = (tank.armor_front + tank.armor_side + tank.armor_rear) / 3 / this.referenceValues.maxArmor;
    
    // Pondération : 70% PV, 30% blindage moyen
    return Math.min(100, (healthRatio * 0.7 + avgArmorRatio * 0.3) * 100);
  }

  /**
   * Calcule le score de blindage
   */
  private calculateArmorScore(tank: Tank): number {
    // Pondération différente selon les zones
    const frontArmorRatio = tank.armor_front / this.referenceValues.maxArmor;
    const sideArmorRatio = tank.armor_side / this.referenceValues.maxArmor;
    const rearArmorRatio = tank.armor_rear / this.referenceValues.maxArmor;

    // Pondération : 50% frontal, 30% latéral, 20% arrière
    const weightedArmor = (frontArmorRatio * 0.5) + (sideArmorRatio * 0.3) + (rearArmorRatio * 0.2);
    
    return Math.min(100, weightedArmor * 100);
  }

  /**
   * Calcule le score de mobilité
   */
  private calculateMobilityScore(tank: Tank): number {
    const speedRatio = tank.mobility_speed / this.referenceValues.maxSpeed;
    const powerRatio = tank.mobility_power / this.referenceValues.maxPower;
    
    // Rapport puissance/poids (estimation basée sur les PV comme proxy du poids)
    const powerToWeightRatio = tank.mobility_power / (tank.health / 1000);
    const powerToWeightScore = Math.min(1, powerToWeightRatio / 30); // 30 ch/tonne comme référence

    // Pondération : 40% vitesse, 30% puissance, 30% rapport puissance/poids
    return Math.min(100, (speedRatio * 0.4 + powerRatio * 0.3 + powerToWeightScore * 0.3) * 100);
  }

  /**
   * Calcule le score de pénétration
   */
  private calculatePenetrationScore(tank: Tank): number {
    const penetrationRatio = tank.gun_penetration / this.referenceValues.maxPenetration;
    return Math.min(100, penetrationRatio * 100);
  }

  /**
   * Calcule le score de taux de victoire (simulé)
   */
  private calculateWinRateScore(tank: Tank): number {
    // Simulation basée sur l'équilibre du char
    const damageScore = this.calculateDamageScore(tank);
    const survivalScore = this.calculateSurvivalScore(tank);
    const mobilityScore = this.calculateMobilityScore(tank);

    // Formule empirique pour simuler le taux de victoire
    const balanceScore = (damageScore + survivalScore + mobilityScore) / 3;
    
    // Ajustement selon le type de char
    let typeModifier = 1.0;
    switch (tank.type) {
      case TankType.HEAVY:
        typeModifier = 1.1; // Bonus pour les lourds
        break;
      case TankType.MEDIUM:
        typeModifier = 1.05; // Léger bonus pour les moyens
        break;
      case TankType.LIGHT:
        typeModifier = 0.95; // Malus pour les légers
        break;
      case TankType.DESTROYER:
        typeModifier = 0.9; // Malus pour les chasseurs
        break;
    }

    return Math.min(100, balanceScore * typeModifier);
  }

  /**
   * Calcule le score par tier
   */
  async calculateTierScore(tank: Tank): Promise<number> {
    const cacheKey = `tier_average_${tank.tier}`;
    let tierAverage = await CacheService.get<number>(cacheKey);

    if (!tierAverage) {
      // Calcul de la moyenne du tier
      const tierTanks = await this.tankModel.getTanks(
        { tier: [tank.tier] },
        { field: 'score_overall', order: 'desc' },
        { page: 1, limit: 1000 }
      );

      if (tierTanks.tanks.length > 0) {
        const totalScore = tierTanks.tanks.reduce((sum, t) => sum + (t.score_overall || 0), 0);
        tierAverage = totalScore / tierTanks.tanks.length;
        await CacheService.set(cacheKey, tierAverage, 3600); // Cache 1h
      } else {
        tierAverage = 75; // Valeur par défaut
      }
    }

    // Score relatif par rapport à la moyenne du tier
    const overallScore = this.calculateOverallScore(tank);
    const relativeScore = (overallScore / tierAverage) * 75; // Normalisation autour de 75

    return Math.min(100, Math.max(0, relativeScore));
  }

  /**
   * Calcule le score par type
   */
  async calculateTypeScore(tank: Tank): Promise<number> {
    const cacheKey = `type_average_${tank.type}`;
    let typeAverage = await CacheService.get<number>(cacheKey);

    if (!typeAverage) {
      // Calcul de la moyenne du type
      const typeTanks = await this.tankModel.getTanks(
        { type: [tank.type] },
        { field: 'score_overall', order: 'desc' },
        { page: 1, limit: 1000 }
      );

      if (typeTanks.tanks.length > 0) {
        const totalScore = typeTanks.tanks.reduce((sum, t) => sum + (t.score_overall || 0), 0);
        typeAverage = totalScore / typeTanks.tanks.length;
        await CacheService.set(cacheKey, typeAverage, 3600); // Cache 1h
      } else {
        typeAverage = 75; // Valeur par défaut
      }
    }

    // Score relatif par rapport à la moyenne du type
    const overallScore = this.calculateOverallScore(tank);
    const relativeScore = (overallScore / typeAverage) * 75; // Normalisation autour de 75

    return Math.min(100, Math.max(0, relativeScore));
  }

  /**
   * Met à jour tous les scores d'un char
   */
  async updateTankScores(tank: Tank, customWeights?: ScoringWeights): Promise<Tank | null> {
    try {
      const weights = customWeights || this.defaultWeights;
      
      const overallScore = this.calculateOverallScore(tank, weights);
      const tierScore = await this.calculateTierScore(tank);
      const typeScore = await this.calculateTypeScore(tank);

      const updatedTank = await this.tankModel.updateTankScores(tank.id, {
        overall: overallScore,
        tier: tierScore,
        type: typeScore
      });

      // Invalidation du cache
      await this.invalidateScoreCache(tank);

      return updatedTank;
    } catch (error) {
      console.error(`Erreur lors de la mise à jour des scores pour le char ${tank.id}:`, error);
      return null;
    }
  }

  /**
   * Recalcule tous les scores de la base de données
   */
  async recalculateAllScores(customWeights?: ScoringWeights): Promise<{ updated: number; errors: number }> {
    console.log('🔄 Début du recalcul de tous les scores...');
    
    let updated = 0;
    let errors = 0;
    let page = 1;
    const limit = 50;

    try {
      while (true) {
        const result = await this.tankModel.getTanks(
          {},
          { field: 'id', order: 'asc' },
          { page, limit }
        );

        if (result.tanks.length === 0) break;

        for (const tank of result.tanks) {
          try {
            await this.updateTankScores(tank, customWeights);
            updated++;
            
            if (updated % 10 === 0) {
              console.log(`📊 ${updated} chars traités...`);
            }
          } catch (error) {
            console.error(`Erreur pour le char ${tank.id}:`, error);
            errors++;
          }
        }

        page++;
      }

      console.log(`✅ Recalcul terminé: ${updated} chars mis à jour, ${errors} erreurs`);
      
      // Invalidation globale du cache
      await this.invalidateAllScoreCache();

      return { updated, errors };
    } catch (error) {
      console.error('❌ Erreur lors du recalcul global:', error);
      throw error;
    }
  }

  /**
   * Génère un rapport d'analyse des scores
   */
  async generateScoreReport(): Promise<{
    totalTanks: number;
    averageScores: { overall: number; tier: number; type: number };
    topPerformers: Tank[];
    scoreDistribution: { [range: string]: number };
  }> {
    const stats = await this.tankModel.getStats();
    const topTanks = await this.tankModel.getTopTanks('overall', 10);
    
    // Récupération de tous les chars pour l'analyse
    const allTanks = await this.tankModel.getTanks(
      {},
      { field: 'score_overall', order: 'desc' },
      { page: 1, limit: 1000 }
    );

    // Calcul des moyennes
    const totalScores = allTanks.tanks.reduce(
      (acc, tank) => ({
        overall: acc.overall + (tank.score_overall || 0),
        tier: acc.tier + (tank.score_tier || 0),
        type: acc.type + (tank.score_type || 0)
      }),
      { overall: 0, tier: 0, type: 0 }
    );

    const averageScores = {
      overall: totalScores.overall / allTanks.tanks.length,
      tier: totalScores.tier / allTanks.tanks.length,
      type: totalScores.type / allTanks.tanks.length
    };

    // Distribution des scores
    const scoreDistribution = allTanks.tanks.reduce((acc, tank) => {
      const score = tank.score_overall || 0;
      let range: string;
      
      if (score >= 90) range = '90-100';
      else if (score >= 80) range = '80-89';
      else if (score >= 70) range = '70-79';
      else if (score >= 60) range = '60-69';
      else range = '0-59';
      
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, {} as { [range: string]: number });

    return {
      totalTanks: stats.total,
      averageScores,
      topPerformers: topTanks,
      scoreDistribution
    };
  }

  /**
   * Invalide le cache des scores pour un char
   */
  private async invalidateScoreCache(tank: Tank): Promise<void> {
    const keys = [
      CacheService.getTankCacheKey(tank.id),
      CacheService.getRankingCacheKey('overall'),
      CacheService.getRankingCacheKey(`tier_${tank.tier}`),
      CacheService.getRankingCacheKey(`type_${tank.type}`),
      `tier_average_${tank.tier}`,
      `type_average_${tank.type}`
    ];

    await Promise.all(keys.map(key => CacheService.del(key)));
  }

  /**
   * Invalide tout le cache des scores
   */
  private async invalidateAllScoreCache(): Promise<void> {
    const keys = [
      'tanks:stats',
      'wargaming:all_tanks'
    ];

    await Promise.all(keys.map(key => CacheService.del(key)));
  }

  /**
   * Met à jour les poids de scoring
   */
  updateScoringWeights(newWeights: Partial<ScoringWeights>): ScoringWeights {
    this.defaultWeights = { ...this.defaultWeights, ...newWeights };
    
    // Normalisation pour que la somme soit égale à 1
    const total = Object.values(this.defaultWeights).reduce((sum, weight) => sum + weight, 0);
    if (total !== 1) {
      Object.keys(this.defaultWeights).forEach(key => {
        this.defaultWeights[key as keyof ScoringWeights] /= total;
      });
    }

    return this.defaultWeights;
  }

  /**
   * Obtient les poids actuels
   */
  getCurrentWeights(): ScoringWeights {
    return { ...this.defaultWeights };
  }
}
