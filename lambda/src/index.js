/**
 * Ultra Bingo - Lambda Entry Points
 * Exports all handlers for AWS Lambda
 */

// REST API Handler
export { handler as apiHandler } from './handlers/api.js';

// WebSocket Handlers
export { handler as wsConnectHandler } from './handlers/wsConnect.js';
export { handler as wsDisconnectHandler } from './handlers/wsDisconnect.js';
export { handler as wsMessageHandler } from './handlers/wsMessage.js';

// DynamoDB Stream Processor
export { handler as streamProcessorHandler } from './handlers/streamProcessor.js';

// Default export for convenience
export default {
  apiHandler: async (event, context) => {
    const { handler } = await import('./handlers/api.js');
    return handler(event, context);
  },
  wsConnectHandler: async (event, context) => {
    const { handler } = await import('./handlers/wsConnect.js');
    return handler(event, context);
  },
  wsDisconnectHandler: async (event, context) => {
    const { handler } = await import('./handlers/wsDisconnect.js');
    return handler(event, context);
  },
  wsMessageHandler: async (event, context) => {
    const { handler } = await import('./handlers/wsMessage.js');
    return handler(event, context);
  },
  streamProcessorHandler: async (event, context) => {
    const { handler } = await import('./handlers/streamProcessor.js');
    return handler(event, context);
  },
};
