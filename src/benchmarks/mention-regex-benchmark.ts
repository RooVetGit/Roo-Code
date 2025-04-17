import { mentionRegexGlobal } from "../shared/context-mentions"
import * as fs from "fs"
import * as path from "path"

/**
 * Benchmark the performance of the mentionRegexGlobal regex pattern
 * This script measures execution time for different test cases and saves results
 * for future reference when making regex changes.
 */

interface BenchmarkResult {
	testCase: string
	description: string
	iterations: number
	totalMatches: number
	executionTimeMs: number
	timePerIterationMs: number
	matchesPerSecond: number
}

// Test cases to benchmark
const testCases: Array<{ name: string; description: string; text: string; simulateTyping?: boolean }> = [
	{
		name: "file_paths",
		description: "File paths starting with @/",
		text: generateText(
			[
				"@/path/to/file.js",
				"@/another/path/file.ts",
				"@/usr/local/bin",
				"@/home/user/documents/file.txt",
				"@/var/log/system.log",
			],
			100,
		),
	},
	{
		name: "urls",
		description: "URLs with protocols",
		text: generateText(
			[
				"@http://example.com",
				"@https://github.com/user/repo",
				"@ftp://server.com/file",
				"@ssh://user@server.com",
				"@file:///home/user/document.txt",
			],
			100,
		),
	},
	{
		name: "special_words",
		description: "Special words like problems, git-changes, terminal",
		text: generateText(
			[
				"@problems",
				"@git-changes",
				"@terminal",
				"Check @problems for errors",
				"View @git-changes for updates",
				"Open @terminal to run commands",
			],
			100,
		),
	},
	{
		name: "git_hashes",
		description: "Git commit hashes",
		text: generateText(
			[
				"@1a2b3c4",
				"@abcdef1234567890",
				"@1234567890abcdef1234567890abcdef12345678",
				"Commit @a1b2c3d fixed the bug",
				"See @1a2b3c4d5e6f7g8h for details",
			],
			100,
		),
	},
	{
		name: "mixed",
		description: "Mixed content with various mention types",
		text: generateText(
			[
				"Check @/path/to/file.js for implementation",
				"Visit @https://example.com for more info",
				"View @problems to see errors",
				"Commit @1a2b3c4 fixed the issue",
				"Open @terminal and run the command",
				"Look at @git-changes for recent updates",
				"Download from @ftp://server.com/file",
				"Edit @/usr/local/config.json",
			],
			100,
		),
	},
	{
		name: "with_punctuation",
		description: "Mentions followed by punctuation",
		text: generateText(
			[
				"Check @/path/to/file.js, it has the implementation",
				"Visit @https://example.com. It has more info",
				"View @problems! There are errors",
				"Commit @1a2b3c4; it fixed the issue",
				"Open @terminal: run the command",
				"Look at @git-changes? For recent updates",
			],
			100,
		),
	},
	{
		name: "large_text",
		description: "Large text with few mentions (worst case scenario)",
		text: generateLargeText(10000, 50),
	},
	{
		name: "typing_simulation",
		description: "Simulating user typing character by character",
		text: generateText(
			[
				"User is typing @/path/to/file.js slowly",
				"Now typing @https://example.com one character at a time",
				"Typing @problems with pauses between characters",
				"Slowly typing @1a2b3c4 as a commit reference",
				"Character by character typing @terminal command",
				"Typing @git-changes with deliberate keystrokes",
			],
			10,
		),
		simulateTyping: true,
	},
]

// Generate text by repeating the patterns
function generateText(patterns: string[], repetitions: number): string {
	const result: string[] = []
	for (let i = 0; i < repetitions; i++) {
		for (const pattern of patterns) {
			result.push(pattern)
			// Add some random text between patterns
			result.push(
				// `This is some random text to separate patterns. Iteration ${i}.`
				"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.\nExcepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n",
			)
		}
	}
	return result.join("\n")
}

// Generate large text with few mentions (worst case scenario)
function generateLargeText(size: number, mentionCount: number): string {
	const lorem =
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.\nExcepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n"

	// Generate large text with paragraphs
	let text = ""
	while (text.length < size) {
		text += lorem
	}

	// Insert mentions at random positions
	const mentions = ["@/path/to/file.js", "@https://example.com", "@problems", "@1a2b3c4", "@terminal", "@git-changes"]

	// Split by newlines to get paragraphs
	const lines = text.split("\n")
	for (let i = 0; i < mentionCount; i++) {
		const randomLineIndex = Math.floor(Math.random() * lines.length)
		const randomMention = mentions[Math.floor(Math.random() * mentions.length)]
		lines[randomLineIndex] += " " + randomMention
	}

	return lines.join("\n")
}

