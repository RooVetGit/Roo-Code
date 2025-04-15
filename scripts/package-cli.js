#!/usr/bin/env node

/**
 * package-cli.js
 *
 * This script packages the roocli tool with the VS Code extension.
 * It builds the CLI tool and copies the necessary files to be included in the extension package.
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

// Paths
const ROOT_DIR = path.resolve(__dirname, "..")
const CLI_DIR = path.join(ROOT_DIR, "roocli")
const CLI_DIST_DIR = path.join(CLI_DIR, "dist")
const EXTENSION_CLI_DIR = path.join(ROOT_DIR, "dist", "cli")

// Ensure the CLI tool is built
console.log("Building CLI tool...")
try {
	process.chdir(CLI_DIR)
	execSync("npm run build", { stdio: "inherit" })
	process.chdir(ROOT_DIR)
} catch (error) {
	console.error("Failed to build CLI tool:", error)
	process.exit(1)
}

// Create the CLI directory in the extension dist folder
console.log("Creating CLI directory in extension package...")
fs.mkdirSync(EXTENSION_CLI_DIR, { recursive: true })

// Copy the CLI dist files to the extension package
console.log("Copying CLI files to extension package...")
try {
	// Copy the CLI dist files
	fs.cpSync(CLI_DIST_DIR, EXTENSION_CLI_DIR, { recursive: true })

	// Copy package.json (needed for dependencies)
	fs.copyFileSync(path.join(CLI_DIR, "package.json"), path.join(EXTENSION_CLI_DIR, "package.json"))

	// Create a stripped-down package.json for the CLI in the extension
	const cliPackageJson = JSON.parse(fs.readFileSync(path.join(CLI_DIR, "package.json"), "utf8"))

	// Keep only necessary fields
	const strippedPackageJson = {
		name: cliPackageJson.name,
		version: cliPackageJson.version,
		description: cliPackageJson.description,
		main: cliPackageJson.main,
		bin: cliPackageJson.bin,
		dependencies: cliPackageJson.dependencies,
	}

	fs.writeFileSync(path.join(EXTENSION_CLI_DIR, "package.json"), JSON.stringify(strippedPackageJson, null, 2))

	console.log("CLI tool successfully packaged with extension.")
} catch (error) {
	console.error("Failed to copy CLI files:", error)
	process.exit(1)
}
