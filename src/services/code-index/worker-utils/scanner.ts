// Worker-compatible version of scanner without vscode dependencies
import * as fs from "fs/promises"
import * as path from "path"
import { glob } from "glob"
import ignore from "ignore"

export interface ScanResult {
	files: string[]
	totalFiles: number
}

/**
 * Scans the workspace for files to index (worker-compatible version)
 */
export class Scanner {
	private static readonly DEFAULT_EXCLUDE_PATTERNS = [
		"**/node_modules/**",
		"**/.git/**",
		"**/dist/**",
		"**/build/**",
		"**/out/**",
		"**/.next/**",
		"**/.nuxt/**",
		"**/coverage/**",
		"**/.nyc_output/**",
		"**/.cache/**",
		"**/.parcel-cache/**",
		"**/.vscode/**",
		"**/.idea/**",
		"**/*.min.js",
		"**/*.map",
		"**/vendor/**",
		"**/bower_components/**",
		"**/.svn/**",
		"**/.hg/**",
		"**/.DS_Store",
		"**/Thumbs.db",
		"**/*.log",
		"**/logs/**",
		"**/tmp/**",
		"**/temp/**",
		"**/.env*",
		"**/.git/**",
		"**/.gitignore",
		"**/.gitmodules",
		"**/package-lock.json",
		"**/yarn.lock",
		"**/pnpm-lock.yaml",
		"**/composer.lock",
		"**/Gemfile.lock",
		"**/Cargo.lock",
		"**/poetry.lock",
		"**/Pipfile.lock",
		"**/.terraform/**",
		"**/*.tfstate*",
		"**/.serverless/**",
		"**/cdk.out/**",
	]

