#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

// Path to the package.json file
const packageJsonPath = path.join(__dirname, "..", "package.json")

// Read the original package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

// Store the original name
const originalName = packageJson.name

try {
	console.log(`Original package name: ${originalName}`)

	// Change the name to a non-scoped version
	// Remove the @ and / characters
	const nonScopedName = originalName.replace(/^@([^/]+)\//, "")
	console.log(`Temporary package name for vsce: ${nonScopedName}`)

	// Update the package.json with the non-scoped name
	packageJson.name = nonScopedName
	fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))

	// Run the vsce package command
	console.log("Running vsce package command...")
	execSync("rimraf bin && mkdirp bin && npx vsce package --no-dependencies --out bin", {
		stdio: "inherit",
		cwd: path.join(__dirname, ".."),
	})

	console.log("Package created successfully!")
} catch (error) {
	console.error("Error during packaging:", error)
	process.exit(1)
} finally {
	// Restore the original package.json
	console.log("Restoring original package.json...")
	packageJson.name = originalName
	fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
	console.log("Original package.json restored.")
}
