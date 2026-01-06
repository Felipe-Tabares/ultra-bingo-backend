/**
 * Ultra Bingo - Lambda Deployment Script
 * Deploys all Lambda functions to AWS
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const zipFile = join(rootDir, 'function.zip');

// Configuration
const PROJECT_NAME = process.env.PROJECT_NAME || 'ultra-bingo';
const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const FUNCTIONS = {
  api: `${PROJECT_NAME}-${ENVIRONMENT}-api`,
  wsConnect: `${PROJECT_NAME}-${ENVIRONMENT}-ws-connect`,
  wsDisconnect: `${PROJECT_NAME}-${ENVIRONMENT}-ws-disconnect`,
  wsMessage: `${PROJECT_NAME}-${ENVIRONMENT}-ws-message`,
  streamProcessor: `${PROJECT_NAME}-${ENVIRONMENT}-stream-processor`,
};

// Check if zip exists
if (!existsSync(zipFile)) {
  console.error('Error: function.zip not found. Run "npm run package" first.');
  process.exit(1);
}

console.log('Deploying Lambda functions...\n');

// Deploy each function
for (const [name, functionName] of Object.entries(FUNCTIONS)) {
  console.log(`Deploying ${name} -> ${functionName}...`);

  try {
    execSync(
      `aws lambda update-function-code --function-name ${functionName} --zip-file fileb://${zipFile} --region ${AWS_REGION}`,
      { stdio: 'pipe' }
    );
    console.log(`  ✓ ${functionName} deployed successfully`);
  } catch (error) {
    console.error(`  ✗ Failed to deploy ${functionName}`);
    console.error(`    ${error.message}`);
  }
}

console.log('\nDeployment complete!');

// Print function URLs
console.log('\nFunction ARNs:');
for (const [name, functionName] of Object.entries(FUNCTIONS)) {
  console.log(`  ${name}: arn:aws:lambda:${AWS_REGION}:*:function:${functionName}`);
}