// Run benchmark for a single test case
function runBenchmark(
	name: string,
	description: string,
	text: string,
	iterations: number = 100,
	simulateTyping: boolean = false,
): BenchmarkResult {
	console.log(`Running benchmark for: ${name}`)

	let totalMatches = 0
	const startTime = performance.now()

	if (simulateTyping) {
		// Simulate typing character by character
		for (let i = 0; i < iterations; i++) {
			const lines = text.split("\n")

			for (const line of lines) {
				let currentText = ""

				// Simulate typing each character
				for (let charIndex = 0; charIndex < line.length; charIndex++) {
					currentText += line[charIndex]

					// Reset lastIndex to ensure consistent behavior
					mentionRegexGlobal.lastIndex = 0

					// Check for matches after each keystroke
					const matches = currentText.match(mentionRegexGlobal) || []
					totalMatches += matches.length
				}
			}
		}
	} else {
		// Standard benchmark (process whole text at once)
		for (let i = 0; i < iterations; i++) {
			// Reset lastIndex to ensure consistent behavior across iterations
			mentionRegexGlobal.lastIndex = 0

			// Count matches
			const matches = text.match(mentionRegexGlobal) || []
			totalMatches += matches.length
		}
	}

	const endTime = performance.now()
	const executionTimeMs = endTime - startTime
	const timePerIterationMs = executionTimeMs / iterations
	const matchesPerSecond = (totalMatches / executionTimeMs) * 1000

	return {
		testCase: name,
		description,
		iterations,
		totalMatches: totalMatches / iterations, // Average matches per iteration
		executionTimeMs,
		timePerIterationMs,
		matchesPerSecond,
	}
}

// Run all benchmarks and save results
async function runAllBenchmarks() {
	console.log("Starting mention regex benchmark...")

	const results: BenchmarkResult[] = []
	const regexSource = mentionRegexGlobal.toString()

	for (const testCase of testCases) {
		const result = runBenchmark(
			testCase.name,
			testCase.description,
			testCase.text,
			100,
			testCase.simulateTyping || false,
		)
		results.push(result)
	}

	// Format results as markdown
	const timestamp = new Date().toISOString()
	const markdownResults = formatResultsAsMarkdown(regexSource, results, timestamp)

	// Save results to file
	const resultsDir = path.join(__dirname, "results")
	if (!fs.existsSync(resultsDir)) {
		fs.mkdirSync(resultsDir, { recursive: true })
	}

	const filename = path.join(resultsDir, `mention-regex-benchmark-${timestamp.replace(/:/g, "-")}.md`)

	fs.writeFileSync(filename, markdownResults)
	console.log(`Benchmark results saved to: ${filename}`)

	// Also save to a fixed filename for easy reference
	const latestFilename = path.join(resultsDir, "mention-regex-benchmark-latest.md")
	fs.writeFileSync(latestFilename, markdownResults)
	console.log(`Benchmark results also saved to: ${latestFilename}`)

	return { results, filename }
}

// Format results as markdown
function formatResultsAsMarkdown(regexSource: string, results: BenchmarkResult[], timestamp: string): string {
	let markdown = `# Mention Regex Benchmark Results\n\n`
	markdown += `Benchmark run on: ${new Date(timestamp).toLocaleString()}\n\n`
	markdown += `## Regex Pattern\n\n\`\`\`javascript\n${regexSource}\n\`\`\`\n\n`

	markdown += `## Results\n\n`
	markdown += `| Test Case | Description | Iterations | Matches | Total Time (ms) | Time/Iter (ms) | Matches/sec |\n`
	markdown += `|-----------|-------------|------------|---------|-----------------|----------------|-------------|\n`

	for (const result of results) {
		markdown += `| ${result.testCase} | ${result.description} | ${
			result.iterations
		} | ${result.totalMatches.toFixed(0)} | ${result.executionTimeMs.toFixed(
			2,
		)} | ${result.timePerIterationMs.toFixed(4)} | ${result.matchesPerSecond.toFixed(0)} |\n`
	}

	return markdown
}

// Run the benchmarks
runAllBenchmarks()
	.then(({ results, filename }) => {
		console.log("Benchmark completed successfully.")
		process.exit(0)
	})
	.catch((error) => {
		console.error("Error running benchmark:", error)
		process.exit(1)
	})
