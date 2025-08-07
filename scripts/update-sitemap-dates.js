#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

/**
 * Script to update sitemap.ts with actual git modification dates
 * Run this script whenever you want to update the sitemap with current git history
 */

const SITEMAP_PATH = path.join(__dirname, "../apps/web-roo-code/src/app/sitemap.ts")

// Map of sitemap URLs to their corresponding page files
const URL_TO_FILE_MAP = {
	"/": "apps/web-roo-code/src/app/page.tsx",
	"/enterprise": "apps/web-roo-code/src/app/enterprise/page.tsx",
	"/evals": "apps/web-roo-code/src/app/evals/page.tsx",
	"/privacy": "apps/web-roo-code/src/app/privacy/page.tsx",
	"/terms": "apps/web-roo-code/src/app/terms/page.tsx",
}

/**
 * Get the last modification date of a file from git history
 * @param {string} filePath - Path to the file relative to repo root
 * @returns {string} ISO date string
 */
function getLastModifiedDate(filePath) {
	try {
		// Get the last commit date for the file
		const gitCommand = `git log -1 --format="%ai" -- "${filePath}"`
		const result = execSync(gitCommand, {
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
	console.log("🔍 Reading current sitemap...")

	// Read the current sitemap file
	const sitemapContent = fs.readFileSync(SITEMAP_PATH, "utf8")

	console.log("📅 Getting git modification dates...")

	// Get modification dates for each URL
	const urlDates = {}
	for (const [url, filePath] of Object.entries(URL_TO_FILE_MAP)) {
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

module.exports = { updateSitemap, getLastModifiedDate }
