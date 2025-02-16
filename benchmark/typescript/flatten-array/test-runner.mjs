#!/usr/bin/env node

/**
 * 👋🏽 Hello there reader,
 *
 * It looks like you are working on this solution using the Exercism CLI and
 * not the online editor. That's great! The file you are looking at executes
 * the various steps the online test-runner also takes.
 *
 * @see https://github.com/exercism/typescript-test-runner
 *
 * TypeScript track exercises generally consist of at least two out of three
 * types of tests to run.
 *
 * 1. tsc, the TypeScript compiler. This tests if the TypeScript code is valid
 * 2. tstyche, static analysis tests to see if the types used are expected
 * 3. jest, runtime implementation tests to see if the solution is correct
 *
 * If one of these three fails, this script terminates with -1, -2, or -3
 * respectively. If it succeeds, it terminates with exit code 0.
 *
 * @note you need corepack (bundled with node LTS) enabled in order for this
 *    test runner to work as expected. Follow the installation and test
 *    instructions if you see errors about corepack or pnp.
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { exit } from 'node:process'
import { URL } from 'node:url'

/**
 * Before executing any tests, the test runner attempts to find the
 * exercise config.json file which has metadata about which types of tests
 * to run for this solution.
 */
const metaDirectory = new URL('./.meta/', import.meta.url)
const exercismDirectory = new URL('./.exercism/', import.meta.url)
const configDirectory = existsSync(metaDirectory)
  ? metaDirectory
  : existsSync(exercismDirectory)
    ? exercismDirectory
    : null

if (configDirectory === null) {
  throw new Error(
    'Expected .meta or .exercism directory to exist, but I cannot find it.'
  )
}

const configFile = new URL('./config.json', configDirectory)
if (!existsSync(configFile)) {
  throw new Error('Expected config.json to exist at ' + configFile.toString())
}

// Experimental: import config from './config.json' with { type: 'json' }
/** @type {import('./config.json') } */
const config = JSON.parse(readFileSync(configFile))

const jest = !config.custom || config.custom['flag.tests.jest']
const tstyche = config.custom?.['flag.tests.tstyche']
console.log(
  `[tests] tsc: ✅, tstyche: ${tstyche ? '✅' : '❌'}, jest: ${jest ? '✅' : '❌'}, `
)

/**
 * 1. tsc: the typescript compiler
 */
try {
  console.log('[tests] tsc (compile)')
  execSync('corepack yarn lint:types', {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
} catch {
  exit(-1)
}

/**
 * 2. tstyche: type tests
 */
if (tstyche) {
  try {
    console.log('[tests] tstyche (type tests)')
    execSync('corepack yarn test:types', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })
  } catch {
    exit(-2)
  }
}

/**
 * 3. jest: implementation tests
 */
if (jest) {
  try {
    console.log('[tests] tstyche (implementation tests)')
    execSync('corepack yarn test:implementation', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })
  } catch {
    exit(-3)
  }
}

/**
 * Done! 🥳
 */
