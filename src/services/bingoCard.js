import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { config } from '../config/index.js';

const { bingoColumns } = config;
const COLUMNS = ['B', 'I', 'N', 'G', 'O'];

/**
 * ULTRA Game Mode Patterns
 * Each pattern defines which positions must be marked to win
 * Grid is 5x5 where:
 *   - Columns: B(0), I(1), N(2), G(3), O(4)
 *   - Rows: 0, 1, 2, 3, 4 (top to bottom)
 *   - Position format: [column, row]
 *   - Center position [2,2] is always FREE (automatically marked)
 */
const GAME_PATTERNS = {
  // Cartón completo - todas las 24 posiciones (excluyendo FREE)
  fullCard: {
    name: 'Cartón Completo',
    description: 'Marca todas las casillas del cartón',
    positions: [
      [0,0],[0,1],[0,2],[0,3],[0,4],
      [1,0],[1,1],[1,2],[1,3],[1,4],
      [2,0],[2,1],[2,3],[2,4], // Skip [2,2] FREE
      [3,0],[3,1],[3,2],[3,3],[3,4],
      [4,0],[4,1],[4,2],[4,3],[4,4],
    ],
  },

  // Letra U
  // #...#
  // #...#
  // #...#
  // #...#
  // #####
  letterU: {
    name: 'Letra U',
    description: 'Forma la letra U en el cartón',
    positions: [
      [0,0],[0,1],[0,2],[0,3],[0,4], // Columna B completa
      [4,0],[4,1],[4,2],[4,3],[4,4], // Columna O completa
      [1,4],[2,4],[3,4],             // Fila inferior (sin esquinas ya contadas)
    ],
  },

  // Letra L
  // #....
  // #....
  // #....
  // #....
  // #####
  letterL: {
    name: 'Letra L',
    description: 'Forma la letra L en el cartón',
    positions: [
      [0,0],[0,1],[0,2],[0,3],[0,4], // Columna B completa
      [1,4],[2,4],[3,4],[4,4],       // Fila inferior (sin esquina ya contada)
    ],
  },

  // Letra T
  // #####
  // ..#..
  // ..#..
  // ..#..
  // ..#..
  letterT: {
    name: 'Letra T',
    description: 'Forma la letra T en el cartón',
    positions: [
      [0,0],[1,0],[2,0],[3,0],[4,0], // Fila superior completa
      [2,1],[2,3],[2,4],             // Columna N (sin fila 0 ya contada, y [2,2] es FREE)
    ],
  },

  // Letra R (P + pierna diagonal)
  // ####.
  // #..#.
  // ####.
  // #.#..
  // #..#.
  letterR: {
    name: 'Letra R',
    description: 'Forma la letra R en el cartón',
    positions: [
      [0,0],[1,0],[2,0],[3,0],       // Fila 0: B,I,N,G
      [0,1],[3,1],                   // Fila 1: B, G
      [0,2],[1,2],[3,2],             // Fila 2: B,I,G (N[2,2] es FREE, se cuenta auto)
      [0,3],[2,3],                   // Fila 3: B, N
      [0,4],[3,4],                   // Fila 4: B, G
    ],
  },

  // Letra A
  // .###.
  // #...#
  // #####
  // #...#
  // #...#
  letterA: {
    name: 'Letra A',
    description: 'Forma la letra A en el cartón',
    positions: [
      [1,0],[2,0],[3,0],             // Fila 0: I,N,G (tope de la A)
      [0,1],[4,1],                   // Fila 1: B, O (lados)
      [0,2],[1,2],[3,2],[4,2],       // Fila 2: B,I,G,O (barra del medio, N[2,2] es FREE)
      [0,3],[4,3],                   // Fila 3: B, O (lados)
      [0,4],[4,4],                   // Fila 4: B, O (base)
    ],
  },

  // Cualquier línea (horizontal, vertical o diagonal)
  line: {
    name: 'Línea',
    description: 'Completa cualquier línea (horizontal, vertical o diagonal)',
    // Para 'line' usamos validación especial - cualquier línea completa gana
    positions: null, // null indica validación especial
    isSpecialPattern: true,
  },

  // 4 Esquinas
  corners: {
    name: '4 Esquinas',
    description: 'Marca las 4 esquinas del cartón',
    positions: [
      [0,0], [4,0],  // Esquinas superiores
      [0,4], [4,4],  // Esquinas inferiores
    ],
  },
};

/**
 * SECURITY: Generate cryptographically secure random integer
 * Uses crypto.randomBytes instead of Math.random for unpredictability
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Cryptographically secure random integer
 */
function secureRandomInt(max) {
  // Use rejection sampling to avoid modulo bias
  const bytesNeeded = Math.ceil(Math.log2(max) / 8) || 1;
  const maxValid = Math.floor(256 ** bytesNeeded / max) * max;

  let randomValue;
  do {
    const bytes = crypto.randomBytes(bytesNeeded);
    randomValue = bytes.reduce((acc, byte, i) => acc + byte * (256 ** i), 0);
  } while (randomValue >= maxValid);

  return randomValue % max;
}

