/**
 * List of directories that are typically large and should be ignored
 * when showing recursive file listings or scanning for code indexing.
 * This list is shared between list-files.ts and the codebase indexing scanner
 * to ensure consistent behavior across the application.
 */
export const DIRS_TO_IGNORE = [
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
	".*",
]

/**
 * List of directories that should always be visible in file listings,
 * even if they are included in .gitignore or are hidden directories.
 * This is necessary for directories that contain workflow files used by various modes.
 */
export const GITIGNORE_WHITELIST = [".roo/temp"]
