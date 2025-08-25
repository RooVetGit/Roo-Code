import fs from "fs/promises"
import * as path from "path"

import { fileExistsAtPath } from "../../utils/fs"
import { executeRipgrep } from "../search/file-search"

const DEFAULT_LARGE_FILE_THRESHOLD_BYTES = 10 * 1024 * 1024 // 10 MB

function getConfiguredLargeFileThresholdBytes(): number {
	// Allow override via environment variable (in MB), e.g. ROO_CHECKPOINTS_LARGE_FILE_THRESHOLD_MB=25
	const env = process.env.ROO_CHECKPOINTS_LARGE_FILE_THRESHOLD_MB
	const parsed = env ? Number(env) : NaN
	if (Number.isFinite(parsed) && parsed > 0) {
		return Math.round(parsed * 1024 * 1024)
	}
	return DEFAULT_LARGE_FILE_THRESHOLD_BYTES
}

// Common code/text extensions that should not be auto-excluded by size
const CODE_EXT_ALLOWLIST: Set<string> = new Set<string>([
	".ts",
	".tsx",
	".js",
	".jsx",
	".json",
	".md",
	".txt",
	".py",
	".java",
	".cs",
	".cpp",
	".c",
	".h",
	".hpp",
	".go",
	".rb",
	".rs",
	".kt",
	".swift",
	".m",
	".mm",
	".php",
	".html",
	".css",
	".scss",
	".less",
	".xml",
	".yml",
	".yaml",
	".toml",
	".ini",
	".gradle",
	".csproj",
	".sln",
	".vue",
	".svelte",
	".astro",
])

const getBuildArtifactPatterns = () => [
	".gradle/",
	".idea/",
	".parcel-cache/",
	".pytest_cache/",
	".next/",
	".nuxt/",
	".sass-cache/",
	".terraform/",
	".terragrunt-cache/",
	".vs/",
	".vscode/",
	"Pods/",
	"__pycache__/",
	"bin/",
	"build/",
	"bundle/",
	"coverage/",
	"deps/",
	"dist/",
	"env/",
	"node_modules/",
	"obj/",
	"out/",
	"pkg/",
	"pycache/",
	"target/dependency/",
	"temp/",
	"vendor/",
	"venv/",
]

const getMediaFilePatterns = () => [
	"*.jpg",
	"*.jpeg",
	"*.png",
	"*.gif",
	"*.bmp",
	"*.ico",
	"*.webp",
	"*.tiff",
	"*.tif",
	"*.raw",
	"*.heic",
	"*.avif",
	"*.eps",
	"*.psd",
	"*.3gp",
	"*.aac",
	"*.aiff",
	"*.asf",
	"*.avi",
	"*.divx",
	"*.flac",
	"*.m4a",
	"*.m4v",
	"*.mkv",
	"*.mov",
	"*.mp3",
	"*.mp4",
	"*.mpeg",
	"*.mpg",
	"*.ogg",
	"*.opus",
	"*.rm",
	"*.rmvb",
	"*.vob",
	"*.wav",
	"*.webm",
	"*.wma",
	"*.wmv",
]

const getCacheFilePatterns = () => [
	"*.DS_Store",
	"*.bak",
	"*.cache",
	"*.crdownload",
	"*.dmp",
	"*.dump",
	"*.eslintcache",
	"*.lock",
	"*.log",
	"*.old",
	"*.part",
	"*.partial",
	"*.pyc",
	"*.pyo",
	"*.stackdump",
	"*.swo",
	"*.swp",
	"*.temp",
	"*.tmp",
	"Thumbs.db",
]

const getConfigFilePatterns = () => ["*.env*", "*.local", "*.development", "*.production"]

const getLargeDataFilePatterns = () => [
	"*.zip",
	"*.tar",
	"*.gz",
	"*.rar",
	"*.7z",
	"*.iso",
	"*.bin",
	"*.exe",
	"*.dll",
	"*.so",
	"*.dylib",
	"*.dat",
	"*.dmg",
	"*.msi",
]

const getDatabaseFilePatterns = () => [
	"*.arrow",
	"*.accdb",
	"*.aof",
	"*.avro",
	"*.bak",
	"*.bson",
	"*.csv",
	"*.db",
	"*.dbf",
	"*.dmp",
	"*.frm",
	"*.ibd",
	"*.mdb",
	"*.myd",
	"*.myi",
	"*.orc",
	"*.parquet",
	"*.pdb",
	"*.rdb",
	"*.sql",
	"*.sqlite",
]

const getGeospatialPatterns = () => [
	"*.shp",
	"*.shx",
	"*.dbf",
	"*.prj",
	"*.sbn",
	"*.sbx",
	"*.shp.xml",
	"*.cpg",
	"*.gdb",
	"*.mdb",
	"*.gpkg",
	"*.kml",
	"*.kmz",
	"*.gml",
	"*.geojson",
	"*.dem",
	"*.asc",
	"*.img",
	"*.ecw",
	"*.las",
	"*.laz",
	"*.mxd",
	"*.qgs",
	"*.grd",
	"*.csv",
	"*.dwg",
	"*.dxf",
]