/**
 * SECURITY: Fisher-Yates shuffle with cryptographic randomness
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array (in-place)
 */
function secureShuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Generate random numbers for a column using cryptographic randomness
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} count - How many numbers to generate
 * @returns {number[]} Array of cryptographically random numbers
 */
function getRandomNumbers(min, max, count) {
  const available = [];

  // Create array of all available numbers
  for (let i = min; i <= max; i++) {
    available.push(i);
  }

  // SECURITY: Use cryptographic shuffle instead of Math.random
  secureShuffleArray(available);

  return available.slice(0, count);
}

/**
 * SECURITY: Generate integrity hash for a card
 * This hash can be used to verify the card hasn't been tampered with
 * @param {string} cardId - Card ID
 * @param {Object} numbers - Card numbers
 * @param {string} createdAt - Creation timestamp
 * @returns {string} HMAC-SHA256 hash
 */
function generateCardHash(cardId, numbers, createdAt) {
  const secret = config.jwtSecret || process.env.JWT_SECRET || 'ultra-bingo-card-secret';
  const data = JSON.stringify({ cardId, numbers, createdAt });
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * SECURITY: Verify card integrity hash
 * @param {Object} card - Card to verify
 * @returns {boolean} True if card is valid
 */
export function verifyCardIntegrity(card) {
  if (!card || !card.id || !card.numbers || !card.created_at || !card.hash) {
    return false;
  }
  const expectedHash = generateCardHash(card.id, card.numbers, card.created_at);
  return crypto.timingSafeEqual(
    Buffer.from(card.hash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}

/**
 * Generate a unique bingo card with integrity hash
 * @returns {Object} Bingo card object with cryptographic integrity
 */
export function generateBingoCard() {
  const numbers = {};

  for (const column of COLUMNS) {
    const { min, max } = bingoColumns[column];
    const columnNumbers = getRandomNumbers(min, max, 5);

    // For column N, the middle position (index 2) is FREE (represented as 0)
    if (column === 'N') {
      columnNumbers[2] = 0; // 0 represents FREE space
    }

    numbers[column] = columnNumbers;
  }

  const cardId = `card_${uuidv4()}`;
  const createdAt = new Date().toISOString();

  // SECURITY: Generate integrity hash to prevent tampering
  const hash = generateCardHash(cardId, numbers, createdAt);

  return {
    id: cardId,
    numbers,
    created_at: createdAt,
    hash, // Integrity verification hash
  };
}

/**
 * Generate multiple unique bingo cards
 * @param {number} count - Number of cards to generate
 * @returns {Object[]} Array of bingo cards
 */
export function generateMultipleCards(count) {
  const cards = [];
  const cardSignatures = new Set();

  while (cards.length < count) {
    const card = generateBingoCard();
    const signature = getCardSignature(card);

    // Ensure uniqueness
    if (!cardSignatures.has(signature)) {
      cardSignatures.add(signature);
      cards.push(card);
    }
  }

  return cards;
}

/**
 * Create a signature string for a card (for uniqueness checking)
 * @param {Object} card - Bingo card
 * @returns {string} Signature string
 */
function getCardSignature(card) {
  return COLUMNS.map(col =>
    card.numbers[col].filter(n => n !== 0).join(',')
  ).join('|');
}

/**
 * Get the pattern info for a game mode
 * @param {string} gameMode - Game mode key
 * @returns {Object} Pattern info with name, description, positions
 */
export function getPatternInfo(gameMode) {
  return GAME_PATTERNS[gameMode] || GAME_PATTERNS.fullCard;
}

/**
 * Get all available game patterns
 * @returns {Object} All patterns with their info
 */
export function getAllPatterns() {
  return GAME_PATTERNS;
}

/**
 * Create marked grid from card and called numbers
 * @param {Object} card - Bingo card
 * @param {number[]} calledNumbers - Array of called numbers
 * @returns {boolean[][]} 5x5 grid of marked positions
 */
function createMarkedGrid(card, calledNumbers) {
  const calledSet = new Set(calledNumbers);
  // marked[column][row] = true if that position is marked
  return COLUMNS.map(col =>
    card.numbers[col].map(num => num === 0 || calledSet.has(num))
  );
}

/**
 * Check if a card wins with a LINE pattern (any horizontal, vertical, or diagonal)
 * @param {boolean[][]} marked - 5x5 marked grid
 * @returns {Object} Result with isWinner and pattern details
 */
function checkLineWinner(marked) {
  // Check rows
  for (let row = 0; row < 5; row++) {
    if (marked.every(col => col[row])) {
      return { isWinner: true, pattern: 'row', index: row };
    }
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    if (marked[col].every(cell => cell)) {
      return { isWinner: true, pattern: 'column', index: col };
    }
  }

  // Check diagonals
  const diagonal1 = [0, 1, 2, 3, 4].every(i => marked[i][i]);
  if (diagonal1) {
    return { isWinner: true, pattern: 'diagonal', index: 0 };
  }

  const diagonal2 = [0, 1, 2, 3, 4].every(i => marked[i][4 - i]);
  if (diagonal2) {
    return { isWinner: true, pattern: 'diagonal', index: 1 };
  }

  return { isWinner: false };
}

/**
 * Check if a card wins with a specific pattern
 * @param {boolean[][]} marked - 5x5 marked grid
 * @param {Array} positions - Required positions [[col,row], ...]
 * @returns {boolean} True if all positions are marked
 */
function checkPatternPositions(marked, positions) {
  return positions.every(([col, row]) => {
    // [2,2] is FREE space, always marked
    if (col === 2 && row === 2) return true;
    return marked[col][row];
  });
}

/**
 * Calculate pattern progress (how many positions completed)
 * @param {Object} card - Bingo card
 * @param {number[]} calledNumbers - Array of called numbers
 * @param {string} gameMode - Game mode key
 * @returns {Object} Progress info with completed, total, percentage
 */
export function getPatternProgress(card, calledNumbers, gameMode) {
  const pattern = GAME_PATTERNS[gameMode];
  if (!pattern || !pattern.positions) {
    // For 'line' pattern, return best line progress
    const marked = createMarkedGrid(card, calledNumbers);
    let bestProgress = 0;

    // Check all possible lines
    // Rows
    for (let row = 0; row < 5; row++) {
      const count = marked.filter(col => col[row]).length;
      bestProgress = Math.max(bestProgress, count);
    }
    // Columns
    for (let col = 0; col < 5; col++) {
      const count = marked[col].filter(cell => cell).length;
      bestProgress = Math.max(bestProgress, count);
    }
    // Diagonals
    const diag1 = [0, 1, 2, 3, 4].filter(i => marked[i][i]).length;
    const diag2 = [0, 1, 2, 3, 4].filter(i => marked[i][4 - i]).length;
    bestProgress = Math.max(bestProgress, diag1, diag2);

    return {
      completed: bestProgress,
      total: 5,
      percentage: Math.round((bestProgress / 5) * 100),
    };
  }

  const marked = createMarkedGrid(card, calledNumbers);
  let completed = 0;

  for (const [col, row] of pattern.positions) {
    // [2,2] is FREE, always counts
    if ((col === 2 && row === 2) || marked[col][row]) {
      completed++;
    }
  }

  return {
    completed,
    total: pattern.positions.length,
    percentage: Math.round((completed / pattern.positions.length) * 100),
  };
}

/**
 * Check if a card has a winning pattern based on game mode
 * @param {Object} card - Bingo card
 * @param {number[]} calledNumbers - Array of called numbers
 * @param {string} gameMode - Game mode (default: 'line' for backward compatibility)
 * @returns {Object} Result with isWinner, pattern, and mode
 */
export function checkWinner(card, calledNumbers, gameMode = 'line') {
  const calledSet = new Set(calledNumbers);

  // Create a 5x5 grid of marked positions (0 = FREE space, always marked)
  const marked = createMarkedGrid(card, calledNumbers);

  // Get the pattern for this game mode
  const pattern = GAME_PATTERNS[gameMode];

  if (!pattern) {
    // Unknown mode, default to line check
    return checkLineWinner(marked);
  }

  // Special pattern: 'line' - check any line
  if (pattern.isSpecialPattern && gameMode === 'line') {
    const result = checkLineWinner(marked);
    if (result.isWinner) {
      return { ...result, mode: 'line', modeName: pattern.name };
    }
    return { isWinner: false, mode: 'line' };
  }

  // Check specific pattern positions
  if (pattern.positions) {
    const isWinner = checkPatternPositions(marked, pattern.positions);
    if (isWinner) {
      return {
        isWinner: true,
        pattern: gameMode,
        mode: gameMode,
        modeName: pattern.name,
      };
    }
  }

  return { isWinner: false, mode: gameMode };
}

/**
 * Check for "full card" bingo (all numbers marked)
 * @param {Object} card - Bingo card
 * @param {number[]} calledNumbers - Array of called numbers
 * @returns {boolean} True if full card
 */
export function checkFullCard(card, calledNumbers) {
  const calledSet = new Set(calledNumbers);

  for (const col of COLUMNS) {
    for (const num of card.numbers[col]) {
      if (num !== 0 && !calledSet.has(num)) {
        return false;
      }
    }
  }

  return true;
}

export default {
  generateBingoCard,
  generateMultipleCards,
  checkWinner,
  checkFullCard,
  verifyCardIntegrity,
  getPatternInfo,
  getAllPatterns,
  getPatternProgress,
  GAME_PATTERNS,
};

export { GAME_PATTERNS };