	private static readonly INCLUDE_PATTERNS = [
		"**/*.ts",
		"**/*.tsx",
		"**/*.js",
		"**/*.jsx",
		"**/*.mjs",
		"**/*.cjs",
		"**/*.vue",
		"**/*.svelte",
		"**/*.py",
		"**/*.pyw",
		"**/*.pyx",
		"**/*.pxd",
		"**/*.pyi",
		"**/*.java",
		"**/*.kt",
		"**/*.kts",
		"**/*.scala",
		"**/*.sc",
		"**/*.go",
		"**/*.rs",
		"**/*.c",
		"**/*.cc",
		"**/*.cpp",
		"**/*.cxx",
		"**/*.c++",
		"**/*.h",
		"**/*.hh",
		"**/*.hpp",
		"**/*.hxx",
		"**/*.h++",
		"**/*.cs",
		"**/*.fs",
		"**/*.fsx",
		"**/*.fsi",
		"**/*.ml",
		"**/*.mli",
		"**/*.rb",
		"**/*.rake",
		"**/*.php",
		"**/*.php3",
		"**/*.php4",
		"**/*.php5",
		"**/*.phtml",
		"**/*.swift",
		"**/*.m",
		"**/*.mm",
		"**/*.dart",
		"**/*.lua",
		"**/*.pl",
		"**/*.pm",
		"**/*.t",
		"**/*.sh",
		"**/*.bash",
		"**/*.zsh",
		"**/*.fish",
		"**/*.ps1",
		"**/*.psm1",
		"**/*.psd1",
		"**/*.bat",
		"**/*.cmd",
		"**/*.r",
		"**/*.R",
		"**/*.jl",
		"**/*.ex",
		"**/*.exs",
		"**/*.elm",
		"**/*.clj",
		"**/*.cljs",
		"**/*.cljc",
		"**/*.edn",
		"**/*.erl",
		"**/*.hrl",
		"**/*.nim",
		"**/*.nims",
		"**/*.cr",
		"**/*.d",
		"**/*.zig",
		"**/*.v",
		"**/*.vsh",
		"**/*.sql",
		"**/*.md",
		"**/*.mdx",
		"**/*.rst",
		"**/*.txt",
		"**/*.json",
		"**/*.jsonc",
		"**/*.json5",
		"**/*.yaml",
		"**/*.yml",
		"**/*.toml",
		"**/*.xml",
		"**/*.html",
		"**/*.htm",
		"**/*.xhtml",
		"**/*.css",
		"**/*.scss",
		"**/*.sass",
		"**/*.less",
		"**/*.styl",
		"**/Dockerfile",
		"**/Containerfile",
		"**/*.dockerfile",
		"**/*.containerfile",
		"**/docker-compose.yml",
		"**/docker-compose.yaml",
		"**/.env.example",
		"**/.env.sample",
		"**/Makefile",
		"**/makefile",
		"**/GNUmakefile",
		"**/CMakeLists.txt",
		"**/*.cmake",
		"**/meson.build",
		"**/BUILD",
		"**/BUILD.bazel",
		"**/WORKSPACE",
		"**/*.bzl",
		"**/*.gradle",
		"**/*.gradle.kts",
		"**/pom.xml",
		"**/build.xml",
		"**/*.sbt",
		"**/Cargo.toml",
		"**/go.mod",
		"**/go.sum",
		"**/package.json",
		"**/tsconfig.json",
		"**/jsconfig.json",
		"**/webpack.config.js",
		"**/webpack.config.ts",
		"**/rollup.config.js",
		"**/rollup.config.ts",
		"**/vite.config.js",
		"**/vite.config.ts",
		"**/.eslintrc",
		"**/.eslintrc.js",
		"**/.eslintrc.json",
		"**/.prettierrc",
		"**/.prettierrc.js",
		"**/.prettierrc.json",
		"**/jest.config.js",
		"**/jest.config.ts",
		"**/vitest.config.js",
		"**/vitest.config.ts",
		"**/playwright.config.js",
		"**/playwright.config.ts",
		"**/cypress.config.js",
		"**/cypress.config.ts",
		"**/*.proto",
		"**/*.graphql",
		"**/*.gql",
		"**/*.prisma",
		"**/*.tf",
		"**/*.tfvars",
		"**/*.hcl",
		"**/ansible.cfg",
		"**/*.playbook.yml",
		"**/*.playbook.yaml",
		"**/requirements.txt",
		"**/requirements.in",
		"**/Pipfile",
		"**/pyproject.toml",
		"**/setup.py",
		"**/setup.cfg",
		"**/Gemfile",
		"**/Rakefile",
		"**/composer.json",
		"**/*.gemspec",
		"**/pubspec.yaml",
		"**/pubspec.yml",
		"**/*.cabal",
		"**/stack.yaml",
		"**/elm.json",
		"**/deno.json",
		"**/deno.jsonc",
		"**/*.nimble",
		"**/shard.yml",
		"**/Project.toml",
		"**/Manifest.toml",
		"**/*.opam",
		"**/rebar.config",
		"**/erlang.mk",
		"**/mix.exs",
		"**/*.app.src",
		"**/info.rkt",
		"**/.gitignore",
		"**/.dockerignore",
		"**/.npmignore",
		"**/.gitattributes",
		"**/.editorconfig",
		"**/LICENSE",
		"**/LICENSE.txt",
		"**/LICENSE.md",
		"**/COPYING",
		"**/README",
		"**/README.txt",
		"**/README.md",
		"**/CHANGELOG",
		"**/CHANGELOG.txt",
		"**/CHANGELOG.md",
		"**/CONTRIBUTING",
		"**/CONTRIBUTING.txt",
		"**/CONTRIBUTING.md",
		"**/AUTHORS",
		"**/AUTHORS.txt",
		"**/AUTHORS.md",
		"**/CONTRIBUTORS",
		"**/CONTRIBUTORS.txt",
		"**/CONTRIBUTORS.md",
		"**/.github/workflows/*.yml",
		"**/.github/workflows/*.yaml",
		"**/.gitlab-ci.yml",
		"**/.travis.yml",
		"**/appveyor.yml",
		"**/.circleci/config.yml",
		"**/bitbucket-pipelines.yml",
		"**/azure-pipelines.yml",
		"**/Jenkinsfile",
		"**/.drone.yml",
		"**/.woodpecker.yml",
		"**/cloudbuild.yaml",
		"**/cloudbuild.yml",
		"**/buildspec.yml",
		"**/.buildkite/*.yml",
		"**/netlify.toml",
		"**/vercel.json",
		"**/now.json",
		"**/render.yaml",
		"**/render.yml",
		"**/app.json",
		"**/Procfile",
		"**/heroku.yml",
		"**/fly.toml",
		"**/.replit",
		"**/replit.nix",
		"**/.devcontainer/devcontainer.json",
		"**/.devcontainer.json",
		"**/Vagrantfile",
		"**/.vagrant/**",
		"**/*.code-workspace",
		"**/.vscode/settings.json",
		"**/.vscode/tasks.json",
		"**/.vscode/launch.json",
		"**/.vscode/extensions.json",
		"**/.idea/*.xml",
		"**/.fleet/settings.json",
	]

