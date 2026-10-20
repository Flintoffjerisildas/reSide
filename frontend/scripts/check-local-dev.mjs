#!/usr/bin/env node

/**
 * Local Development Environment Verification Script
 * 
 * This script checks that all prerequisites for local development are installed
 * and that project-local dependency directories exist after initialization.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkCommand(command, name) {
  try {
    execSync(`${command} --version`, { stdio: 'pipe' });
    const version = execSync(`${command} --version`, { encoding: 'utf-8' }).trim();
    log(`✓ ${name} is installed: ${version.split('\n')[0]}`, 'green');
    return true;
  } catch (error) {
    log(`✗ ${name} is NOT installed`, 'red');
    return false;
  }
}

function checkDirectory(path, name) {
  const fullPath = resolve(__dirname, path);
  if (existsSync(fullPath)) {
    log(`✓ ${name} exists: ${fullPath}`, 'green');
    return true;
  } else {
    log(`✗ ${name} does NOT exist: ${fullPath}`, 'yellow');
    return false;
  }
}

function printSeparator() {
  log('─'.repeat(70), 'cyan');
}

async function main() {
  log('\n🔍 Checking Local Development Environment\n', 'cyan');
  printSeparator();

  let allChecksPass = true;
  const missingItems = [];

  // Check prerequisites
  log('\n📋 Checking Prerequisites:\n', 'blue');

  if (!checkCommand('dfx', 'DFX (Internet Computer SDK)')) {
    allChecksPass = false;
    missingItems.push({
      name: 'DFX',
      instructions: 'Install DFX:\n  sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"',
    });
  }

  if (!checkCommand('node', 'Node.js')) {
    allChecksPass = false;
    missingItems.push({
      name: 'Node.js',
      instructions: 'Install Node.js from https://nodejs.org/ or use nvm',
    });
  }

  // Check for package manager (prefer pnpm, allow npm)
  let packageManager = null;
  if (checkCommand('pnpm', 'pnpm (package manager)')) {
    packageManager = 'pnpm';
  } else if (checkCommand('npm', 'npm (package manager)')) {
    packageManager = 'npm';
    log('  ℹ pnpm is recommended for this project', 'yellow');
  } else {
    allChecksPass = false;
    missingItems.push({
      name: 'Package Manager',
      instructions: 'Install pnpm:\n  npm install -g pnpm',
    });
  }

  // Check project-local directories
  log('\n📁 Checking Project-Local Directories:\n', 'blue');

  const dfxExists = checkDirectory('../../.dfx', 'DFX local replica data (.dfx)');
  const nodeModulesExists = checkDirectory('../node_modules', 'Frontend dependencies (node_modules)');
  const pnpmStoreExists = checkDirectory('../.pnpm-store', 'pnpm package store (.pnpm-store)');

  if (!dfxExists) {
    log('  ℹ Run "dfx start --background" and "dfx deploy" to create .dfx directory', 'yellow');
  }

  if (!nodeModulesExists || !pnpmStoreExists) {
    log(`  ℹ Run "cd frontend && ${packageManager || 'pnpm'} install" to create dependency directories`, 'yellow');
  }

  // Print summary
  printSeparator();
  log('\n📊 Summary:\n', 'blue');

  if (allChecksPass && dfxExists && nodeModulesExists) {
    log('✓ All checks passed! Your local development environment is ready.', 'green');
    log('\nTo start developing:', 'cyan');
    log('  1. dfx start --background', 'cyan');
    log('  2. dfx deploy', 'cyan');
    log('  3. cd frontend && pnpm run dev', 'cyan');
    process.exit(0);
  } else {
    log('✗ Some checks failed. Please address the issues below:\n', 'red');

    if (missingItems.length > 0) {
      log('Missing Prerequisites:', 'yellow');
      missingItems.forEach((item) => {
        log(`\n${item.name}:`, 'yellow');
        log(`  ${item.instructions}`, 'reset');
      });
    }

    if (!dfxExists || !nodeModulesExists || !pnpmStoreExists) {
      log('\nMissing Project Directories:', 'yellow');
      if (!dfxExists) {
        log('  • Start local replica and deploy canisters:', 'reset');
        log('    dfx start --background', 'reset');
        log('    dfx deploy', 'reset');
      }
      if (!nodeModulesExists || !pnpmStoreExists) {
        log('  • Install frontend dependencies:', 'reset');
        log(`    cd frontend && ${packageManager || 'pnpm'} install`, 'reset');
      }
    }

    log('\nFor more help, see frontend/LOCAL_DEV.md', 'cyan');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Error running verification script: ${error.message}`, 'red');
  process.exit(1);
});
