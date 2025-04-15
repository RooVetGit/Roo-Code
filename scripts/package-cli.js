#!/usr/bin/env node

/**
 * This script packages the CLI tool with its dependencies for global installation.
 * It builds the CLI tool, copies the necessary files to a distribution directory,
 * installs the dependencies in the distribution directory, and creates a tarball
 * that can be installed globally.
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

// Configuration
const rootDir = path.resolve(__dirname, "..")
const roocliDir = path.join(rootDir, "roocli")
const distDir = path.join(rootDir, "dist", "cli")

// Ensure the dist directory exists
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true })
}

console.log("Building CLI tool...")

// Build the CLI tool
try {
	process.chdir(roocliDir)
	execSync("npm install", { stdio: "inherit" })
	execSync("npm run build", { stdio: "inherit" })
	process.chdir(rootDir)
} catch (error) {
	console.error(`Error building CLI tool: ${error.message}`)
	process.exit(1)
}

console.log("Copying files to distribution directory...")

// Copy the necessary files to the distribution directory
try {
	// Copy the built files
	const srcDistDir = path.join(roocliDir, "dist")
	if (fs.existsSync(srcDistDir)) {
		// Copy all files from the dist directory
		const files = fs.readdirSync(srcDistDir)
		for (const file of files) {
			const srcPath = path.join(srcDistDir, file)
			const destPath = path.join(distDir, file)

			if (fs.statSync(srcPath).isDirectory()) {
				// If it's a directory, copy it recursively
				fs.cpSync(srcPath, destPath, { recursive: true })
			} else {
				// If it's a file, copy it
				fs.copyFileSync(srcPath, destPath)
			}
		}
	}

	// Copy and modify package.json from roocli directory
	const packageJsonPath = path.join(roocliDir, "package.json")
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

	// Update paths for the distribution
	packageJson.main = "index.js"
	packageJson.bin = {
		roo: "index.js",
	}

	// Ensure bundledDependencies is included
	if (!packageJson.bundledDependencies) {
		packageJson.bundledDependencies = Object.keys(packageJson.dependencies || {})
	}

	fs.writeFileSync(path.join(distDir, "package.json"), JSON.stringify(packageJson, null, 2))

	// Create a README.md file
	const readmeContent = `# RooCode CLI

A command line interface for RooCode that communicates with the RooCode extension via WebSocket.

## Installation

\`\`\`bash
npm install -g roocli
\`\`\`

## Usage

\`\`\`bash
# Get help
roo --help

# Get command-specific help
roo <command> --help
\`\`\`

For more information, see the [RooCode documentation](https://docs.roocode.com).
`

	fs.writeFileSync(path.join(distDir, "README.md"), readmeContent)
} catch (error) {
	console.error(`Error copying files: ${error.message}`)
	process.exit(1)
}

console.log("Installing dependencies in distribution directory...")

// Install dependencies in the distribution directory
try {
	process.chdir(distDir)
	execSync("npm install", { stdio: "inherit" })
} catch (error) {
	console.error(`Error installing dependencies: ${error.message}`)
	process.exit(1)
}

console.log("Creating tarball...")

// Create a tarball
try {
	execSync("npm pack", { stdio: "inherit" })

	// Move the tarball to the root directory
	const tarballs = fs.readdirSync(distDir).filter((file) => file.endsWith(".tgz"))
	if (tarballs.length > 0) {
		const tarball = tarballs[0]
		const srcPath = path.join(distDir, tarball)
		const destPath = path.join(rootDir, tarball)
		fs.copyFileSync(srcPath, destPath)
		console.log(`Tarball created: ${destPath}`)
		console.log("You can install it globally with:")
		console.log(`npm install -g ${destPath}`)
	}
} catch (error) {
	console.error(`Error creating tarball: ${error.message}`)
	process.exit(1)
}

console.log("CLI tool packaged successfully!")

// Return to the root directory
process.chdir(rootDir)