	constructor(
		private workspacePath: string,
		private excludePatterns: string[] = [],
		private includePatterns: string[] = [],
	) {
		if (!workspacePath || workspacePath.trim() === "") {
			throw new Error("Workspace path cannot be empty")
		}
	}

	/**
	 * Scans the workspace for files to index
	 */
	async scan(onProgress?: (processed: number, total: number) => void): Promise<ScanResult> {
		const allExcludePatterns = [...Scanner.DEFAULT_EXCLUDE_PATTERNS, ...this.excludePatterns]
		const allIncludePatterns = this.includePatterns.length > 0 ? this.includePatterns : Scanner.INCLUDE_PATTERNS

		// Use glob to find all matching files
		const files: string[] = []
		let processedCount = 0

		// Create ignore instance once, outside the loop
		const ig = ignore().add(allExcludePatterns)

		for (const pattern of allIncludePatterns) {
			const matches = await glob(pattern, {
				cwd: this.workspacePath,
				absolute: true,
				nodir: true,
				dot: true,
				ignore: allExcludePatterns,
			})

			for (const file of matches) {
				// Double-check exclusion patterns using ignore
				const relativePath = path.relative(this.workspacePath, file)
				const isExcluded = relativePath ? ig.ignores(relativePath) : false

				if (!isExcluded && !files.includes(file)) {
					files.push(file)
				}

				processedCount++
				if (onProgress && processedCount % 100 === 0) {
					onProgress(processedCount, files.length)
				}
			}
		}

		// Sort files for consistent ordering
		files.sort()

		return {
			files,
			totalFiles: files.length,
		}
	}

	/**
	 * Checks if a file should be indexed based on include/exclude patterns
	 */
	shouldIndexFile(filePath: string): boolean {
		const relativePath = path.relative(this.workspacePath, filePath)

		// Check exclude patterns first using ignore
		const allExcludePatterns = [...Scanner.DEFAULT_EXCLUDE_PATTERNS, ...this.excludePatterns]
		const ig = ignore().add(allExcludePatterns)
		const isExcluded = ig.ignores(relativePath)

		if (isExcluded) {
			return false
		}

		// Check include patterns - for include patterns, we need to check if any pattern matches
		const allIncludePatterns = this.includePatterns.length > 0 ? this.includePatterns : Scanner.INCLUDE_PATTERNS

		// Convert glob patterns to check if file matches any include pattern
		const ext = path.extname(filePath).toLowerCase()
		const fileName = path.basename(filePath)

		const isIncluded = allIncludePatterns.some((pattern) => {
			// Handle simple extension patterns
			if (pattern.startsWith("**/*") && pattern.indexOf("*", 4) === -1) {
				const patternExt = pattern.substring(3)
				return filePath.endsWith(patternExt)
			}
			// Handle specific file name patterns
			if (pattern.startsWith("**/") && !pattern.includes("*", 3)) {
				const patternName = pattern.substring(3)
				return fileName === patternName
			}
			// For complex patterns, use glob matching
			return filePath.includes(pattern.replace(/\*\*/g, "").replace(/\*/g, ""))
		})

		return isIncluded
	}
}
