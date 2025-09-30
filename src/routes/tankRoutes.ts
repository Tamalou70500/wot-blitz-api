import { Router } from 'express';
import { TankController } from '../controllers/tankController';

const router = Router();
const tankController = new TankController();

// Routes publiques pour les chars
router.get('/', tankController.getTanks);
router.get('/stats', tankController.getStats);
router.get('/rankings/:category', tankController.getRankings);
router.get('/:id', tankController.getTankById);
router.post('/compare', tankController.compareTanks);

// Routes d'administration (à protéger en production)
router.post('/sync', tankController.syncTanks);

export default router;
