import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "js-yaml"
import simpleGit, { SimpleGit } from "simple-git"
import { MetadataScanner } from "@package-manager/MetadataScanner"
import { validateAnyMetadata } from "@package-manager/schemas"
import {
	LocalizationOptions,
	PackageManagerItem,
	PackageManagerRepository,
	RepositoryMetadata,
} from "@package-manager/types"
import { getUserLocale } from "@package-manager/utils"

/**
 * Handles fetching and caching package manager repositories
 */
export class GitFetcher {
	private readonly cacheDir: string
	private metadataScanner: MetadataScanner
	private git?: SimpleGit
	private localizationOptions: LocalizationOptions

	constructor(context: vscode.ExtensionContext, localizationOptions?: LocalizationOptions) {
		this.cacheDir = path.join(context.globalStorageUri.fsPath, "package-manager-cache")
		this.localizationOptions = localizationOptions || {
			userLocale: getUserLocale(),
			fallbackLocale: "en",
		}
		this.metadataScanner = new MetadataScanner(undefined, this.localizationOptions)
	}

	/**
	 * Initialize git instance for a repository
	 * @param repoDir Repository directory
	 */
	private initGit(repoDir: string): void {
		this.git = simpleGit(repoDir)
		// Update MetadataScanner with new git instance
		this.metadataScanner = new MetadataScanner(this.git, this.localizationOptions)
	}

	/**
	 * Fetch repository data
	 * @param repoUrl Repository URL
	 * @param forceRefresh Whether to bypass cache
	 * @param sourceName Optional source repository name
	 * @returns Repository data
	 */
	async fetchRepository(
		repoUrl: string,
		forceRefresh = false,
		sourceName?: string,
	): Promise<PackageManagerRepository> {
		// Ensure cache directory exists
		await fs.mkdir(this.cacheDir, { recursive: true })

		// Get repository directory name from URL
		const repoName = this.getRepositoryName(repoUrl)
		const repoDir = path.join(this.cacheDir, repoName)

		// Clone or pull repository
		await this.cloneOrPullRepository(repoUrl, repoDir, forceRefresh)

		// Initialize git for this repository
		this.initGit(repoDir)

		// Validate repository structure
		await this.validateRepositoryStructure(repoDir)

		// Parse repository metadata
		const metadata = await this.parseRepositoryMetadata(repoDir)

		// Parse package manager items
		const items = await this.parsePackageManagerItems(repoDir, repoUrl, sourceName || metadata.name)

		return {
			metadata,
			items,
			url: repoUrl,
		}
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

			// Get current branch
			const git = simpleGit(repoDir)
			const branch = await git.revparse(["--abbrev-ref", "HEAD"])
			console.log(`Repository cloned/pulled successfully on branch ${branch}`)
		} catch (error) {
			throw new Error(
				`Failed to clone/pull repository: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Validate repository structure
	 * @param repoDir Repository directory
	 */
	private async validateRepositoryStructure(repoDir: string): Promise<void> {
		// Check for metadata.en.yml
		const metadataPath = path.join(repoDir, "metadata.en.yml")
		try {
			await fs.stat(metadataPath)
		} catch {
			throw new Error("Repository is missing metadata.en.yml file")
		}

		// Check for README.md
		const readmePath = path.join(repoDir, "README.md")
		try {
			await fs.stat(readmePath)
		} catch {
			throw new Error("Repository is missing README.md file")
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
			const parsed = yaml.load(metadataContent) as Record<string, any>
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
	 * Parse package manager items
	 * @param repoDir Repository directory
	 * @param repoUrl Repository URL
	 * @param sourceName Source repository name
	 * @returns Array of package manager items
	 */
	private async parsePackageManagerItems(
		repoDir: string,
		repoUrl: string,
		sourceName: string,
	): Promise<PackageManagerItem[]> {
		return this.metadataScanner.scanDirectory(repoDir, repoUrl, sourceName)
	}
}
