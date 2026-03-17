// This script validates that the configuration correctly defaults to the frontend origin.
// We can't easily import the TypeScript config in this environment, but we can verify the source file's content.
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config/index.ts');
const configContent = fs.readFileSync(configPath, 'utf8');

const serverPath = path.join(__dirname, '../server.ts');
const serverContent = fs.readFileSync(serverPath, 'utf8');

// Test 1: Verify the wildcard '*' is gone from the configuration default
if (configContent.includes('corsOrigin: process.env.CORS_ORIGIN || "*"')) {
    console.error('❌ FAILED: Configuration still uses the wildcard "*" as a default.');
    process.exit(1);
} else {
    console.log('✅ PASSED: Wildcard "*" is no longer the default in config.');
}

// Test 2: Verify the configuration uses a safe default origin
if (configContent.includes('corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000"')) {
    console.log('✅ PASSED: Configuration uses http://localhost:3000 as a safe default.');
} else {
    console.error('❌ FAILED: Configuration does not use a safe default origin.');
    process.exit(1);
}

// Test 3: Verify the server uses the configuration value
if (serverContent.includes('origin: config.corsOrigin')) {
    console.log('✅ PASSED: Server uses config.corsOrigin.');
} else {
    console.error('❌ FAILED: Server does not use config.corsOrigin.');
    process.exit(1);
}

// Test 4: Verify the server no longer has the inline wildcard
if (serverContent.includes('origin: process.env.CORS_ORIGIN || "*"')) {
    console.error('❌ FAILED: Server still contains the inline wildcard default.');
    process.exit(1);
} else {
    console.log('✅ PASSED: Server no longer has the inline wildcard.');
}

console.log('\nAll source code validation checks passed!');
