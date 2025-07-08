import * as fs from "fs/promises"
import * as path from "path"

export interface OutboundCall {
	url: string
	file: string
	type: "external_api" | "telemetry" | "local" | "schema" | "documentation"
	line: number
}

const URL_PATTERNS = [/https?:\/\/[^\s"'\`<>{}|\\^]+/g]

const EXCLUDE_PATTERNS = [
	/schema\.json/i,
	/go\.microsoft\.com/i,
	/docs\.microsoft\.com/i,
	/developer\.mozilla\.org/i,
	/www\.w3\.org/i,
	/nextjs\.org/i,
	/turbo\.build/i,
	/ui\.shadcn\.com/i,
]

const TELEMETRY_PATTERNS = [/TelemetryClient/i, /telemetry/i, /analytics/i, /posthog/i]

const LOCAL_PATTERNS = [/localhost/i, /127\.0\.0\.1/, /0\.0\.0\.0/, /\[::1\]/]

export async function detectOutboundCalls(directory: string): Promise<OutboundCall[]> {
	const calls: OutboundCall[] = []

	async function scanDirectory(dir: string): Promise<void> {
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name)

				if (entry.isDirectory()) {
					// Skip node_modules and other build directories
					if (!["node_modules", "dist", "build", ".git", "__pycache__"].includes(entry.name)) {
						await scanDirectory(fullPath)
					}
				} else if (entry.isFile()) {
					// Only scan relevant source files
					if (/\.(ts|js|tsx|jsx|json)$/.test(entry.name)) {
						await scanFile(fullPath)
					}
				}
			}
		} catch (error) {
			console.warn(`Warning: Could not scan directory ${dir}:`, error)
		}
	}

	async function scanFile(filePath: string): Promise<void> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const lines = content.split("\n")

			lines.forEach((line, index) => {
				for (const pattern of URL_PATTERNS) {
					const matches = line.matchAll(pattern)

					for (const match of matches) {
						const url = match[0]

						// Skip excluded URLs
						if (EXCLUDE_PATTERNS.some((p) => p.test(url))) {
							continue
						}

						const call: OutboundCall = {
							url,
							file: filePath,
							line: index + 1,
							type: categorizeCall(url, filePath),
						}

						calls.push(call)
					}
				}
			})
		} catch (error) {
			console.warn(`Warning: Could not read file ${filePath}:`, error)
		}
	}

	function categorizeCall(url: string, filePath: string): OutboundCall["type"] {
		// Check if it's a local URL
		if (LOCAL_PATTERNS.some((p) => p.test(url))) {
			return "local"
		}

		// Check if it's telemetry related
		if (
			TELEMETRY_PATTERNS.some((p) => p.test(filePath)) ||
			url.includes("/api/events") ||
			url.includes("telemetry") ||
			url.includes("analytics")
		) {
			return "telemetry"
		}

		// Check if it's a schema or documentation
		if (url.includes("schema") || url.includes("docs") || url.includes("developer")) {
			return "documentation"
		}

		// Default to external API
		return "external_api"
	}

	await scanDirectory(directory)
	return calls
}

export function generateCSV(calls: OutboundCall[]): string {
	const header = "url,file,type,line\n"
	const rows = calls.map((call) => `"${call.url}","${call.file}","${call.type}",${call.line}`).join("\n")
	return header + rows
}

// CLI usage
if (require.main === module) {
	async function main() {
		const directory = process.argv[2] || "src"
		console.log(`🔍 Scanning ${directory} for outbound calls...`)

		const calls = await detectOutboundCalls(directory)

		// Filter out non-critical calls for summary
		const externalCalls = calls.filter((call) => call.type === "external_api" || call.type === "telemetry")

		console.log(`\n📊 Found ${calls.length} total URLs, ${externalCalls.length} potentially problematic`)
		console.log("\n🚨 External API calls:")
		externalCalls
			.filter((call) => call.type === "external_api")
			.forEach((call) => {
				console.log(`  ${call.url} (${path.relative(process.cwd(), call.file)}:${call.line})`)
			})

		console.log("\n📡 Telemetry calls:")
		externalCalls
			.filter((call) => call.type === "telemetry")
			.forEach((call) => {
				console.log(`  ${call.url} (${path.relative(process.cwd(), call.file)}:${call.line})`)
			})

		// Generate CSV
		const csv = generateCSV(calls)
		await fs.writeFile("outbound-calls.csv", csv)
		console.log("\n📄 Full report saved to outbound-calls.csv")
	}

	main().catch(console.error)
}
