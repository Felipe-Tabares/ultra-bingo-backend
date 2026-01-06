/**
 * Ultra Bingo - x402 Payment Middleware for Lambda
 * Validates x402 payments via UltravioletaDAO Facilitator
 */

// USDC contract addresses by network
const USDC_ADDRESSES = {
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

// Configuration from environment
const config = {
  facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://facilitator.ultravioletadao.xyz',
  network: process.env.X402_NETWORK || 'avalanche',
  receiverAddress: process.env.X402_RECEIVER_ADDRESS,
  cardPrice: parseFloat(process.env.CARD_PRICE) || 5,
};

/**
 * Calculate price in atomic USDC units (6 decimals)
 */
export function calculateAtomicPrice(quantity) {
  return Math.round(quantity * config.cardPrice * 1_000_000).toString();
}

/**
 * Create payment requirements object
 */
export function createPaymentRequirements(quantity, resource) {
  const amount = calculateAtomicPrice(quantity);

  return {
    x402Version: 1,
    scheme: 'exact',
    network: config.network,
    maxAmountRequired: amount,
    resource: resource,
    description: `Purchase of ${quantity} bingo card(s)`,
    mimeType: 'application/json',
    payTo: config.receiverAddress,
    maxTimeoutSeconds: 60,
    asset: USDC_ADDRESSES[config.network],
    extra: {
      name: 'USD Coin',
      version: '2',
    },
  };
}

/**
 * Create 402 Payment Required response
 */
export function create402Response(quantity, resource, origin = '*') {
  const paymentInfo = {
    x402Version: 1,
    scheme: 'exact',
    network: config.network,
    receiver: config.receiverAddress,
    amount: calculateAtomicPrice(quantity),
    asset: USDC_ADDRESSES[config.network],
    description: `Purchase of ${quantity} bingo card(s)`,
    resource: resource,
    extra: {
      name: 'USD Coin',
      version: '2',
    },
  };

  const encodedPaymentInfo = Buffer.from(JSON.stringify(paymentInfo)).toString('base64');

  return {
    statusCode: 402,
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT-REQUIRED': encodedPaymentInfo,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PAYMENT, x-payment',
      'Access-Control-Expose-Headers': 'X-PAYMENT-REQUIRED, Payment-Required',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify({
      x402Version: 1,
      paymentInfo,
    }),
  };
}

/**
 * Parse x402 payment header from request
 */
export function parsePaymentHeader(headers) {
  console.log('[x402] Headers recibidos:', JSON.stringify(Object.keys(headers)));

  // API Gateway HTTP API v2 normalizes headers to lowercase
  const paymentHeader = headers['x-payment'] ||
                        headers['X-Payment'] ||
                        headers['X-PAYMENT'] ||
                        headers['payment'];

  console.log('[x402] Header x-payment encontrado:', paymentHeader ? 'SI (longitud: ' + paymentHeader.length + ')' : 'NO');

  if (!paymentHeader) {
    console.log('[x402] No se encontró header de pago');
    return null;
  }

  try {
    const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
    console.log('[x402] Header decodificado exitosamente');
    const parsed = JSON.parse(decoded);
    console.log('[x402] Payload parseado:', JSON.stringify(parsed).substring(0, 200) + '...');
    return parsed;
  } catch (error) {
    console.error('[x402] Error parsing payment header:', error);
    return null;
  }
}

/**
 * Verify payment with facilitator
 */
async function verifyPayment(paymentPayload, paymentRequirements) {
  console.log('[x402] Verificando pago con facilitator:', config.facilitatorUrl);
  console.log('[x402] Payment payload:', JSON.stringify(paymentPayload, null, 2));
  console.log('[x402] Payment requirements:', JSON.stringify(paymentRequirements, null, 2));

  const response = await fetch(`${config.facilitatorUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      x402Version: 1,
      paymentPayload,
      paymentRequirements,
    }),
  });

  const responseText = await response.text();
  console.log('[x402] Verify response status:', response.status);
  console.log('[x402] Verify response body:', responseText);

  if (!response.ok) {
    throw new Error(`Verification failed (${response.status}): ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return { valid: true, raw: responseText };
  }
}

/**
 * Settle payment with facilitator
 */
async function settlePayment(paymentPayload, paymentRequirements) {
  console.log('[x402] Liquidando pago con facilitator...');

  const response = await fetch(`${config.facilitatorUrl}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      x402Version: 1,
      paymentPayload,
      paymentRequirements,
    }),
  });

  const responseText = await response.text();
  console.log('[x402] Settle response status:', response.status);
  console.log('[x402] Settle response body:', responseText);

  if (!response.ok) {
    throw new Error(`Settlement failed (${response.status}): ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return { success: true, raw: responseText };
  }
}

/**
 * Validate x402 payment for a request
 * Returns payment info if valid, or 402 response if invalid/missing
 */
export async function validatePayment(event, quantity) {
  const headers = event.headers || {};
  const resource = `https://${event.requestContext?.domainName}${event.rawPath || event.path}`;
  const origin = headers.origin || headers.Origin || '*';

  // Parse payment header
  const paymentPayload = parsePaymentHeader(headers);

  // No payment header - return 402 response
  if (!paymentPayload) {
    console.log('[x402] No hay header de pago, devolviendo 402');
    return {
      valid: false,
      response: create402Response(quantity, resource, origin),
    };
  }

  // Create payment requirements
  const paymentRequirements = createPaymentRequirements(quantity, resource);

  try {
    // Verify payment
    const verifyResult = await verifyPayment(paymentPayload, paymentRequirements);

    // Facilitator returns isValid (not valid)
    const isVerified = verifyResult.valid || verifyResult.isValid;
    if (!isVerified) {
      console.error('[x402] Payment verification failed:', verifyResult);
      return {
        valid: false,
        response: create402Response(quantity, resource, origin),
        error: 'Payment verification failed',
      };
    }
    console.log('[x402] Verificación exitosa, payer:', verifyResult.payer);

    // Settle payment
    const settleResult = await settlePayment(paymentPayload, paymentRequirements);

    if (!settleResult.success && !settleResult.settled) {
      console.error('[x402] Payment settlement failed:', settleResult);
      return {
        valid: false,
        response: {
          statusCode: 402,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
          },
          body: JSON.stringify({
            error: 'Payment settlement failed',
            details: settleResult,
          }),
        },
        error: 'Payment settlement failed',
      };
    }

    // Extract transaction hash
    const txHash = settleResult.transaction ||
                   settleResult.txHash ||
                   settleResult.transactionHash ||
                   paymentPayload.transaction ||
                   paymentPayload.txHash;

    return {
      valid: true,
      settled: true,
      transaction: txHash,
      verifyResult,
      settleResult,
    };
  } catch (error) {
    console.error('[x402] Payment processing error:', error.message);
    return {
      valid: false,
      response: {
        statusCode: 402,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({
          error: error.message,
          message: error.message,
          type: 'payment_failed',
        }),
      },
      error: error.message,
    };
  }
}

export default {
  calculateAtomicPrice,
  createPaymentRequirements,
  create402Response,
  parsePaymentHeader,
  validatePayment,
  config,
  USDC_ADDRESSES,
};
