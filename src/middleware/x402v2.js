/**
 * x402 Payment Middleware for UltravioletaDAO Facilitator
 *
 * Compatible con uvd-x402-sdk (formato v1)
 * - network: "avalanche" (nombre de chain)
 * - x402Version: 1
 */

import { config } from '../config/index.js';

// USDC contract addresses por red
const USDC_ADDRESSES = {
  'avalanche': '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

/**
 * Crear middleware de pago x402
 */
export function createX402Middleware(routeConfigs) {
  return async (req, res, next) => {
    // Construir el pattern de la ruta
    const routePattern = `${req.method} ${req.path}`;

    // Verificar si esta ruta requiere pago
    const routeConfig = routeConfigs[routePattern];
    if (!routeConfig) {
      return next();
    }

    // Buscar header de pago (X-PAYMENT para v1)
    const paymentHeader = req.headers['x-payment'] ||
                          req.headers['payment-signature'];

    if (!paymentHeader) {
      // No hay pago - responder con 402 y requerimientos
      return sendPaymentRequired(req, res, routeConfig);
    }

    // Verificar el pago con el facilitador
    try {
      const paymentResult = await verifyPayment(paymentHeader, routeConfig, req);

      if (!paymentResult.valid) {
        // Log only error type, not details
        if (config.nodeEnv !== 'production') {
          console.log('[x402] Payment verification failed');
        }
        return res.status(402).json({
          x402Version: 1,
          error: 'Payment verification failed',
          message: paymentResult.error || 'Invalid payment signature',
        });
      }

      // Pago verificado - continuar con la request
      req.x402Payment = paymentResult;
      next();
    } catch (error) {
      console.error('[x402] Payment processing error');
      res.status(500).json({
        error: 'Payment processing error',
      });
    }
  };
}

/**
 * Enviar respuesta 402 Payment Required (formato v1)
 */
function sendPaymentRequired(req, res, routeConfig) {
  const network = config.x402.network; // "avalanche"
  const usdcAddress = USDC_ADDRESSES[network] || USDC_ADDRESSES['avalanche'];

  // Calcular precio basado en el body de la request
  let price = routeConfig.price || config.cardPrice;
  let cardCount = 1;

  // Calcular cantidad de cartones (quantity o cardIds)
  if (req.body?.quantity && typeof req.body.quantity === 'number') {
    cardCount = Math.min(req.body.quantity, config.maxCardsPerPurchase);
    price = cardCount * config.cardPrice;
  } else if (req.body?.cardIds && Array.isArray(req.body.cardIds)) {
    cardCount = req.body.cardIds.length;
    price = cardCount * config.cardPrice;
  }

  // Convertir precio a unidades atómicas de USDC (6 decimales)
  const priceInAtomicUnits = Math.round(price * 1_000_000).toString();

  // Formato v1 compatible con uvd-x402-sdk
  const paymentInfo = {
    x402Version: 1,
    scheme: 'exact',
    network: network,
    receiver: config.x402.receiverAddress,
    amount: priceInAtomicUnits,
    asset: usdcAddress,
    description: `Purchase of ${cardCount} bingo card(s)`,
    resource: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    extra: {
      name: 'USD Coin',
      version: '2',
    },
  };

  res.status(402)
    .set('X-PAYMENT-REQUIRED', Buffer.from(JSON.stringify(paymentInfo)).toString('base64'))
    .set('Access-Control-Expose-Headers', 'X-PAYMENT-REQUIRED, Payment-Required')
    .json({
      x402Version: 1,
      paymentInfo: paymentInfo,
    });
}

/**
 * Verificar pago con el facilitador de UltravioletaDAO
 * El facilitador espera: { paymentPayload, paymentRequirements }
 */
async function verifyPayment(paymentHeader, routeConfig, req) {
  const facilitatorUrl = config.x402.facilitatorUrl.replace(/\/$/, '');
  const network = config.x402.network;
  const usdcAddress = USDC_ADDRESSES[network] || USDC_ADDRESSES['avalanche'];

  try {
    // Decodificar el payload de pago (viene de uvd-x402-sdk)
    let paymentPayload;
    try {
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
      paymentPayload = JSON.parse(decoded);
    } catch (e) {
      return { valid: false, error: 'Invalid payment header encoding' };
    }

    // Calcular el monto requerido (quantity o cardIds)
    let cardCount = 1;
    if (req?.body?.quantity && typeof req.body.quantity === 'number') {
      cardCount = Math.min(req.body.quantity, config.maxCardsPerPurchase);
    } else if (req?.body?.cardIds && Array.isArray(req.body.cardIds)) {
      cardCount = req.body.cardIds.length;
    }
    const price = cardCount * config.cardPrice;
    const maxAmountRequired = Math.round(price * 1_000_000).toString();

    // Construir paymentRequirements según la especificación x402
    const paymentRequirements = {
      scheme: 'exact',
      network: network,
      maxAmountRequired: maxAmountRequired,
      resource: req ? `${req.protocol}://${req.get('host')}${req.originalUrl}` : 'bingo-card-purchase',
      description: `Purchase of ${cardCount} bingo card(s)`,
      mimeType: 'application/json',
      payTo: config.x402.receiverAddress,
      maxTimeoutSeconds: 60,
      asset: usdcAddress,
      extra: {
        name: 'USD Coin',
        version: '2',
      },
    };

    // Formato correcto para el facilitador v1:
    // { x402Version, paymentPayload, paymentRequirements }
    const verifyBody = {
      x402Version: 1,
      paymentPayload: paymentPayload,
      paymentRequirements: paymentRequirements,
    };

    const verifyResponse = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyBody),
    });

    const verifyText = await verifyResponse.text();

    if (!verifyResponse.ok) {
      return { valid: false, error: `Verification failed: ${verifyText}` };
    }

    let verifyResult;
    try {
      verifyResult = JSON.parse(verifyText);
    } catch (e) {
      verifyResult = { raw: verifyText };
    }

    if (verifyResult.isValid === false || verifyResult.valid === false) {
      return { valid: false, error: verifyResult.invalidReason || verifyResult.reason || 'Payment invalid' };
    }

    // Settle el pago (mismo formato)
    const settleResponse = await fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyBody),
    });

    const settleText = await settleResponse.text();

    if (!settleResponse.ok) {
      // Settlement is the actual blockchain transaction - without it, no payment occurred
      return {
        valid: false,
        error: 'Payment settlement failed. Transaction was not executed on blockchain.',
        settled: false,
        verifyResult,
      };
    }

    let settleResult;
    try {
      settleResult = JSON.parse(settleText);
    } catch (e) {
      settleResult = { raw: settleText };
    }

    return {
      valid: true,
      settled: true,
      verifyResult,
      settleResult,
      transaction: settleResult.transaction || settleResult.txHash,
    };
  } catch (error) {
    return { valid: false, error: 'Payment verification error' };
  }
}

export default { createX402Middleware };
