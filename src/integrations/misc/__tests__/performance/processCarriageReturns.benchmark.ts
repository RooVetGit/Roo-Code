import { processCarriageReturns, applyRunLengthEncoding, truncateOutput } from "../../extract-text"

/**
 * Enhanced Benchmark test for terminal output processing functions
 *
 * This script tests three key functions:
 * 1. processCarriageReturns - Handles carriage returns like a real terminal
 * 2. applyRunLengthEncoding - Compresses repetitive output patterns
 * 3. truncateOutput - Limits output to a specified line count
 *
 * Tests with various data sizes and complexity levels for real-world performance metrics
 */

// Set a fixed random seed for reproducibility
const SEED = 12345
let seed = SEED

// Simple random number generator with seed
function random() {
	const x = Math.sin(seed++) * 10000
	return x - Math.floor(x)
}

// Generate random progress bar-like data with carriage returns
function generateTestData(size: number, complexity: "simple" | "medium" | "complex" = "medium"): string {
	seed = SEED // Reset seed for reproducibility

	let result = ""

	// Create lines of random content
	for (let i = 0; i < size; i++) {
		const line = `Processing file ${i}: `

		// For some lines, add progress bar updates with carriage returns
		if (random() < 0.3) {
			// 30% of lines have progress bars
			let progressUpdates: number

			switch (complexity) {
				case "simple":
					progressUpdates = Math.floor(random() * 5) + 1 // 1-5 updates
					break
				case "medium":
					progressUpdates = Math.floor(random() * 20) + 1 // 1-20 updates
					break
				case "complex":
					progressUpdates = Math.floor(random() * 50) + 1 // 1-50 updates
					break
			}

			for (let p = 0; p < progressUpdates; p++) {
				const progress = Math.floor((p / progressUpdates) * 100)
				// Ensure we never have negative values for repeat
				const progressChars = Math.max(0, p)
				const remainingChars = Math.max(0, 20 - p)
				const bar = `${line}[${"=".repeat(progressChars)}>${"-".repeat(remainingChars)}] ${progress}%\r`
				result += bar
			}

			// Add final state
			result += `${line}[${"=".repeat(20)}] 100%\n`
		} else {
			// Regular line
			result += `${line}Complete\n`
		}

		// Add more complex patterns for complex mode
		if (complexity === "complex" && random() < 0.1) {
			// Add ANSI escape sequences
			result += `\x1b[33mWarning: Slow operation detected\r\x1b[33mWarning: Fixed\x1b[0m\n`

			// Add Unicode with carriage returns
			if (random() < 0.5) {
				result += `处理中...\r已完成！\n`
			}

			// Add partial line overwrites
			if (random() < 0.5) {
				result += `Very long line with lots of text...\rShort\n`
			}

			// Add repeating patterns for RLE
			if (random() < 0.5) {
				result += `${"#".repeat(100)}\n`
			}

			// Add excessive new lines for truncation testing
			if (random() < 0.3) {
				result += "\n".repeat(Math.floor(random() * 10) + 1)
			}
		}
	}

	return result
}

// Get appropriate iteration count for different sizes to ensure meaningful timing
function getIterationCount(size: number): number {
	if (size <= 10000) return 100
	if (size <= 100000) return 20
	return 10
}

// Calculate statistical measures
function calculateStats(durations: number[]) {
	// Sort durations for percentile calculations
	const sorted = [...durations].sort((a, b) => a - b)

	return {
		min: sorted[0],
		max: sorted[sorted.length - 1],
		median: sorted[Math.floor(sorted.length / 2)],
		p95: sorted[Math.floor(sorted.length * 0.95)],
		p99: sorted[Math.floor(sorted.length * 0.99)],
		mean: durations.reduce((a, b) => a + b, 0) / durations.length,
		stdDev: Math.sqrt(
			durations
				.map((x) => Math.pow(x - durations.reduce((a, b) => a + b, 0) / durations.length, 2))
				.reduce((a, b) => a + b, 0) / durations.length,
		),
	}
}

