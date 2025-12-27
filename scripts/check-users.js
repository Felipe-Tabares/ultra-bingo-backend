/**
 * Check Users Script
 * Muestra todos los usuarios registrados
 */

import '../src/config/index.js'; // Load dotenv
import { connectDB } from '../src/db/connection.js';
import User from '../src/models/User.js';

async function checkUsers() {
  await connectDB();

  const users = await User.find({}).lean();

  console.log('\n📊 Usuarios registrados:', users.length);
  console.log('================================\n');

  if (users.length === 0) {
    console.log('   No hay usuarios registrados.\n');
  } else {
    users.forEach((u, i) => {
      console.log(`${i + 1}. @${u.username}`);
      console.log(`   Wallet: ${u.wallet}`);
      console.log(`   Admin: ${u.isAdmin ? 'Sí ✓' : 'No'}`);
      console.log(`   Registrado: ${new Date(u.createdAt).toLocaleString()}`);
      console.log('');
    });
  }

  process.exit(0);
}

checkUsers();
