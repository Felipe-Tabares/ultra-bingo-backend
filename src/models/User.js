import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  // User ID (wallet-based or custom)
  odId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Username (display name chosen by user)
  username: {
    type: String,
    required: true,
  },

  // Connected wallet address (primary identifier)
  wallet: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },

  // Is admin
  isAdmin: {
    type: Boolean,
    default: false,
  },

  // Profile image URL (optional, for future use)
  profileImage: {
    type: String,
    default: null,
  },

  // Stats
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    cardsPurchased: { type: Number, default: 0 },
    totalSpent: { type: String, default: '0' }, // In atomic USDC
    totalWon: { type: String, default: '0' },   // In atomic USDC
  },

  // Last login
  lastLoginAt: {
    type: Date,
    default: Date.now,
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
UserSchema.pre('save', function() {
  this.updatedAt = new Date();
});

// Statics
UserSchema.statics.findByUserId = function(odId) {
  return this.findOne({ odId });
};

UserSchema.statics.findByWallet = function(wallet) {
  return this.findOne({ wallet: wallet.toLowerCase() });
};

// Methods
UserSchema.methods.connectWallet = function(walletAddress) {
  this.wallet = walletAddress.toLowerCase();
  return this.save();
};

UserSchema.methods.incrementStats = function(field, amount = 1) {
  if (this.stats[field] !== undefined) {
    if (typeof this.stats[field] === 'number') {
      this.stats[field] += amount;
    } else {
      // For string amounts (USDC)
      const current = BigInt(this.stats[field] || '0');
      const increment = BigInt(amount);
      this.stats[field] = (current + increment).toString();
    }
  }
  return this.save();
};

export default mongoose.model('User', UserSchema);
