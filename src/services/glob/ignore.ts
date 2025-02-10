export const IGNORE = [
	"node_modules",
	"__pycache__",
	"env",
	"venv",
	"target/dependency",
	"build/dependencies",
	"dist",
	"out",
	"bundle",
	"vendor",
	"tmp",
	"temp",
	"deps",
	"pkg",
	"Pods",
	// '!**/.*' excludes hidden directories, while '!**/.*/**' excludes only
	// their contents. This way we are at least aware of the existence of
	// hidden directories.
	".*",
].map((dir) => `**/${dir}/**`)
