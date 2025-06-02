#!/usr/bin/env node

const path = require("path")
const fs = require("fs")

// Check if running in nightly mode
const isNightly = process.env.PKG_NAME === "roo-code-nightly"

// Read the experiments configuration
const experimentsPath = path.join(__dirname, "../src/shared/experiments.ts")
const experimentsContent = fs.readFileSync(experimentsPath, "utf8")

// Extract EXPERIMENT_IDS
const experimentIdsMatch = experimentsContent.match(/export const EXPERIMENT_IDS = \{([^}]+)\}/s)
if (!experimentIdsMatch) {
	console.error("❌ Could not find EXPERIMENT_IDS in experiments.ts")
	process.exit(1)
}

// Extract experimentConfigsMap
const configsMatch = experimentsContent.match(/export const experimentConfigsMap[^{]+\{(.*)\}/s)
if (!configsMatch) {
	console.error("❌ Could not find experimentConfigsMap in experiments.ts")
	process.exit(1)
}

// Parse experiment IDs
const experimentIds = {}
const idsContent = experimentIdsMatch[1]
const idMatches = idsContent.matchAll(/(\w+):\s*"([^"]+)"/g)
for (const match of idMatches) {
	experimentIds[match[1]] = match[2]
}

// Parse experiment configs
const configsContent = configsMatch[1]
const configMatches = configsContent.matchAll(/(\w+):\s*\{([^}]+)\}/g)

const experiments = []
for (const match of configMatches) {
	const key = match[1]
	const configStr = match[2]
	const enabled = configStr.includes("enabled: true")
	const isInternal = configStr.includes("internal: true")
	const nightlyDefault = configStr.includes("nightlyDefault: true")

	const id = experimentIds[key]
	experiments.push({
		key,
		id,
		enabled,
		internal: isInternal,
		nightlyDefault,
		effectiveEnabled: isNightly && nightlyDefault ? true : enabled,
	})
}

console.log(`\n🧪 Experiments Configuration (${isNightly ? "NIGHTLY" : "STABLE"} build):\n`)
console.log("User-facing experiments:")
experiments
	.filter((exp) => !exp.internal)
	.forEach(({ id, effectiveEnabled }) => {
		console.log(`  - ${id}: ${effectiveEnabled ? "✅ ENABLED" : "❌ DISABLED"}`)
	})

const internalExperiments = experiments.filter((exp) => exp.internal)
if (internalExperiments.length > 0) {
	console.log("\nInternal feature flags:")
	internalExperiments.forEach(({ id, effectiveEnabled, nightlyDefault }) => {
		const status = effectiveEnabled ? "✅ ENABLED" : "❌ DISABLED"
		const nightlyInfo = nightlyDefault ? " (nightly default)" : ""
		console.log(`  - ${id}: ${status}${nightlyInfo}`)
	})
}

console.log("\n")
