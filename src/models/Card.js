import mongoose from 'mongoose';

const CardSchema = new mongoose.Schema({
  // Card ID (e.g., "card_uuid")
  cardId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Bingo card numbers (5x5 grid)
  // { B: [1,2,3,4,5], I: [...], N: [...], G: [...], O: [...] }
  numbers: {
    B: [Number],
    I: [Number],
    N: [Number],
    G: [Number],
    O: [Number],
  },

  // Card status
  // SECURITY: 'reserved' status prevents race conditions during x402 payment
  // 'won' status marks cards that won but were rejected (absent winner) - excluded from future checks
  status: {
    type: String,
    enum: ['available', 'reserved', 'purchased', 'expired', 'won'],
    default: 'available',
    index: true,
  },

  // Reservation info - for preventing double-purchase during payment processing
  reservedBy: {
    type: String,
    default: null,
    index: true,
  },

  reservedAt: {
    type: Date,
    default: null,
  },

  // TTL for reservation - auto-expires after 5 minutes
  reservationExpiresAt: {
    type: Date,
    default: null,
    index: true,
  },

  // Owner ID - null if available
  owner: {
    type: String,
    default: null,
    index: true,
  },

  // Owner's username
  ownerUsername: {
    type: String,
    default: null,
  },

  // Owner's wallet address
  ownerWallet: {
    type: String,
    default: null,
    index: true,
  },

  // Purchase transaction hash (x402)
  purchaseTxHash: {
    type: String,
    default: null,
  },

  // Price paid in USDC (atomic units)
  pricePaid: {
    type: String,
    default: null,
  },

  // Associated game ID
  gameId: {
    type: String,
    default: null,
    index: true,
  },

  // Timestamps
  purchasedAt: {
    type: Date,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  expiresAt: {
    type: Date,
    default: null,
  },
});

// Index for finding available cards efficiently
CardSchema.index({ status: 1, createdAt: -1 });

// Methods
CardSchema.methods.purchase = function(owner, wallet, txHash, price) {
  this.status = 'purchased';
  this.owner = owner;
  this.ownerWallet = wallet;
  this.purchaseTxHash = txHash;
  this.pricePaid = price;
  this.purchasedAt = new Date();
  return this.save();
};

// Statics
CardSchema.statics.findAvailable = function(limit = 50) {
  return this.find({ status: 'available' })
    .sort({ createdAt: -1 })
    .limit(limit);
};

CardSchema.statics.findByOwner = function(ownerId) {
  return this.find({ owner: ownerId, status: 'purchased' })
    .sort({ purchasedAt: -1 });
};

CardSchema.statics.findByGame = function(gameId) {
  return this.find({ gameId, status: 'purchased' });
};

/**
 * SECURITY: Reserve multiple cards atomically
 * Returns only cards that were successfully reserved
 * Reservation expires after TTL (default 5 minutes)
 */
CardSchema.statics.reserveCards = async function(cardIds, userId, ttlMinutes = 5) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  const reservedCards = [];

  for (const cardId of cardIds) {
    // Try to reserve only if available (atomic operation)
    const result = await this.findOneAndUpdate(
      { cardId, status: 'available' },
      {
        $set: {
          status: 'reserved',
          reservedBy: userId,
          reservedAt: now,
          reservationExpiresAt: expiresAt,
        },
      },
      { new: true }
    );

    if (result) {
      reservedCards.push(result);
    }
  }

  return reservedCards;
};

/**
 * SECURITY: Release reservation (cancel or expired)
 */
CardSchema.statics.releaseReservation = async function(cardIds, userId) {
  return this.updateMany(
    {
      cardId: { $in: cardIds },
      status: 'reserved',
      reservedBy: userId,
    },
    {
      $set: {
        status: 'available',
        reservedBy: null,
        reservedAt: null,
        reservationExpiresAt: null,
      },
    }
  );
};

/**
 * SECURITY: Convert reservation to purchase
 * Only works if cards are reserved by the same user
 */
CardSchema.statics.confirmReservation = async function(cardIds, userId, wallet, txHash, pricePerCard, username = null) {
  const now = new Date();
  const confirmedCards = [];

  for (const cardId of cardIds) {
    const result = await this.findOneAndUpdate(
      {
        cardId,
        status: 'reserved',
        reservedBy: userId,
      },
      {
        $set: {
          status: 'purchased',
          owner: userId,
          ownerUsername: username,
          ownerWallet: wallet,
          purchaseTxHash: txHash,
          pricePaid: pricePerCard,
          purchasedAt: now,
          reservedBy: null,
          reservedAt: null,
          reservationExpiresAt: null,
        },
      },
      { new: true }
    );

    if (result) {
      confirmedCards.push({
        id: result.cardId,
        numbers: result.numbers,
        owner: result.owner,
        ownerUsername: result.ownerUsername,
        ownerWallet: result.ownerWallet,
      });
    }
  }

  return confirmedCards;
};

/**
 * SECURITY: Clean up expired reservations
 * Should be called periodically (cron job or on each request)
 */
CardSchema.statics.cleanExpiredReservations = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: 'reserved',
      reservationExpiresAt: { $lt: now },
    },
    {
      $set: {
        status: 'available',
        reservedBy: null,
        reservedAt: null,
        reservationExpiresAt: null,
      },
    }
  );

  if (result.modifiedCount > 0) {
    console.log(`[Card] Cleaned ${result.modifiedCount} expired reservations`);
  }

  return result.modifiedCount;
};

export default mongoose.model('Card', CardSchema);
