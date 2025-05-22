import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "yaml"
import simpleGit, { SimpleGit } from "simple-git"
import { MetadataScanner } from "./MetadataScanner"
import { validateAnyMetadata } from "./schemas"
import { LocalizationOptions, MarketplaceItem, MarketplaceRepository, RepositoryMetadata } from "./types"
import { getUserLocale } from "./utils"

/**
 * Handles fetching and caching marketplace repositories
 */
export class GitFetcher {
	private readonly cacheDir: string
	private metadataScanner: MetadataScanner
	private git?: SimpleGit
	private localizationOptions: LocalizationOptions
	private activeGitInstances: Set<SimpleGit> = new Set()

	constructor(context: vscode.ExtensionContext, localizationOptions?: LocalizationOptions) {
		this.cacheDir = path.join(context.globalStorageUri.fsPath, "marketplace-cache")
		this.localizationOptions = localizationOptions || {
			userLocale: getUserLocale(),
			fallbackLocale: "en",
		}
		this.metadataScanner = new MetadataScanner(undefined, this.localizationOptions)
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		// Clean up all git instances
		this.activeGitInstances.forEach((git) => {
			try {
				// Force cleanup of git instance
				;(git as any)._executor = null
			} catch {
				// Ignore cleanup errors
			}
		})
		this.activeGitInstances.clear()

		// Clean up metadata scanner
		if (this.metadataScanner) {
			this.metadataScanner = null as any
		}
	}

	/**
	 * Initialize git instance for a repository
	 * @param repoDir Repository directory
	 */
	private initGit(repoDir: string): void {
		// Clean up old git instance if it exists
		if (this.git) {
			this.activeGitInstances.delete(this.git)
			try {
				// Force cleanup of git instance
				;(this.git as any)._executor = null
			} catch {
				// Ignore cleanup errors
			}
		}

		// Create new git instance
		this.git = simpleGit(repoDir)
		this.activeGitInstances.add(this.git)

		// Update MetadataScanner with new git instance
		const oldScanner = this.metadataScanner
		this.metadataScanner = new MetadataScanner(this.git, this.localizationOptions)

		// Clean up old scanner
		if (oldScanner) {
			oldScanner.dispose?.()
		}
	}

	/**
	 * Fetch repository data
	 * @param repoUrl Repository URL
	 * @param forceRefresh Whether to bypass cache
	 * @param sourceName Optional source repository name
	 * @returns Repository data
	 */
	async fetchRepository(repoUrl: string, forceRefresh = false, sourceName?: string): Promise<MarketplaceRepository> {
		// Ensure cache directory exists
		await fs.mkdir(this.cacheDir, { recursive: true })

		// Get repository directory name from URL
		const repoName = this.getRepositoryName(repoUrl)
		const repoDir = path.join(this.cacheDir, repoName)

		// Clone or pull repository
		await this.cloneOrPullRepository(repoUrl, repoDir, forceRefresh)

		// Initialize git for this repository
		this.initGit(repoDir)

		// Find the registry dir
		const registryDir = await this.findRegistryDir(repoDir)

		// Validate repository structure
		await this.validateRegistryStructure(registryDir)

		// Parse repository metadata
		const metadata = await this.parseRepositoryMetadata(registryDir)

		// Parse marketplace items
		// Get current branch using existing git instance
		const branch = (await this.git?.revparse(["--abbrev-ref", "HEAD"])) || "main"

		const items = await this.parseMarketplaceItems(registryDir, repoUrl, sourceName || metadata.name)

		return {
			metadata,
			items: items.map((item) => ({ ...item, defaultBranch: branch })),
			url: repoUrl,
			defaultBranch: branch,
		}
	}

	async findRegistryDir(repoDir: string) {
		const isRoot = await fs
			.stat(path.join(repoDir, "metadata.en.yml"))
			.then(() => true)
			.catch(() => false)

		if (isRoot) return repoDir

		const isRegistrySubdir = await fs
			.stat(path.join(repoDir, "registry", "metadata.en.yml"))
			.then(() => true)
			.catch(() => false)

		if (isRegistrySubdir) return path.join(repoDir, "registry")

		throw new Error('Invalid repository structure: could not find "registry" metadata')
	}

	/**
	 * Get repository name from URL
	 * @param repoUrl Repository URL
	 * @returns Repository name
	 */
	private getRepositoryName(repoUrl: string): string {
		const match = repoUrl.match(/\/([^/]+?)(?:\.git)?$/)
		if (!match) {
			throw new Error(`Invalid repository URL: ${repoUrl}`)
		}
		return match[1]
	}