const getLogFilePatterns = () => [
	"*.error",
	"*.log",
	"*.logs",
	"*.npm-debug.log*",
	"*.out",
	"*.stdout",
	"yarn-debug.log*",
	"yarn-error.log*",
]

const getLfsPatterns = async (workspacePath: string) => {
	try {
		const attributesPath = path.join(workspacePath, ".gitattributes")

		if (await fileExistsAtPath(attributesPath)) {
			return (await fs.readFile(attributesPath, "utf8"))
				.split("\n")
				.filter((line) => line.includes("filter=lfs"))
				.map((line) => line.split(" ")[0].trim())
		}
	} catch (error) {}

	return []
}

/**
 * Additional patterns for common game engines and large asset-heavy projects (Unity, Unreal, etc.)
 * This helps avoid checkpointing huge binary assets by default.
 */
const getGameEnginePatterns = () => [
	// Unity
	"Library/",
	"Temp/",
	"Build/",
	"Builds/",
	"Logs/",
	"UserSettings/",
	"*.unity",
	"*.prefab",
	"*.asset",
	"*.fbx",
	"*.blend",
	"*.obj",
	"*.unitypackage",
	// Unreal
	"*.uasset",
	"*.umap",
]

/**
 * Scan the workspace for very large non-code files and exclude them automatically.
 * Pre-filters out git-lfs managed files to avoid unnecessary file system operations.
 * Uses ripgrep for fast file listing, then fs.stat for sizes.
 */
async function getLargeFileAutoExcludePatterns(
	workspacePath: string,
	thresholdBytes: number,
	lfsPatterns: string[] = [],
): Promise<{ patterns: string[]; errorCounts: { ripgrepErrors: number; fsStatErrors: number } }> {
	// Build ripgrep args with common ignores
	const args = [
		"--files",
		"--follow",
		"--hidden",
		"-g",
		"!**/node_modules/**",
		"-g",
		"!**/.git/**",
		"-g",
		"!**/out/**",
		"-g",
		"!**/dist/**",
	]

	// Pre-filter git-lfs patterns at ripgrep level
	for (const pattern of lfsPatterns) {
		const rgPattern = pattern.startsWith("!") ? pattern.substring(1) : `!${pattern}`
		args.push("-g", rgPattern)
	}

	args.push(workspacePath)

	let items: Array<{ path: string; type: string }> = []
	let ripgrepErrors = 0
	let fsStatErrors = 0

	try {
		const rgResult = await executeRipgrep({ args, workspacePath, limit: 50000 })
		items = Array.isArray(rgResult) ? rgResult : []
	} catch {
		// If ripgrep fails, record error and continue with empty items to avoid breaking checkpoints
		ripgrepErrors = 1
		items = []
	}

	const large: string[] = []

	for (const item of items) {
		if ((item as any).type !== "file") continue

		const rel = (item as any).path
		const ext = path.extname(rel).toLowerCase()

		// Keep code/text files even if large
		if (CODE_EXT_ALLOWLIST.has(ext)) continue

		try {
			const stat = await fs.stat(path.join(workspacePath, rel))
			if (stat.size >= thresholdBytes) {
				// Normalize to forward slashes for git exclude
				large.push(rel.replace(/\\/g, "/"))
			}
		} catch {
			// Count stat errors for diagnostics
			fsStatErrors++
		}
	}

	return {
		patterns: Array.from(new Set(large)),
		errorCounts: { ripgrepErrors, fsStatErrors },
	}
}

/**
 * Returns exclude patterns and statistics used for logging/UX decisions.
 */
export async function getExcludePatternsWithStats(workspacePath: string): Promise<{
	patterns: string[]
	stats: {
		largeFilesExcluded: number
		thresholdBytes: number
		sample: string[]
		errorCounts?: { ripgrepErrors: number; fsStatErrors: number }
	}
}> {
	// Get git-lfs patterns first
	const lfsPatterns = await getLfsPatterns(workspacePath)

	const base = [
		".git/",
		...getBuildArtifactPatterns(),
		...getMediaFilePatterns(),
		...getCacheFilePatterns(),
		...getConfigFilePatterns(),
		...getLargeDataFilePatterns(),
		...getDatabaseFilePatterns(),
		...getGeospatialPatterns(),
		...getLogFilePatterns(),
		...getGameEnginePatterns(),
		...lfsPatterns,
	]

	// Determine threshold (env override supported)
	const thresholdBytes = getConfiguredLargeFileThresholdBytes()

	// Pass lfs patterns to the large file scanner to pre-filter them
	const { patterns: dynamicLarge, errorCounts } = await getLargeFileAutoExcludePatterns(
		workspacePath,
		thresholdBytes,
		lfsPatterns,
	)

	const patterns = Array.from(new Set([...base, ...dynamicLarge]))

	return {
		patterns,
		stats: {
			largeFilesExcluded: dynamicLarge.length,
			thresholdBytes,
			sample: dynamicLarge.slice(0, 10),
			errorCounts,
		},
	}
}

/**
 * Backwards-compatible helper used by existing callers/tests.
 */
export const getExcludePatterns = async (workspacePath: string) =>
	(await getExcludePatternsWithStats(workspacePath)).patterns