// Run performance test for a specific function
function runPerformanceTest(
	name: string,
	fn: (input: string, ...args: any[]) => string,
	input: string,
	iterations: number,
	args: any[] = [],
) {
	console.log(`\nTesting ${name}...`)

	// Pre-warm
	const warmupResult = fn(input, ...args)
	const resultSize = (warmupResult.length / (1024 * 1024)).toFixed(2)
	const reduction = (100 - (warmupResult.length / input.length) * 100).toFixed(2)

	// Measure performance
	const durations: number[] = []

	// Force garbage collection if available (Node.js with --expose-gc flag)
	if (global.gc) {
		global.gc()
	}

	for (let i = 0; i < iterations; i++) {
		const startTime = performance.now()
		fn(input, ...args)
		const endTime = performance.now()
		durations.push(endTime - startTime)

		// Progress indicator
		if (iterations > 10 && i % Math.floor(iterations / 10) === 0) {
			process.stdout.write(".")
		}
	}

	if (iterations > 10) {
		process.stdout.write("\n")
	}

	// Calculate stats
	const stats = calculateStats(durations)

	// Calculate throughput
	const totalSizeProcessed = (input.length * iterations) / (1024 * 1024) // MB
	const totalBenchmarkTime = durations.reduce((a, b) => a + b, 0) / 1000 // seconds
	const averageThroughput = (totalSizeProcessed / totalBenchmarkTime).toFixed(2) // MB/s
	const peakThroughput = (input.length / (1024 * 1024) / (stats.min / 1000)).toFixed(2) // MB/s

	// Output metrics
	console.log(`- Time Statistics (in ms):`)
	console.log(`  • Mean: ${stats.mean.toFixed(3)}`)
	console.log(`  • Median: ${stats.median.toFixed(3)}`)
	console.log(`  • Min: ${stats.min.toFixed(3)}`)
	console.log(`  • Max: ${stats.max.toFixed(3)}`)
	console.log(`  • P95: ${stats.p95.toFixed(3)}`)
	console.log(`  • P99: ${stats.p99.toFixed(3)}`)
	console.log(`- Throughput:`)
	console.log(`  • Average: ${averageThroughput} MB/s`)
	console.log(`  • Peak: ${peakThroughput} MB/s`)
	console.log(
		`- Output size: ${resultSize} MB (${reduction}% ${parseFloat(reduction) < 0 ? "increase" : "reduction"})`,
	)

	return {
		stats,
		resultSize,
		reduction,
		averageThroughput,
		peakThroughput,
	}
}

// Run benchmark with different data sizes and complexities
function runBenchmark() {
	// Define test configurations: [size, complexity]
	const testConfigs: [number, "simple" | "medium" | "complex"][] = [
		[10000, "simple"],
		[10000, "complex"],
		[100000, "simple"],
		[100000, "complex"],
	]

	console.log("=".repeat(80))
	console.log("TERMINAL OUTPUT PROCESSING BENCHMARK")
	console.log("=".repeat(80))

	// Initial warmup to load JIT compiler
	console.log("\nPerforming initial warmup...")
	const warmupData = generateTestData(5000, "complex")
	for (let i = 0; i < 50; i++) {
		processCarriageReturns(warmupData)
		applyRunLengthEncoding(warmupData)
		truncateOutput(warmupData, 500)
	}
	console.log("Warmup complete")

	for (const [size, complexity] of testConfigs) {
		console.log(`\n${"-".repeat(80)}`)
		console.log(`Testing with ${size} lines, ${complexity} complexity...`)

		// Generate test data
		const startGenTime = performance.now()
		const testData = generateTestData(size, complexity)
		const genTime = performance.now() - startGenTime
		const dataSize = (testData.length / (1024 * 1024)).toFixed(2)

		console.log(`Generated ${dataSize} MB of test data in ${genTime.toFixed(2)}ms`)

		// Count carriage returns for reference
		const carriageReturns = (testData.match(/\r/g) || []).length
		const newLines = (testData.match(/\n/g) || []).length
		console.log(`Test data contains ${carriageReturns} carriage returns and ${newLines} newlines`)

		// Get iteration count based on data size
		const iterations = getIterationCount(size)
		console.log(`Running ${iterations} iterations for each function...`)

		// Test each function
		const lineLimit = 500 // Standard line limit for truncation

		console.log("\n--- Function 1: processCarriageReturns ---")
		const processCarriageReturnsResult = runPerformanceTest(
			"processCarriageReturns",
			processCarriageReturns,
			testData,
			iterations,
		)

		console.log("\n--- Function 2: applyRunLengthEncoding ---")
		const applyRunLengthEncodingResult = runPerformanceTest(
			"applyRunLengthEncoding",
			applyRunLengthEncoding,
			testData,
			iterations,
		)

		console.log("\n--- Function 3: truncateOutput ---")
		const truncateOutputResult = runPerformanceTest("truncateOutput", truncateOutput, testData, iterations, [
			lineLimit,
		])

		// Test combined pipeline (real-world usage)
		console.log("\n--- Combined Pipeline (all 3 functions) ---")
		runPerformanceTest(
			"Full Pipeline",
			(input) => truncateOutput(applyRunLengthEncoding(processCarriageReturns(input)), lineLimit),
			testData,
			Math.max(5, Math.floor(iterations / 2)),
		)
	}

	console.log("\n" + "=".repeat(80))
	console.log("Benchmark complete")
	console.log("=".repeat(80))
}

// Run the benchmark
runBenchmark()

// To run this benchmark:
// npx tsx src/integrations/misc/__tests__/performance/processCarriageReturns.benchmark.ts

// To run with more accurate timing (with explicit garbage collection):
// node --expose-gc -r tsx/cjs src/integrations/misc/__tests__/performance/processCarriageReturns.benchmark.ts
