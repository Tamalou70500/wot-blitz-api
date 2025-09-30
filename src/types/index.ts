// Types pour les chars (tanks)
export interface Tank {
  id: number;
  name: string;
  tier: number;
  type: TankType;
  nation: string;
  is_premium: boolean;
  image_url?: string;
  description?: string;
  health: number;
  armor_front: number;
  armor_side: number;
  armor_rear: number;
  gun_damage: number;
  gun_penetration: number;
  gun_rof: number;
  mobility_speed: number;
  mobility_power: number;
  score_overall?: number;
  score_tier?: number;
  score_type?: number;
  created_at?: Date;
  updated_at?: Date;
}

export enum TankType {
  LIGHT = 'lightTank',
  MEDIUM = 'mediumTank',
  HEAVY = 'heavyTank',
  DESTROYER = 'AT-SPG',
  SPG = 'SPG'
}

export enum Nation {
  USSR = 'ussr',
  GERMANY = 'germany',
  USA = 'usa',
  CHINA = 'china',
  FRANCE = 'france',
  UK = 'uk',
  JAPAN = 'japan',
  OTHER = 'other'
}

// Types pour les statistiques des joueurs
export interface PlayerStats {
  player_id: number;
  tank_id: number;
  battles: number;
  wins: number;
  damage_dealt: number;
  frags: number;
  win_rate: number;
  avg_damage: number;
  last_updated: Date;
}

// Types pour les réponses API Wargaming
export interface WargamingTankResponse {
  status: string;
  meta: {
    count: number;
  };
  data: {
    [key: string]: WargamingTank;
  };
}

export interface WargamingTank {
  tank_id: number;
  name: string;
  tier: number;
  type: string;
  nation: string;
  is_premium: boolean;
  images: {
    small_icon: string;
    contour_icon: string;
    big_icon: string;
  };
  description: string;
  engines: Array<{
    power: number;
  }>;
  guns: Array<{
    damage: Array<number>;
    penetration: Array<number>;
    rate: number;
  }>;
  armor: {
    hull: {
      front: number;
      sides: number;
      rear: number;
    };
    turret: {
      front: number;
      sides: number;
      rear: number;
    };
  };
  speed_forward: number;
  hp: number;
}

// Types pour les filtres et requêtes
export interface TankFilters {
  tier?: number[];
  type?: TankType[];
  nation?: Nation[];
  is_premium?: boolean;
  search?: string;
}

export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

// Types pour les réponses API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TankRanking {
  rank: number;
  tank: Tank;
  score: number;
  category: 'overall' | 'tier' | 'type';
}

// Types pour la configuration du scoring
export interface ScoringWeights {
  damage: number;
  winRate: number;
  survival: number;
  armor: number;
  mobility: number;
  penetration: number;
}

// Types pour les erreurs
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Types pour la base de données
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

// Types pour les services externes
export interface ExternalApiConfig {
  wargaming: {
    apiKey: string;
    baseUrl: string;
  };
  blitzAnalysiz?: {
    apiKey: string;
    baseUrl: string;
  };
  blitzStars?: {
    apiKey: string;
    baseUrl: string;
  };
}
