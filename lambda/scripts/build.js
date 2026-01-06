/**
 * Ultra Bingo - Lambda Build Script
 * Bundles all handlers for deployment using esbuild
 */

import * as esbuild from 'esbuild';
import { rmSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

// Clean and create dist directory
console.log('Cleaning dist directory...');
try {
  rmSync(distDir, { recursive: true, force: true });
} catch (e) {}
mkdirSync(distDir, { recursive: true });

// Handler entry points
const handlers = [
  { entry: 'src/handlers/api.js', outfile: 'api.js' },
  { entry: 'src/handlers/wsConnect.js', outfile: 'wsConnect.js' },
  { entry: 'src/handlers/wsDisconnect.js', outfile: 'wsDisconnect.js' },
  { entry: 'src/handlers/wsMessage.js', outfile: 'wsMessage.js' },
  { entry: 'src/handlers/streamProcessor.js', outfile: 'streamProcessor.js' },
];

// Build each handler
console.log('Building handlers...');

for (const { entry, outfile } of handlers) {
  console.log(`  Building ${entry}...`);

  await esbuild.build({
    entryPoints: [join(rootDir, entry)],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: join(distDir, outfile),
    external: [
      '@aws-sdk/client-dynamodb',
      '@aws-sdk/lib-dynamodb',
      '@aws-sdk/client-apigatewaymanagementapi',
    ],
    minify: true,
    sourcemap: false,
    banner: {
      js: `
        import { createRequire } from 'module';
        const require = createRequire(import.meta.url);
      `.trim(),
    },
  });
}

// Create package.json for Lambda runtime
const lambdaPackageJson = {
  type: 'module',
  dependencies: {},
};

import { writeFileSync } from 'fs';
writeFileSync(
  join(distDir, 'package.json'),
  JSON.stringify(lambdaPackageJson, null, 2)
);

console.log('Build complete!');
console.log(`Output: ${distDir}`);
