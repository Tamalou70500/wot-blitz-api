import { Pool, QueryResult } from 'pg';
import pool from '../database/config';
import { Tank, TankFilters, SortOptions, PaginationOptions, TankType, Nation } from '../types';

export class TankModel {
  private db: Pool;

  constructor() {
    this.db = pool;
  }

  /**
   * Crée la table des chars si elle n'existe pas
   */
  async createTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS tanks (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tier INTEGER NOT NULL CHECK (tier >= 1 AND tier <= 10),
        type VARCHAR(50) NOT NULL,
        nation VARCHAR(50) NOT NULL,
        is_premium BOOLEAN DEFAULT FALSE,
        image_url TEXT,
        description TEXT,
        health INTEGER NOT NULL,
        armor_front INTEGER DEFAULT 0,
        armor_side INTEGER DEFAULT 0,
        armor_rear INTEGER DEFAULT 0,
        gun_damage INTEGER DEFAULT 0,
        gun_penetration INTEGER DEFAULT 0,
        gun_rof DECIMAL(5,2) DEFAULT 0,
        mobility_speed INTEGER DEFAULT 0,
        mobility_power INTEGER DEFAULT 0,
        score_overall DECIMAL(8,3) DEFAULT 0,
        score_tier DECIMAL(8,3) DEFAULT 0,
        score_type DECIMAL(8,3) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tanks_tier ON tanks(tier);
      CREATE INDEX IF NOT EXISTS idx_tanks_type ON tanks(type);
      CREATE INDEX IF NOT EXISTS idx_tanks_nation ON tanks(nation);
      CREATE INDEX IF NOT EXISTS idx_tanks_premium ON tanks(is_premium);
      CREATE INDEX IF NOT EXISTS idx_tanks_score_overall ON tanks(score_overall DESC);
      CREATE INDEX IF NOT EXISTS idx_tanks_score_tier ON tanks(score_tier DESC);
      CREATE INDEX IF NOT EXISTS idx_tanks_score_type ON tanks(score_type DESC);
    `;

    await this.db.query(query);
  }

  /**
   * Insère ou met à jour un char
   */
  async upsertTank(tank: Tank): Promise<Tank> {
    const query = `
      INSERT INTO tanks (
        id, name, tier, type, nation, is_premium, image_url, description,
        health, armor_front, armor_side, armor_rear, gun_damage, gun_penetration,
        gun_rof, mobility_speed, mobility_power, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        tier = EXCLUDED.tier,
        type = EXCLUDED.type,
        nation = EXCLUDED.nation,
        is_premium = EXCLUDED.is_premium,
        image_url = EXCLUDED.image_url,
        description = EXCLUDED.description,
        health = EXCLUDED.health,
        armor_front = EXCLUDED.armor_front,
        armor_side = EXCLUDED.armor_side,
        armor_rear = EXCLUDED.armor_rear,
        gun_damage = EXCLUDED.gun_damage,
        gun_penetration = EXCLUDED.gun_penetration,
        gun_rof = EXCLUDED.gun_rof,
        mobility_speed = EXCLUDED.mobility_speed,
        mobility_power = EXCLUDED.mobility_power,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      tank.id, tank.name, tank.tier, tank.type, tank.nation, tank.is_premium,
      tank.image_url, tank.description, tank.health, tank.armor_front,
      tank.armor_side, tank.armor_rear, tank.gun_damage, tank.gun_penetration,
      tank.gun_rof, tank.mobility_speed, tank.mobility_power
    ];

    const result: QueryResult<Tank> = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Récupère un char par son ID
   */
  async getTankById(id: number): Promise<Tank | null> {
    const query = 'SELECT * FROM tanks WHERE id = $1';
    const result: QueryResult<Tank> = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Récupère tous les chars avec filtres, tri et pagination
   */
  async getTanks(
    filters: TankFilters = {},
    sort: SortOptions = { field: 'score_overall', order: 'desc' },
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<{ tanks: Tank[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    // Application des filtres
    if (filters.tier && filters.tier.length > 0) {
      whereClause += ` AND tier = ANY($${paramIndex})`;
      values.push(filters.tier);
      paramIndex++;
    }

    if (filters.type && filters.type.length > 0) {
      whereClause += ` AND type = ANY($${paramIndex})`;
      values.push(filters.type);
      paramIndex++;
    }

    if (filters.nation && filters.nation.length > 0) {
      whereClause += ` AND nation = ANY($${paramIndex})`;
      values.push(filters.nation);
      paramIndex++;
    }

    if (filters.is_premium !== undefined) {
      whereClause += ` AND is_premium = $${paramIndex}`;
      values.push(filters.is_premium);
      paramIndex++;
    }

    if (filters.search) {
      whereClause += ` AND name ILIKE $${paramIndex}`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Requête pour le total
    const countQuery = `SELECT COUNT(*) as total FROM tanks ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Requête pour les données avec tri et pagination
    const offset = (pagination.page - 1) * pagination.limit;
    const dataQuery = `
      SELECT * FROM tanks 
      ${whereClause}
      ORDER BY ${sort.field} ${sort.order.toUpperCase()}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    values.push(pagination.limit, offset);
    const dataResult: QueryResult<Tank> = await this.db.query(dataQuery, values);

    return {
      tanks: dataResult.rows,
      total
    };
  }

  /**
   * Met à jour les scores d'un char
   */
  async updateTankScores(id: number, scores: { overall?: number; tier?: number; type?: number }): Promise<Tank | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (scores.overall !== undefined) {
      updates.push(`score_overall = $${paramIndex}`);
      values.push(scores.overall);
      paramIndex++;
    }

    if (scores.tier !== undefined) {
      updates.push(`score_tier = $${paramIndex}`);
      values.push(scores.tier);
      paramIndex++;
    }

    if (scores.type !== undefined) {
      updates.push(`score_type = $${paramIndex}`);
      values.push(scores.type);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.getTankById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE tanks 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result: QueryResult<Tank> = await this.db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Récupère le top des chars par catégorie
   */
  async getTopTanks(category: 'overall' | 'tier' | 'type', limit: number = 10, tier?: number, type?: TankType): Promise<Tank[]> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (tier !== undefined) {
      whereClause += ` AND tier = $${paramIndex}`;
      values.push(tier);
      paramIndex++;
    }

    if (type !== undefined) {
      whereClause += ` AND type = $${paramIndex}`;
      values.push(type);
      paramIndex++;
    }

    const scoreField = `score_${category}`;
    const query = `
      SELECT * FROM tanks 
      ${whereClause}
      ORDER BY ${scoreField} DESC
      LIMIT $${paramIndex}
    `;

    values.push(limit);
    const result: QueryResult<Tank> = await this.db.query(query, values);
    return result.rows;
  }

  /**
   * Récupère les statistiques générales
   */
  async getStats(): Promise<{
    total: number;
    byTier: { [tier: number]: number };
    byType: { [type: string]: number };
    byNation: { [nation: string]: number };
  }> {
    const queries = [
      'SELECT COUNT(*) as total FROM tanks',
      'SELECT tier, COUNT(*) as count FROM tanks GROUP BY tier ORDER BY tier',
      'SELECT type, COUNT(*) as count FROM tanks GROUP BY type',
      'SELECT nation, COUNT(*) as count FROM tanks GROUP BY nation'
    ];

    const [totalResult, tierResult, typeResult, nationResult] = await Promise.all(
      queries.map(query => this.db.query(query))
    );

    return {
      total: parseInt(totalResult.rows[0].total),
      byTier: tierResult.rows.reduce((acc, row) => {
        acc[row.tier] = parseInt(row.count);
        return acc;
      }, {}),
      byType: typeResult.rows.reduce((acc, row) => {
        acc[row.type] = parseInt(row.count);
        return acc;
      }, {}),
      byNation: nationResult.rows.reduce((acc, row) => {
        acc[row.nation] = parseInt(row.count);
        return acc;
      }, {})
    };
  }

  /**
   * Supprime un char
   */
  async deleteTank(id: number): Promise<boolean> {
    const query = 'DELETE FROM tanks WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Insère plusieurs chars en lot
   */
  async bulkUpsertTanks(tanks: Tank[]): Promise<number> {
    if (tanks.length === 0) return 0;

    const client = await this.db.connect();
    let insertedCount = 0;

    try {
      await client.query('BEGIN');

      for (const tank of tanks) {
        await this.upsertTank(tank);
        insertedCount++;
      }

      await client.query('COMMIT');
      console.log(`✅ ${insertedCount} chars insérés/mis à jour en base`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erreur lors de l\'insertion en lot:', error);
      throw error;
    } finally {
      client.release();
    }

    return insertedCount;
  }
}
