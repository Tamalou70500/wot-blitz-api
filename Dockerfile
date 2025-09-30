# Dockerfile pour l'API WoT Blitz Stats
FROM node:18-alpine

# Définition du répertoire de travail
WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./

# Installation des dépendances
RUN npm ci --only=production

# Copie du code source
COPY src/ ./src/

# Compilation TypeScript
RUN npm run build

# Exposition du port
EXPOSE 3001

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3001

# Commande de démarrage
CMD ["npm", "start"]

# Métadonnées
LABEL maintainer="Manus AI"
LABEL description="API backend pour WoT Blitz Stats"
LABEL version="1.0.0"
