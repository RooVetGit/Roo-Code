#!/usr/bin/env node

/**
 * Script to run the mention regex benchmark
 * This allows easy execution of the benchmark from the command line
 */

const { execSync } = require("child_process")
const path = require("path")

// Get the project root directory
const projectRoot = path.resolve(__dirname, "../..")

// Run the benchmark using ts-node
try {
	console.log("Running mention regex benchmark...")
	execSync("npx tsx src/benchmarks/mention-regex-benchmark.ts", {
		cwd: projectRoot,
		stdio: "inherit",
	})
	console.log("Benchmark completed successfully.")
} catch (error) {
	console.error("Error running benchmark:", error.message)
	process.exit(1)
}
