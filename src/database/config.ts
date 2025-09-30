import { Pool } from 'pg';
import { DatabaseConfig } from '../types';

const config: DatabaseConfig = {
  host: process.env.DB_HOST || 'dpg-d3dvhvh5pdvs73fpkhl0-a',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dbwotb',
  user: process.env.DB_USER || 'dbwotb_user',
  password: process.env.DB_PASSWORD || 'F2e69lapGlV6WQ5NAuoBCYv0R69tsPjS',
};

export const pool = new Pool({
  host: config.host,
  port: config.port,
  database: config.database,
  user: config.user,
  password: config.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test de connexion
pool.on('connect', () => {
  console.log('✅ Connexion à PostgreSQL établie');
});

pool.on('error', (err) => {
  console.error('❌ Erreur PostgreSQL:', err);
});

export default pool;
