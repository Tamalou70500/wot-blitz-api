import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import tankRoutes from './routes/tankRoutes';
import scoringRoutes from './routes/scoringRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { TankModel } from './models/tankModel';

// Configuration des variables d'environnement
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares de sécurité et logging
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));

// Middlewares de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes API
app.use('/api/tanks', tankRoutes);
app.use('/api/scoring', scoringRoutes);

// Middleware de gestion des erreurs
app.use(notFoundHandler);
app.use(errorHandler);

// Initialisation de la base de données et démarrage du serveur
async function startServer() {
  try {
    console.log('🚀 Démarrage du serveur WoT Blitz API...');
    
    // Initialisation des tables de base de données
    const tankModel = new TankModel();
    await tankModel.createTable();
    console.log('✅ Tables de base de données initialisées');

    // Démarrage du serveur
    app.listen(PORT, () => {
      console.log(`🌐 Serveur démarré sur le port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API Tanks: http://localhost:${PORT}/api/tanks`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Gestion des signaux de fermeture
process.on('SIGTERM', () => {
  console.log('🛑 Signal SIGTERM reçu, fermeture du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Signal SIGINT reçu, fermeture du serveur...');
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Exception non capturée:', error);
  process.exit(1);
});

// Démarrage
startServer();
