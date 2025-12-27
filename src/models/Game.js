import mongoose from 'mongoose';

const GAME_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended',
};

// Modos de juego ULTRA - cada letra tiene su patrón específico
const GAME_MODES = {
  FULL_CARD: 'fullCard',      // Cartón completo (blackout)
  LETTER_U: 'letterU',        // Formar la letra U
  LETTER_L: 'letterL',        // Formar la letra L
  LETTER_T: 'letterT',        // Formar la letra T
  LETTER_R: 'letterR',        // Formar la letra R
  LETTER_A: 'letterA',        // Formar la letra A
  LINE: 'line',               // Cualquier línea (horizontal, vertical, diagonal)
  CORNERS: 'corners',         // 4 esquinas
};

const GameSchema = new mongoose.Schema({
  // Game ID (e.g., "game_timestamp")
  gameId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Game status
  status: {
    type: String,
    enum: Object.values(GAME_STATUS),
    default: GAME_STATUS.WAITING,
    index: true,
  },

  // Game mode - defines the winning pattern
  gameMode: {
    type: String,
    enum: Object.values(GAME_MODES),
    default: GAME_MODES.FULL_CARD,
    index: true,
  },

  // Called numbers (in order)
  calledNumbers: {
    type: [Number],
    default: [],
  },

  // Current/last called number
  currentNumber: {
    type: Number,
    default: null,
  },

  // Winner info
  winner: {
    odId: String,
    odUsername: String,
    wallet: String,
    cardId: String,
    prizeAmount: String,
  },

  // Prize pool in USDC
  prizePool: {
    type: String,
    default: '0',
  },

  // Total cards sold
  cardsSold: {
    type: Number,
    default: 0,
  },

  // Timestamps
  startedAt: {
    type: Date,
    default: null,
  },

  endedAt: {
    type: Date,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Statics
GameSchema.statics.GAME_STATUS = GAME_STATUS;

GameSchema.statics.findActive = function() {
  return this.findOne({
    status: { $in: [GAME_STATUS.WAITING, GAME_STATUS.PLAYING, GAME_STATUS.PAUSED] }
  }).sort({ createdAt: -1 });
};

GameSchema.statics.findCurrent = function() {
  return this.findOne().sort({ createdAt: -1 });
};

// Methods
GameSchema.methods.start = function() {
  this.status = GAME_STATUS.PLAYING;
  this.startedAt = new Date();
  return this.save();
};

GameSchema.methods.pause = function() {
  if (this.status === GAME_STATUS.PLAYING) {
    this.status = GAME_STATUS.PAUSED;
  }
  return this.save();
};

GameSchema.methods.resume = function() {
  if (this.status === GAME_STATUS.PAUSED) {
    this.status = GAME_STATUS.PLAYING;
  }
  return this.save();
};

GameSchema.methods.end = function(winnerData = null) {
  this.status = GAME_STATUS.ENDED;
  this.endedAt = new Date();
  if (winnerData) {
    this.winner = winnerData;
  }
  return this.save();
};

GameSchema.methods.callNumber = function(number) {
  if (this.status !== GAME_STATUS.PLAYING) {
    throw new Error('Game is not in playing state');
  }

  if (number < 1 || number > 75) {
    throw new Error('Invalid number');
  }

  if (this.calledNumbers.includes(number)) {
    throw new Error('Number already called');
  }

  this.calledNumbers.push(number);
  this.currentNumber = number;
  return this.save();
};

// Set game mode (only allowed when not playing)
GameSchema.methods.setGameMode = function(mode) {
  if (this.status === GAME_STATUS.PLAYING || this.status === GAME_STATUS.PAUSED) {
    throw new Error('Cannot change game mode while game is in progress');
  }

  if (!Object.values(GAME_MODES).includes(mode)) {
    throw new Error('Invalid game mode');
  }

  this.gameMode = mode;
  return this.save();
};

// Check if purchases are allowed
GameSchema.methods.canPurchaseCards = function() {
  return this.status === GAME_STATUS.WAITING || this.status === GAME_STATUS.ENDED;
};

export default mongoose.model('Game', GameSchema);
export { GAME_STATUS, GAME_MODES };
