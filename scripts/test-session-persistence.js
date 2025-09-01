#!/usr/bin/env node

// Script pour tester la persistance des sessions admin
// Utilise les mêmes endpoints que l'interface admin

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function testSessionPersistence() {
  console.log('🧪 Test de Persistance Sessions Admin - 2IAE\n');
  
  const baseUrl = await ask('URL de test (ex: https://votre-domaine.com ou http://localhost:5000): ');
  
  if (!baseUrl) {
    console.log('❌ URL requise');
    process.exit(1);
  }
  
  console.log('\n📋 Test de session admin...\n');
  
  try {
    // 1. Test endpoint non-authentifié
    console.log('1️⃣  Test accès sans authentification...');
    const unauthResponse = await fetch(`${baseUrl}/api/admin/me`, {
      credentials: 'include'
    });
    console.log(`   Status: ${unauthResponse.status} ${unauthResponse.status === 401 ? '✅' : '❌'}`);
    
    // 2. Login admin
    console.log('\n2️⃣  Test de connexion admin...');
    const username = await ask('   Username admin: ');
    const password = await ask('   Password admin: ');
    
    const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    
    const loginData = await loginResponse.json();
    console.log(`   Login: ${loginData.success ? '✅' : '❌'} ${loginData.message || ''}`);
    
    if (!loginData.success) {
      console.log('❌ Connexion échouée');
      process.exit(1);
    }
    
    // 3. Test session immédiate
    console.log('\n3️⃣  Test session immédiate...');
    const sessionResponse = await fetch(`${baseUrl}/api/admin/me`, {
      credentials: 'include'
    });
    const sessionData = await sessionResponse.json();
    console.log(`   Session active: ${sessionData.success ? '✅' : '❌'}`);
    
    // 4. Test persistance (simulation rafraîchissement)
    console.log('\n4️⃣  Test persistance session...');
    console.log('   Simulation rafraîchissement page...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const persistResponse = await fetch(`${baseUrl}/api/admin/me`, {
      credentials: 'include'
    });
    const persistData = await persistResponse.json();
    console.log(`   Session persistante: ${persistData.success ? '✅' : '❌'}`);
    
    // 5. Test accès admin protégé
    console.log('\n5️⃣  Test endpoint admin protégé...');
    const contentResponse = await fetch(`${baseUrl}/api/admin/content`, {
      credentials: 'include'
    });
    console.log(`   Accès admin: ${contentResponse.status === 200 ? '✅' : '❌'}`);
    
    console.log('\n🎉 Test terminé !');
    
    if (sessionData.success && persistData.success && contentResponse.status === 200) {
      console.log('✅ SUCCÈS: Sessions admin fonctionnent correctement');
    } else {
      console.log('❌ PROBLÈME: Sessions admin ne persistent pas correctement');
      console.log('\n💡 Suggestions:');
      console.log('- Vérifiez que SESSION_SECRET est configuré en production');
      console.log('- Vérifiez que la base PostgreSQL est accessible');
      console.log('- Vérifiez les logs serveur pour erreurs de session');
    }
    
  } catch (error) {
    console.error('\n❌ Erreur de test:', error.message);
    console.log('\n💡 Vérifiez:');
    console.log('- L\'URL du serveur est correcte');
    console.log('- Le serveur est démarré et accessible');
    console.log('- Les CORS sont configurés pour votre domaine');
  } finally {
    rl.close();
  }
}

testSessionPersistence();