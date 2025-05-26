/**
 * Shared validation utilities for marketplace sources
 */
import { MarketplaceSource } from "../services/marketplace/types"

/**
 * Error type for marketplace source validation
 */
export interface ValidationError {
	field: string
	message: string
}

/**
 * Checks if a URL is a valid Git repository URL
 * @param url The URL to validate
 * @returns True if the URL is a valid Git repository URL, false otherwise
 */
export function isValidGitRepositoryUrl(url: string): boolean {
	// Trim the URL to remove any leading/trailing whitespace
	const trimmedUrl = url.trim()

	// HTTPS pattern (GitHub, GitLab, Bitbucket, etc.)
	// Examples:
	// - https://github.com/username/repo
	// - https://github.com/username/repo.git
	// - https://gitlab.com/username/repo
	// - https://bitbucket.org/username/repo
	const httpsPattern =
		/^https?:\/\/(?:[a-zA-Z0-9_-]+\.)*[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:\/[^/]+)*(?:\.git)?$/

	// SSH pattern
	// Examples:
	// - git@github.com:username/repo.git
	// - git@gitlab.com:username/repo.git
	const sshPattern = /^git@(?:[a-zA-Z0-9_-]+\.)*[a-zA-Z0-9_-]+:([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)(?:\.git)?$/

	// Git protocol pattern
	// Examples:
	// - git://github.com/username/repo.git
	const gitProtocolPattern = /^git:\/\/(?:[a-zA-Z0-9_-]+\.)*[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:\.git)?$/

	return httpsPattern.test(trimmedUrl) || sshPattern.test(trimmedUrl) || gitProtocolPattern.test(trimmedUrl)
}

export function validateSourceUrl(url: string): ValidationError[] {
	const errors: ValidationError[] = []

	// Check if URL is empty
	if (!url) {
		errors.push({
			field: "url",
			message: "URL cannot be empty",
		})
		return errors // Return early if URL is empty
	}

	// Check for non-visible characters (except spaces)
	const nonVisibleCharRegex = /[^\S ]/
	if (nonVisibleCharRegex.test(url)) {
		errors.push({
			field: "url",
			message: "URL contains non-visible characters other than spaces",
		})
	}

	// Check if URL is a valid Git repository URL
	if (!isValidGitRepositoryUrl(url)) {
		errors.push({
			field: "url",
			message: "URL must be a valid Git repository URL (e.g., https://git.example.com/username/repo)",
		})
	}

	return errors
}

export function validateSourceName(name?: string): ValidationError[] {
	const errors: ValidationError[] = []

	// Skip validation if name is not provided
	if (!name) {
		return errors
	}

	// Check name length
	if (name.length > 20) {
		errors.push({
			field: "name",
			message: "Name must be 20 characters or less",
		})
	}

	// Check for non-visible characters (except spaces)
	const nonVisibleCharRegex = /[^\S ]/
	if (nonVisibleCharRegex.test(name)) {
		errors.push({
			field: "name",
			message: "Name contains non-visible characters other than spaces",
		})
	}

	return errors
}

// Cache for normalized strings to avoid repeated operations
const normalizeCache = new Map<string, string>()

function normalizeString(str: string): string {
	const cached = normalizeCache.get(str)
	if (cached) return cached

	const normalized = str.toLowerCase().replace(/\s+/g, "")
	normalizeCache.set(str, normalized)
	return normalized
}

export function validateSourceDuplicates(
	sources: MarketplaceSource[],
	newSource?: MarketplaceSource,
): ValidationError[] {
	const errors: ValidationError[] = []

	// Process existing sources
	const seen = new Set<string>()

	// Check for duplicates within existing sources
	for (let i = 0; i < sources.length; i++) {
		const source = sources[i]
		const normalizedUrl = normalizeString(source.url)
		const normalizedName = source.name ? normalizeString(source.name) : null

		// Check for URL duplicates
		for (let j = i + 1; j < sources.length; j++) {
			const otherSource = sources[j]
			const otherUrl = normalizeString(otherSource.url)

			if (normalizedUrl === otherUrl) {
				const key = `url:${i}:${j}`
				if (!seen.has(key)) {
					errors.push({
						field: "url",
						message: `Source #${i + 1} has a duplicate URL with Source #${j + 1}`,
					})
					errors.push({
						field: "url",
						message: `Source #${j + 1} has a duplicate URL with Source #${i + 1}`,
					})
					seen.add(key)
					seen.add(`url:${j}:${i}`)
				}
			}

			// Check for name duplicates if both have names
			if (normalizedName && otherSource.name) {
				const otherName = normalizeString(otherSource.name)
				if (normalizedName === otherName) {
					const key = `name:${i}:${j}`
					if (!seen.has(key)) {
						errors.push({
							field: "name",
							message: `Source #${i + 1} has a duplicate name with Source #${j + 1}`,
						})
						errors.push({
							field: "name",
							message: `Source #${j + 1} has a duplicate name with Source #${i + 1}`,
						})
						seen.add(key)
						seen.add(`name:${j}:${i}`)
					}
				}
			}
		}
	}

	// Check new source against existing sources if provided
	if (newSource) {
		const normalizedNewUrl = normalizeString(newSource.url)
		const normalizedNewName = newSource.name ? normalizeString(newSource.name) : null

		// Check for duplicates with existing sources
		for (let i = 0; i < sources.length; i++) {
			const source = sources[i]
			const sourceUrl = normalizeString(source.url)

			if (sourceUrl === normalizedNewUrl) {
				errors.push({
					field: "url",
					message: `URL is a duplicate of Source #${i + 1}`,
				})
			}

			if (source.name && normalizedNewName) {
				const sourceName = normalizeString(source.name)
				if (sourceName === normalizedNewName) {
					errors.push({
						field: "name",
						message: `Name is a duplicate of Source #${i + 1}`,
					})
				}
			}
		}
	}

	return errors
}

export function validateSource(
	source: MarketplaceSource,
	existingSources: MarketplaceSource[] = [],
): ValidationError[] {
	// Combine all validation errors
	return [
		...validateSourceUrl(source.url),
		...validateSourceName(source.name),
		...validateSourceDuplicates(existingSources, source),
	]
}

export function validateSources(sources: MarketplaceSource[]): ValidationError[] {
	// Pre-allocate maximum possible size for errors array
	const errors: ValidationError[] = new Array(sources.length * 2 + (sources.length * (sources.length - 1)) / 2)
	let errorIndex = 0

	// Validate each source individually
	for (let i = 0; i < sources.length; i++) {
		const source = sources[i]
		const urlErrors = validateSourceUrl(source.url)
		const nameErrors = validateSourceName(source.name)

		// Add index to error messages
		for (const error of urlErrors) {
			errors[errorIndex++] = {
				field: error.field,
				message: `Source #${i + 1}: ${error.message}`,
			}
		}
		for (const error of nameErrors) {
			errors[errorIndex++] = {
				field: error.field,
				message: `Source #${i + 1}: ${error.message}`,
			}
		}
	}

	// Check for duplicates across all sources
	const duplicateErrors = validateSourceDuplicates(sources)
	for (const error of duplicateErrors) {
		errors[errorIndex++] = error
	}

	// Trim array to actual size
	return errors.slice(0, errorIndex)
}
