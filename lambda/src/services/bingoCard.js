/**
 * Ultra Bingo - Bingo Card Service
 * Card generation and winner validation
 */

import crypto from 'crypto';

// Bingo column ranges
const BINGO_COLUMNS = {
  B: { min: 1, max: 15 },
  I: { min: 16, max: 30 },
  N: { min: 31, max: 45 },
  G: { min: 46, max: 60 },
  O: { min: 61, max: 75 },
};

// Game modes and their winning patterns
// Pattern positions: [column_index, row_index] where columns are B=0, I=1, N=2, G=3, O=4
const GAME_PATTERNS = {
  fullCard: {
    name: 'Cartón Completo',
    description: 'Marca todas las casillas del cartón',
    positions: [
      // All 25 positions except center (which is FREE)
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], // B column
      [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], // I column
      [2, 0], [2, 1], [2, 3], [2, 4],         // N column (skip center FREE)
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], // G column
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], // O column
    ],
    isSpecialPattern: false,
  },
  letterU: {
    name: 'Letra U',
    description: 'Forma la letra U en el cartón',
    positions: [
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], // Left column (B)
      [1, 4], [2, 4], [3, 4],                  // Bottom row middle
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], // Right column (O)
    ],
    isSpecialPattern: true,
  },
  letterL: {
    name: 'Letra L',
    description: 'Forma la letra L en el cartón',
    positions: [
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], // Left column (B)
      [1, 4], [2, 4], [3, 4], [4, 4],         // Bottom row
    ],
    isSpecialPattern: true,
  },
  letterT: {
    name: 'Letra T',
    description: 'Forma la letra T en el cartón',
    positions: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], // Top row
      [2, 1], [2, 2], [2, 3], [2, 4],         // Middle column (N) excluding top
    ],
    isSpecialPattern: true,
  },
  letterR: {
    name: 'Letra R',
    description: 'Forma la letra R en el cartón',
    positions: [
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], // Left column (B)
      [1, 0], [2, 0], [3, 0],                  // Top row partial
      [1, 2], [2, 2],                          // Middle row partial
      [3, 3], [4, 4],                          // Diagonal leg
    ],
    isSpecialPattern: true,
  },
  letterA: {
    name: 'Letra A',
    description: 'Forma la letra A en el cartón',
    positions: [
      [0, 1], [0, 2], [0, 3], [0, 4],         // Left leg
      [1, 0], [2, 0],                          // Top
      [1, 2], [2, 2], [3, 2],                  // Middle bar
      [4, 1], [4, 2], [4, 3], [4, 4],         // Right leg
    ],
    isSpecialPattern: true,
  },
  line: {
    name: 'Línea',
    description: 'Completa cualquier línea (horizontal, vertical o diagonal)',
    positions: [], // Special handling - any line counts
    isSpecialPattern: true,
    isLinePattern: true,
  },
  corners: {
    name: 'Cuatro Esquinas',
    description: 'Marca las cuatro esquinas del cartón',
    positions: [
      [0, 0], [4, 0], // Top corners
      [0, 4], [4, 4], // Bottom corners
    ],
    isSpecialPattern: true,
  },
};

/**
 * Generate cryptographically secure random numbers for a column
 */
function generateColumnNumbers(min, max, count = 5) {
  const range = max - min + 1;
  const numbers = [];
  const used = new Set();

  while (numbers.length < count) {
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0);
    const number = min + (randomValue % range);

    if (!used.has(number)) {
      used.add(number);
      numbers.push(number);
    }
  }

  return numbers;
}

/**
 * Generate a single bingo card with cryptographic security
 */
