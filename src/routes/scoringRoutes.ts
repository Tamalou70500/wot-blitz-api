import { Router } from 'express';
import { ScoringController } from '../controllers/scoringController';

const router = Router();
const scoringController = new ScoringController();

// Routes pour la gestion des scores
router.get('/report', scoringController.getScoreReport);
router.get('/weights', scoringController.getWeights);
router.put('/weights', scoringController.updateWeights);
router.get('/simulate/:id', scoringController.simulateScore);

// Routes d'administration (à protéger en production)
router.post('/recalculate', scoringController.recalculateScores);
router.post('/tank/:id', scoringController.recalculateTankScore);

export default router;
