import mongoose from 'mongoose';

/**
 * Winner Model - Stores historical record of all bingo winners
 * Designed for easy migration to DynamoDB
 */
const WinnerSchema = new mongoose.Schema({
  // Unique winner ID (for DynamoDB: partition key)
  winnerId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Game ID where the win occurred
  gameId: {
    type: String,
    required: true,
    index: true,
  },

  // Winner info
  odId: {
    type: String,
    required: true,
  },

  odUsername: {
    type: String,
    required: true,
  },

  wallet: {
    type: String,
    required: true,
    index: true,
  },

  // Winning card info
  cardId: {
    type: String,
    required: true,
  },

  // Game mode and pattern that won
  gameMode: {
    type: String,
    required: true,
  },

  patternName: {
    type: String,
    required: true,
  },

  // Prize info
  prizeAmount: {
    type: String,
    default: '0',
  },

  prizeToken: {
    type: String,
    default: 'USDC',
  },

  // Game stats at time of win
  totalCalledNumbers: {
    type: Number,
    required: true,
  },

  totalCards: {
    type: Number,
    default: 0,
  },

  // Timestamps
  wonAt: {
    type: Date,
    default: Date.now,
    index: true,
  },

  // For DynamoDB: sort key (timestamp in ISO format)
  createdAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
});

// Index for querying recent winners
WinnerSchema.index({ wonAt: -1 });

// Static method to get recent winners
WinnerSchema.statics.getRecent = function(limit = 10) {
  return this.find()
    .sort({ wonAt: -1 })
    .limit(limit)
    .select('winnerId odUsername wallet gameMode patternName prizeAmount wonAt cardId')
    .lean();
};

// Static method to get winners by wallet
WinnerSchema.statics.getByWallet = function(wallet, limit = 10) {
  return this.find({ wallet: wallet.toLowerCase() })
    .sort({ wonAt: -1 })
    .limit(limit)
    .lean();
};

export default mongoose.model('Winner', WinnerSchema);