export function generateBingoCard() {
  const cardId = `card_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  const numbers = {
    B: generateColumnNumbers(1, 15),
    I: generateColumnNumbers(16, 30),
    N: generateColumnNumbers(31, 45),
    G: generateColumnNumbers(46, 60),
    O: generateColumnNumbers(61, 75),
  };

  // Center position (N column, row 2) is FREE space (represented as 0)
  numbers.N[2] = 0;

  // Generate integrity hash
  const dataToHash = `${cardId}|${JSON.stringify(numbers)}|${createdAt}`;
  const hash = crypto.createHmac('sha256', process.env.JWT_SECRET || 'default-secret')
    .update(dataToHash)
    .digest('hex');

  return {
    cardId,
    numbers,
    createdAt,
    hash,
  };
}

/**
 * Generate multiple unique bingo cards
 */
export function generateMultipleCards(count) {
  const cards = [];
  const signatures = new Set();

  while (cards.length < count) {
    const card = generateBingoCard();

    // Create signature to ensure uniqueness
    const signature = Object.values(card.numbers)
      .map(col => col.join(','))
      .join('|');

    if (!signatures.has(signature)) {
      signatures.add(signature);
      cards.push(card);
    }
  }

  return cards;
}

/**
 * Check if a card is a winner based on game mode and called numbers
 */
export function checkWinner(card, calledNumbers, gameMode = 'line') {
  const columns = ['B', 'I', 'N', 'G', 'O'];
  const calledSet = new Set(calledNumbers);

  // Create marked grid
  // marked[colIndex][rowIndex] = true if number is called or FREE
  const marked = columns.map((col, colIndex) =>
    card.numbers[col].map((num, rowIndex) => {
      // FREE space (center of N column) is always marked
      if (colIndex === 2 && rowIndex === 2) return true;
      return calledSet.has(num);
    })
  );

  const pattern = GAME_PATTERNS[gameMode];
  if (!pattern) {
    return { isWinner: false, pattern: null, mode: gameMode, modeName: 'Unknown' };
  }

  // Special handling for line pattern
  if (pattern.isLinePattern) {
    return checkLineWinner(marked, gameMode);
  }

  // Check if all required positions are marked
  const isWinner = pattern.positions.every(([col, row]) => marked[col][row]);

  return {
    isWinner,
    pattern: gameMode,
    mode: gameMode,
    modeName: pattern.name,
  };
}

/**
 * Check for any winning line (horizontal, vertical, or diagonal)
 */
function checkLineWinner(marked, gameMode) {
  // Check horizontal lines (rows)
  for (let row = 0; row < 5; row++) {
    if (marked.every(col => col[row])) {
      return {
        isWinner: true,
        pattern: 'row',
        mode: gameMode,
        modeName: 'Línea Horizontal',
      };
    }
  }

  // Check vertical lines (columns)
  for (let col = 0; col < 5; col++) {
    if (marked[col].every(cell => cell)) {
      return {
        isWinner: true,
        pattern: 'column',
        mode: gameMode,
        modeName: 'Línea Vertical',
      };
    }
  }

  // Check main diagonal (top-left to bottom-right)
  if ([0, 1, 2, 3, 4].every(i => marked[i][i])) {
    return {
      isWinner: true,
      pattern: 'diagonal',
      mode: gameMode,
      modeName: 'Diagonal Principal',
    };
  }

  // Check anti-diagonal (top-right to bottom-left)
  if ([0, 1, 2, 3, 4].every(i => marked[4 - i][i])) {
    return {
      isWinner: true,
      pattern: 'diagonal',
      mode: gameMode,
      modeName: 'Diagonal Inversa',
    };
  }

  return {
    isWinner: false,
    pattern: null,
    mode: gameMode,
    modeName: 'Línea',
  };
}

/**
 * Calculate progress for a card based on current pattern
 */
export function calculateProgress(card, calledNumbers, gameMode = 'fullCard') {
  const columns = ['B', 'I', 'N', 'G', 'O'];
  const calledSet = new Set(calledNumbers);
  const pattern = GAME_PATTERNS[gameMode];

  if (!pattern) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  // For line patterns, calculate best line progress
  if (pattern.isLinePattern) {
    return calculateBestLineProgress(card, calledNumbers);
  }

  let completed = 0;
  const total = pattern.positions.length;

  for (const [colIndex, rowIndex] of pattern.positions) {
    const col = columns[colIndex];
    const num = card.numbers[col][rowIndex];

    // FREE space or called number
    if ((colIndex === 2 && rowIndex === 2) || calledSet.has(num)) {
      completed++;
    }
  }

  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}

/**
 * Calculate progress for best line
 */
function calculateBestLineProgress(card, calledNumbers) {
  const columns = ['B', 'I', 'N', 'G', 'O'];
  const calledSet = new Set(calledNumbers);
  let bestProgress = { completed: 0, total: 5, percentage: 0 };

  // Check all possible lines
  const checkLine = (positions) => {
    let completed = 0;
    for (const [colIndex, rowIndex] of positions) {
      const col = columns[colIndex];
      const num = card.numbers[col][rowIndex];
      if ((colIndex === 2 && rowIndex === 2) || calledSet.has(num)) {
        completed++;
      }
    }
    if (completed > bestProgress.completed) {
      bestProgress = { completed, total: 5, percentage: Math.round((completed / 5) * 100) };
    }
  };

  // Rows
  for (let row = 0; row < 5; row++) {
    checkLine([[0, row], [1, row], [2, row], [3, row], [4, row]]);
  }

  // Columns
  for (let col = 0; col < 5; col++) {
    checkLine([[col, 0], [col, 1], [col, 2], [col, 3], [col, 4]]);
  }

  // Diagonals
  checkLine([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]);
  checkLine([[4, 0], [3, 1], [2, 2], [1, 3], [0, 4]]);

  return bestProgress;
}

/**
 * Verify card integrity using hash
 */
export function verifyCardIntegrity(card) {
  if (!card.hash || !card.cardId || !card.numbers || !card.createdAt) {
    return false;
  }

  const dataToHash = `${card.cardId}|${JSON.stringify(card.numbers)}|${card.createdAt}`;
  const expectedHash = crypto.createHmac('sha256', process.env.JWT_SECRET || 'default-secret')
    .update(dataToHash)
    .digest('hex');

  return card.hash === expectedHash;
}

/**
 * Get pattern info for a game mode
 */
export function getPatternInfo(gameMode) {
  return GAME_PATTERNS[gameMode] || null;
}

/**
 * Get all available game modes
 */
export function getAllGameModes() {
  return Object.entries(GAME_PATTERNS).map(([key, value]) => ({
    key,
    ...value,
  }));
}

export default {
  generateBingoCard,
  generateMultipleCards,
  checkWinner,
  calculateProgress,
  verifyCardIntegrity,
  getPatternInfo,
  getAllGameModes,
  GAME_PATTERNS,
  BINGO_COLUMNS,
};
