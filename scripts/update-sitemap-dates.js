#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

/**
 * Script to update sitemap.ts with actual git modification dates
 * Run this script whenever you want to update the sitemap with current git history
 */

const SITEMAP_PATH = path.join(__dirname, "../apps/web-roo-code/src/app/sitemap.ts")
const APP_DIR = path.join(__dirname, "../apps/web-roo-code/src/app")

/**
 * Recursively find all page.tsx files in the app directory
 * @param {string} dir - Directory to search
 * @param {string} basePath - Base path for building relative paths
 * @returns {Array<{url: string, filePath: string}>} Array of URL to file mappings
 */
function findPageFiles(dir, basePath = "") {
	const pages = []
	const entries = fs.readdirSync(dir, { withFileTypes: true })

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)

		if (entry.isDirectory()) {
			// Skip certain directories that shouldn't contain pages
			if (entry.name.startsWith(".") || entry.name === "api") {
				continue
			}

			// Recursively search subdirectories
			const subPages = findPageFiles(fullPath, path.join(basePath, entry.name))
			pages.push(...subPages)
		} else if (entry.name === "page.tsx") {
			// Convert file path to URL following Next.js app router conventions
			const url = basePath === "" ? "/" : `/${basePath}`
			const relativeFilePath = path.relative(path.join(__dirname, "../"), fullPath)

			pages.push({
				url,
				filePath: relativeFilePath,
			})
		}
	}

	return pages
}

/**
 * Get URL to file mapping by scanning the app directory
 * @returns {Object} Map of URLs to their corresponding page files
 */
function getUrlToFileMap() {
	const pages = findPageFiles(APP_DIR)
	const urlToFileMap = {}

	for (const page of pages) {
		urlToFileMap[page.url] = page.filePath
	}

	return urlToFileMap
}

/**
 * Get the last modification date of a file from git history
 * @param {string} filePath - Path to the file relative to repo root
 * @returns {string} ISO date string
 */
function getLastModifiedDate(filePath) {
	try {
		// Get the last commit date for the file
		// Use execFileSync to prevent command injection by separating command from arguments
		const result = execFileSync("git", ["log", "-1", "--format=%ai", "--", filePath], {
			cwd: path.join(__dirname, "../"), // Go to repo root
			encoding: "utf8",
		}).trim()

		if (!result) {
			console.warn(`No git history found for ${filePath}, using current date`)
			return new Date().toISOString()
		}

		// Convert git date to ISO string
		return new Date(result).toISOString()
	} catch (error) {
		console.error(`Error getting git date for ${filePath}:`, error.message)
		return new Date().toISOString()
	}
}

/**
 * Update the sitemap.ts file with new dates
 */
function updateSitemap() {
	console.log("🔍 Discovering page files...")

	// Dynamically discover page files
	const urlToFileMap = getUrlToFileMap()
	console.log(`Found ${Object.keys(urlToFileMap).length} page files:`)
	for (const [url, filePath] of Object.entries(urlToFileMap)) {
		console.log(`  ${url} → ${filePath}`)
	}

	console.log("\n🔍 Reading current sitemap...")

	// Read the current sitemap file
	const sitemapContent = fs.readFileSync(SITEMAP_PATH, "utf8")

	console.log("📅 Getting git modification dates...")

	// Get modification dates for each URL
	const urlDates = {}
	for (const [url, filePath] of Object.entries(urlToFileMap)) {
		const lastModified = getLastModifiedDate(filePath)
		urlDates[url] = lastModified
		console.log(`  ${url}: ${lastModified}`)
	}

	console.log("✏️  Updating sitemap content...")

	// Update the sitemap content
	let updatedContent = sitemapContent

	// Replace each lastModified: new Date() with the actual git date
	for (const [url, isoDate] of Object.entries(urlDates)) {
		// Create a regex to match the specific URL entry and its lastModified line
		const urlPattern = new RegExp(
			`(\\{[^}]*url:\\s*\`\\$\\{baseUrl\\}${url.replace("/", "\\/")}\`[^}]*lastModified:\\s*)new Date\\([^)]*\\)`,
			"g",
		)
		const isFound = updatedContent.match(urlPattern)

		if (!isFound) {
			console.error(`\n⚠️  No matching entry found for ${url}, skipping update`)
			console.log(
				`📝 To add this missing entry to the sitemap, add the following to apps/web-roo-code/src/app/sitemap.ts:`,
			)
			console.log(`\n{`)
			console.log(`\turl: \`\${baseUrl}${url}\`,`)
			console.log(`\tlastModified: new Date("${isoDate}"),`)
			console.log(`\tchangeFrequency: "monthly",`)
			console.log(`\tpriority: 0.8,`)
			console.log(`},\n`)
			continue
		}

		updatedContent = updatedContent.replace(urlPattern, `$1new Date("${isoDate}")`)
	}

	// Write the updated content back to the file
	fs.writeFileSync(SITEMAP_PATH, updatedContent, "utf8")

	console.log("✅ Sitemap updated successfully!")
	console.log(`📁 Updated file: ${SITEMAP_PATH}`)
}

// Run the script
if (require.main === module) {
	try {
		updateSitemap()
	} catch (error) {
		console.error("❌ Error updating sitemap:", error.message)
		process.exit(1)
	}
}

module.exports = { updateSitemap, getLastModifiedDate, findPageFiles, getUrlToFileMap }