	/**
	 * Clone or pull repository
	 * @param repoUrl Repository URL
	 * @param repoDir Repository directory
	 * @param forceRefresh Whether to force refresh
	 */
	/**
	 * Clean up any git lock files in the repository
	 * @param repoDir Repository directory
	 */
	private async cleanupGitLocks(repoDir: string): Promise<void> {
		const indexLockPath = path.join(repoDir, ".git", "index.lock")
		try {
			await fs.unlink(indexLockPath)
		} catch {
			// Ignore errors if file doesn't exist
		}
	}

	private async cloneOrPullRepository(repoUrl: string, repoDir: string, forceRefresh: boolean): Promise<void> {
		try {
			// Clean up any existing git lock files first
			await this.cleanupGitLocks(repoDir)
			// Check if repository exists
			const gitDir = path.join(repoDir, ".git")
			let repoExists = await fs
				.stat(gitDir)
				.then(() => true)
				.catch(() => false)

			if (repoExists && !forceRefresh) {
				try {
					// Pull latest changes
					const git = simpleGit(repoDir)
					// Force pull with overwrite
					await git.fetch("origin", "main")
					await git.raw(["reset", "--hard", "origin/main"])
					await git.raw(["clean", "-f", "-d"])
				} catch (error) {
					// Clean up git locks before retrying
					await this.cleanupGitLocks(repoDir)
					// If pull fails with specific errors that indicate repo corruption,
					// we should remove and re-clone
					const errorMessage = error instanceof Error ? error.message : String(error)
					if (
						errorMessage.includes("not a git repository") ||
						errorMessage.includes("repository not found") ||
						errorMessage.includes("refusing to merge unrelated histories")
					) {
						await fs.rm(repoDir, { recursive: true, force: true })
						repoExists = false
					} else {
						throw error
					}
				}
			}

			if (!repoExists || forceRefresh) {
				try {
					// Clean up any existing git lock files
					const indexLockPath = path.join(repoDir, ".git", "index.lock")
					try {
						await fs.unlink(indexLockPath)
					} catch {
						// Ignore errors if file doesn't exist
					}

					// Always remove the directory before cloning
					await fs.rm(repoDir, { recursive: true, force: true })

					// Add a small delay to ensure directory is fully cleaned up
					await new Promise((resolve) => setTimeout(resolve, 100))

					// Verify directory is gone before proceeding
					const dirExists = await fs
						.stat(repoDir)
						.then(() => true)
						.catch(() => false)
					if (dirExists) {
						throw new Error("Failed to clean up directory before cloning")
					}

					// Clone repository
					const git = simpleGit()
					// Clone with force options
					await git.clone(repoUrl, repoDir)
					// Reset to ensure clean state
					const repoGit = simpleGit(repoDir)
					await repoGit.raw(["clean", "-f", "-d"])
					await repoGit.raw(["reset", "--hard", "HEAD"])
				} catch (error) {
					// If clone fails, ensure we clean up any partially created directory
					try {
						await fs.rm(repoDir, { recursive: true, force: true })
					} catch {
						// Ignore cleanup errors
					}
					throw error
				}
			}

			// Get current branch using existing git instance
			// const branch =
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			;(await this.git?.revparse(["--abbrev-ref", "HEAD"])) || "main"
		} catch (error) {
			throw new Error(
				`Failed to clone/pull repository: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Validate registry structure
	 * @param repoDir Registry directory
	 */
	private async validateRegistryStructure(repoDir: string): Promise<void> {
		// Check for metadata.en.yml
		const metadataPath = path.join(repoDir, "metadata.en.yml")
		try {
			await fs.stat(metadataPath)
		} catch {
			throw new Error("Registry is missing metadata.en.yml file")
		}
	}

	/**
	 * Parse repository metadata
	 * @param repoDir Repository directory
	 * @returns Repository metadata
	 */
	private async parseRepositoryMetadata(repoDir: string): Promise<RepositoryMetadata> {
		const metadataPath = path.join(repoDir, "metadata.en.yml")
		const metadataContent = await fs.readFile(metadataPath, "utf-8")

		try {
			const parsed = yaml.parse(metadataContent) as Record<string, any>
			return validateAnyMetadata(parsed) as RepositoryMetadata
		} catch (error) {
			console.error("Failed to parse repository metadata:", error)
			return {
				name: "Unknown Repository",
				description: "Failed to load repository",
				version: "0.0.0",
			}
		}
	}

	/**
	 * Parse marketplace items
	 * @param repoDir Repository directory
	 * @param repoUrl Repository URL
	 * @param sourceName Source repository name
	 * @returns Array of marketplace items
	 */
	private async parseMarketplaceItems(
		repoDir: string,
		repoUrl: string,
		sourceName: string,
	): Promise<MarketplaceItem[]> {
		return this.metadataScanner.scanDirectory(repoDir, repoUrl, sourceName)
	}
}
