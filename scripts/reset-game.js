/**
 * Reset Game Script
 * Limpia toda la base de datos y genera 80 cartones nuevos
 *
 * Ejecutar con: node scripts/reset-game.js
 */

import '../src/config/index.js'; // Load dotenv
import mongoose from 'mongoose';
import { connectDB } from '../src/db/connection.js';
import Card from '../src/models/Card.js';
import Game from '../src/models/Game.js';
import Winner from '../src/models/Winner.js';
import bingoCardService from '../src/services/bingoCard.js';

const TOTAL_CARDS = 80;

async function resetGame() {
  console.log('🎄 Ultra Bingo - Reset Game Script');
  console.log('==================================\n');

  try {
    // Connect to MongoDB
    console.log('📡 Conectando a MongoDB...');
    await connectDB();
    console.log('');

    // Step 1: Delete all cards
    console.log('🗑️  Eliminando todos los cartones...');
    const deletedCards = await Card.deleteMany({});
    console.log(`   Eliminados: ${deletedCards.deletedCount} cartones\n`);

    // Step 2: Delete all games
    console.log('🗑️  Eliminando todos los juegos...');
    const deletedGames = await Game.deleteMany({});
    console.log(`   Eliminados: ${deletedGames.deletedCount} juegos\n`);

    // Step 3: Delete all winners (optional - comment out if you want to keep history)
    console.log('🗑️  Eliminando historial de ganadores...');
    const deletedWinners = await Winner.deleteMany({});
    console.log(`   Eliminados: ${deletedWinners.deletedCount} registros de ganadores\n`);

    // Step 4: Generate 80 new cards using the service
    console.log(`🎰 Generando ${TOTAL_CARDS} cartones nuevos...`);
    const generatedCards = bingoCardService.generateMultipleCards(TOTAL_CARDS);

    const newCards = generatedCards.map(card => ({
      cardId: card.id,
      numbers: card.numbers,
      status: 'available',
      createdAt: new Date(),
    }));

    // Insert all cards
    const insertResult = await Card.insertMany(newCards);
    console.log(`✅ Insertados: ${insertResult.length} cartones nuevos\n`);

    // Step 5: Create a fresh game in 'waiting' status
    console.log('🎮 Creando nuevo juego en estado "waiting"...');
    const newGame = new Game({
      gameId: `game_${Date.now()}`,
      status: 'waiting',
      calledNumbers: [],
      currentNumber: null,
      winner: null,
      gameMode: 'fullCard',
      createdAt: new Date(),
    });
    await newGame.save();
    console.log(`✅ Juego creado: ${newGame.gameId}\n`);

    // Verification
    console.log('📊 Verificación final:');
    const availableCount = await Card.countDocuments({ status: 'available' });
    const purchasedCount = await Card.countDocuments({ status: 'purchased' });
    const gamesCount = await Game.countDocuments();
    const winnersCount = await Winner.countDocuments();

    console.log(`   • Cartones disponibles: ${availableCount}`);
    console.log(`   • Cartones comprados: ${purchasedCount}`);
    console.log(`   • Juegos en BD: ${gamesCount}`);
    console.log(`   • Ganadores en historial: ${winnersCount}`);

    console.log('\n🎉 ¡Reset completado exitosamente!');
    console.log('   El juego está listo para la comunidad.\n');

  } catch (error) {
    console.error('❌ Error durante el reset:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Desconectado de MongoDB');
    process.exit(0);
  }
}

resetGame();
