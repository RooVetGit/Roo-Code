// Test script to reproduce the .rooignore issue with nested project folders
const path = require("path")

// Simulate the issue scenario
const rootFolder = "/Users/test/Root Folder"
const nextjsProject = "/Users/test/Root Folder/example-nextjs"
const nextFolder = "/Users/test/Root Folder/example-nextjs/.next"

// Test the path normalization logic from RooIgnoreController
function testPathNormalization(cwd, filePath) {
	console.log(`\nTesting path normalization:`)
	console.log(`CWD: ${cwd}`)
	console.log(`File path: ${filePath}`)

	// This is the logic from RooIgnoreController.validateAccess()
	const absolutePath = path.resolve(cwd, filePath)
	console.log(`Absolute path: ${absolutePath}`)

	const relativePath = path.relative(cwd, absolutePath)
	console.log(`Relative path: ${relativePath}`)

	// Convert to POSIX (forward slashes)
	const posixPath = relativePath.replace(/\\/g, "/")
	console.log(`POSIX path: ${posixPath}`)

	return posixPath
}

// Test case 1: .rooignore in root folder, trying to ignore nested .next folder
console.log("=== Test Case 1: .rooignore in Root Folder ===")
const rooignorePattern = "example-nextjs/.next/"
const fileToCheck = "example-nextjs/.next/server/pages/index.js"

const normalizedPath = testPathNormalization(rootFolder, fileToCheck)
console.log(`\nPattern in .rooignore: ${rooignorePattern}`)
console.log(`Normalized file path: ${normalizedPath}`)
console.log(`Should match pattern: ${normalizedPath.startsWith(rooignorePattern.replace(/\/$/, ""))}`)

// Test case 2: What if the file path is already absolute?
console.log("\n=== Test Case 2: Absolute file path ===")
const absoluteFileToCheck = path.join(nextjsProject, ".next/server/pages/index.js")
const normalizedPath2 = testPathNormalization(rootFolder, absoluteFileToCheck)
console.log(`\nPattern in .rooignore: ${rooignorePattern}`)
console.log(`Normalized file path: ${normalizedPath2}`)
console.log(`Should match pattern: ${normalizedPath2.startsWith(rooignorePattern.replace(/\/$/, ""))}`)

// Test case 3: What if we're scanning from the nextjs project directory?
console.log("\n=== Test Case 3: Scanning from nextjs project directory ===")
const fileInNext = ".next/server/pages/index.js"
const normalizedPath3 = testPathNormalization(nextjsProject, fileInNext)
console.log(`\nIf .rooignore was in nextjs project with pattern: .next/`)
console.log(`Normalized file path: ${normalizedPath3}`)
console.log(`Should match pattern: ${normalizedPath3.startsWith(".next/")}`)
