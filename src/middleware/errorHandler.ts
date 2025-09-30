import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('❌ Erreur capturée:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Erreurs de validation
  if (error.name === 'ValidationError') {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Données de requête invalides',
      message: error.message
    };
    res.status(400).json(response);
    return;
  }

  // Erreurs de base de données
  if (error.code === '23505') { // Violation de contrainte unique
    const response: ApiResponse<null> = {
      success: false,
      error: 'Conflit de données',
      message: 'Cette ressource existe déjà'
    };
    res.status(409).json(response);
    return;
  }

  if (error.code === '23503') { // Violation de clé étrangère
    const response: ApiResponse<null> = {
      success: false,
      error: 'Référence invalide',
      message: 'La ressource référencée n\'existe pas'
    };
    res.status(400).json(response);
    return;
  }

  // Erreurs de timeout
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Timeout de requête',
      message: 'La requête a pris trop de temps à s\'exécuter'
    };
    res.status(504).json(response);
    return;
  }

  // Erreur par défaut
  const statusCode = error.statusCode || 500;
  const response: ApiResponse<null> = {
    success: false,
    error: statusCode === 500 ? 'Erreur interne du serveur' : error.message,
    message: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };

  res.status(statusCode).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ApiResponse<null> = {
    success: false,
    error: 'Endpoint non trouvé',
    message: `La route ${req.method} ${req.path} n'existe pas`
  };
  res.status(404).json(response);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
