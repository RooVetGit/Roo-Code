#!/usr/bin/env node

const path = require("path")
const fs = require("fs")

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

const internalFlags = []
for (const match of configMatches) {
	const key = match[1]
	const configStr = match[2]
	const isInternal = configStr.includes("internal: true")
	const nightlyDefault = configStr.includes("nightlyDefault: true")

	if (isInternal) {
		const id = experimentIds[key]
		internalFlags.push({
			key,
			id,
			internal: true,
			nightlyDefault,
		})
	}
}

console.log(`Found ${internalFlags.length} internal feature flags:`)
internalFlags.forEach(({ id, nightlyDefault }) => {
	console.log(`  - ${id}: nightlyDefault=${nightlyDefault}`)
})

// Ensure internal flags are prefixed with underscore
const invalidFlags = internalFlags.filter(({ id }) => !id.startsWith("_"))
if (invalidFlags.length > 0) {
	console.error("❌ Internal flags must start with underscore:")
	invalidFlags.forEach(({ id }) => console.error(`  - ${id}`))
	process.exit(1)
}

console.log("✅ All internal flags are properly configured")
