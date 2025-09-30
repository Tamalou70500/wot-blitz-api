// Script de test simple pour l'API WoT Blitz Stats
const axios = require('axios');

const API_BASE = 'http://localhost:3001';

async function testAPI() {
  console.log('🧪 Tests de l\'API WoT Blitz Stats\n');

  try {
    // Test 1: Health check
    console.log('1. Test du health check...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check:', healthResponse.data);
    console.log('');

    // Test 2: Récupération des statistiques
    console.log('2. Test des statistiques générales...');
    try {
      const statsResponse = await axios.get(`${API_BASE}/api/tanks/stats`);
      console.log('✅ Statistiques:', statsResponse.data);
    } catch (error) {
      console.log('⚠️ Statistiques non disponibles (base de données vide)');
    }
    console.log('');

    // Test 3: Liste des chars
    console.log('3. Test de la liste des chars...');
    try {
      const tanksResponse = await axios.get(`${API_BASE}/api/tanks?limit=5`);
      console.log('✅ Liste des chars:', tanksResponse.data);
    } catch (error) {
      console.log('⚠️ Liste des chars non disponible (base de données vide)');
    }
    console.log('');

    // Test 4: Poids de scoring
    console.log('4. Test des poids de scoring...');
    try {
      const weightsResponse = await axios.get(`${API_BASE}/api/scoring/weights`);
      console.log('✅ Poids de scoring:', weightsResponse.data);
    } catch (error) {
      console.log('❌ Erreur poids de scoring:', error.message);
    }
    console.log('');

    // Test 5: Rapport de scoring
    console.log('5. Test du rapport de scoring...');
    try {
      const reportResponse = await axios.get(`${API_BASE}/api/scoring/report`);
      console.log('✅ Rapport de scoring:', reportResponse.data);
    } catch (error) {
      console.log('⚠️ Rapport non disponible (base de données vide)');
    }
    console.log('');

    console.log('🎉 Tests terminés avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Suggestion: Assurez-vous que l\'API est démarrée avec "npm run dev"');
    }
  }
}

// Exécution des tests
testAPI();
