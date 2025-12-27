import '../src/config/index.js'; // Load dotenv
import mongoose from 'mongoose';
import { connectDB } from '../src/db/connection.js';

async function checkCards() {
  await connectDB();
  console.log('Connected to MongoDB');

  const Card = mongoose.model('Card', new mongoose.Schema({}, { strict: false }), 'cards');

  // Ver todos los cartones y sus estados
  const allCards = await Card.find({}).lean();
  console.log('\n=== TODOS LOS CARTONES ===');
  console.log('Total:', allCards.length);

  // Agrupar por status
  const byStatus = {};
  allCards.forEach(c => {
    byStatus[c.status] = byStatus[c.status] || [];
    byStatus[c.status].push(c);
  });

  for (const [status, cards] of Object.entries(byStatus)) {
    console.log(`\nStatus '${status}': ${cards.length} cartones`);
    if (status !== 'available') {
      cards.forEach(c => {
        console.log(`  - ${c.cardId} | Owner: ${c.ownerUsername || c.owner || 'N/A'} | Wallet: ${c.ownerWallet || 'N/A'}`);
      });
    }
  }

  await mongoose.disconnect();
  console.log('\nDone');
}

checkCards().catch(console.error);
