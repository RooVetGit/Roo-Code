import { Fzf } from "fzf"

export interface SearchableItem {
	sectionId: string
	sectionLabel: string
	settingId: string
	settingLabel: string
	settingDescription?: string
	keywords?: string[]
}

// Define a mapping of setting keys to their search metadata
// This is much more maintainable than duplicating all settings
export const SETTINGS_SEARCH_CONFIG: Record<
	string,
	{
		sectionId: string
		translationKey?: string
		keywords?: string[]
	}
> = {
	// Providers section
	apiProvider: { sectionId: "providers", keywords: ["api", "provider", "model", "configuration"] },
	model: { sectionId: "providers", keywords: ["model", "ai", "llm"] },

	// Auto-Approve section - mapped to correct translation keys
	alwaysAllowReadOnly: {
		sectionId: "autoApprove",
		translationKey: "readOnly",
		keywords: ["read", "auto", "approve", "files"],
	},
	alwaysAllowReadOnlyOutsideWorkspace: {
		sectionId: "autoApprove",
		translationKey: "readOnly.outsideWorkspace",
		keywords: ["read", "auto", "approve", "files", "outside", "workspace"],
	},
	alwaysAllowWrite: {
		sectionId: "autoApprove",
		translationKey: "write",
		keywords: ["write", "auto", "approve", "edit", "create"],
	},
	alwaysAllowWriteOutsideWorkspace: {
		sectionId: "autoApprove",
		translationKey: "write.outsideWorkspace",
		keywords: ["write", "auto", "approve", "edit", "create", "outside", "workspace"],
	},
	alwaysAllowWriteProtected: {
		sectionId: "autoApprove",
		translationKey: "write.protected",
		keywords: ["write", "auto", "approve", "protected", "files"],
	},
	writeDelayMs: {
		sectionId: "autoApprove",
		translationKey: "write.delayLabel",
		keywords: ["write", "delay", "milliseconds", "timing"],
	},
	alwaysAllowExecute: {
		sectionId: "autoApprove",
		translationKey: "execute",
		keywords: ["execute", "terminal", "command", "auto", "approve"],
	},
	allowedCommands: {
		sectionId: "autoApprove",
		translationKey: "execute.allowedCommands",
		keywords: ["commands", "allowed", "whitelist", "execute"],
	},
	deniedCommands: {
		sectionId: "autoApprove",
		translationKey: "execute.deniedCommands",
		keywords: ["commands", "denied", "blacklist", "execute"],
	},
	alwaysAllowBrowser: {
		sectionId: "autoApprove",
		translationKey: "browser",
		keywords: ["browser", "auto", "approve"],
	},
	alwaysAllowMcp: {
		sectionId: "autoApprove",
		translationKey: "mcp",
		keywords: ["mcp", "auto", "approve", "model context protocol"],
	},
	alwaysAllowModeSwitch: {
		sectionId: "autoApprove",
		translationKey: "modeSwitch",
		keywords: ["mode", "switch", "auto", "approve"],
	},
	alwaysAllowSubtasks: {
		sectionId: "autoApprove",
		translationKey: "subtasks",
		keywords: ["subtasks", "auto", "approve", "tasks"],
	},
	alwaysAllowFollowupQuestions: {
		sectionId: "autoApprove",
		translationKey: "followupQuestions",
		keywords: ["followup", "questions", "auto", "approve"],
	},
	alwaysAllowUpdateTodoList: {
		sectionId: "autoApprove",
		translationKey: "updateTodoList",
		keywords: ["todo", "list", "auto", "approve", "update"],
	},
	followupAutoApproveTimeoutMs: {
		sectionId: "autoApprove",
		translationKey: "followupQuestions.timeoutLabel",
		keywords: ["followup", "timeout", "auto", "approve", "milliseconds"],
	},
	alwaysApproveResubmit: {
		sectionId: "autoApprove",
		translationKey: "retry",
		keywords: ["resubmit", "auto", "approve", "retry"],
	},
	requestDelaySeconds: {
		sectionId: "autoApprove",
		translationKey: "retry.delayLabel",
		keywords: ["request", "delay", "seconds", "timing"],
	},
	allowedMaxRequests: {
		sectionId: "autoApprove",
		translationKey: "apiRequestLimit",
		keywords: ["max", "requests", "limit", "auto", "approve"],
	},

	// Browser section
	browserToolEnabled: {
		sectionId: "browser",
		translationKey: "enable",
		keywords: ["browser", "tool", "enable", "computer use"],
	},
	browserViewportSize: {
		sectionId: "browser",
		translationKey: "viewport",
		keywords: ["viewport", "size", "resolution", "browser"],
	},
	screenshotQuality: {
		sectionId: "browser",
		translationKey: "screenshotQuality",
		keywords: ["screenshot", "quality", "webp", "browser"],
	},
	remoteBrowserEnabled: {
		sectionId: "browser",
		translationKey: "remote",
		keywords: ["remote", "browser", "enable", "server"],
	},
	remoteBrowserHost: {
		sectionId: "browser",
		translationKey: "remote.urlPlaceholder",
		keywords: ["remote", "browser", "host", "url", "server"],
	},

	// Checkpoints section
	enableCheckpoints: {
		sectionId: "checkpoints",
		translationKey: "enable",
		keywords: ["checkpoint", "backup", "restore", "history"],
	},

	// Notifications section
	soundEnabled: {
		sectionId: "notifications",
		translationKey: "sound",
		keywords: ["sound", "audio", "notification", "effects"],
	},
	soundVolume: {
		sectionId: "notifications",
		translationKey: "sound.volumeLabel",
		keywords: ["sound", "volume", "audio", "level"],
	},
	ttsEnabled: {
		sectionId: "notifications",
		translationKey: "tts",
		keywords: ["tts", "text to speech", "voice", "audio"],
	},
	ttsSpeed: {
		sectionId: "notifications",
		translationKey: "tts.speedLabel",
		keywords: ["tts", "speed", "voice", "rate"],
	},

	// Context Management section
	autoCondenseContext: {
		sectionId: "contextManagement",
		translationKey: "autoCondenseContext.name",
		keywords: ["context", "condense", "token", "automatic"],
	},
	autoCondenseContextPercent: {
		sectionId: "contextManagement",
		translationKey: "autoCondenseContextPercent",
		keywords: ["context", "condense", "percent", "threshold"],
	},
	condensingApiConfigId: {
		sectionId: "contextManagement",
		translationKey: "condensingApiConfiguration",
		keywords: ["condensing", "api", "config", "model"],
	},
	customCondensingPrompt: {
		sectionId: "contextManagement",
		translationKey: "customCondensingPrompt",
		keywords: ["condensing", "prompt", "custom", "context"],
	},
	maxOpenTabsContext: {
		sectionId: "contextManagement",
		translationKey: "openTabs",
		keywords: ["tabs", "context", "open", "limit"],
	},
	maxWorkspaceFiles: {
		sectionId: "contextManagement",
		translationKey: "workspaceFiles",
		keywords: ["workspace", "files", "context", "limit"],
	},
	showRooIgnoredFiles: {
		sectionId: "contextManagement",
		translationKey: "rooignore",
		keywords: ["roo", "ignored", "files", "show", "hidden"],
	},
	maxReadFileLine: {
		sectionId: "contextManagement",
		translationKey: "maxReadFile",
		keywords: ["read", "file", "line", "limit", "max"],
	},
	maxConcurrentFileReads: {
		sectionId: "contextManagement",
		translationKey: "maxConcurrentFileReads",
		keywords: ["concurrent", "file", "reads", "parallel", "limit"],
	},
	profileThresholds: {
		sectionId: "contextManagement",
		translationKey: "condensingThreshold",
		keywords: ["profile", "thresholds", "performance", "timing"],
	},

	// Terminal section
	outputLineLimit: { sectionId: "terminal", keywords: ["terminal", "output", "lines", "limit"] },
	outputCharacterLimit: { sectionId: "terminal", keywords: ["terminal", "output", "character", "limit"] },
	compressProgressBar: { sectionId: "terminal", keywords: ["terminal", "progress", "bar", "compress", "output"] },
	shellIntegrationDisabled: { sectionId: "terminal", keywords: ["terminal", "shell", "integration", "disable"] },
	shellIntegrationTimeout: {
		sectionId: "terminal",
		keywords: ["terminal", "shell", "integration", "timeout", "startup"],
	},
	commandDelay: { sectionId: "terminal", keywords: ["terminal", "command", "delay", "timing"] },
	powershellCounter: {
		sectionId: "terminal",
		keywords: ["terminal", "powershell", "counter", "workaround", "windows"],
	},
	zshClearEolMark: { sectionId: "terminal", keywords: ["terminal", "zsh", "eol", "mark", "end of line"] },
	zshOhMy: { sectionId: "terminal", keywords: ["terminal", "zsh", "oh my zsh", "shell", "integration"] },
	zshP10k: { sectionId: "terminal", keywords: ["terminal", "zsh", "powerlevel10k", "p10k", "shell"] },
	zdotdir: { sectionId: "terminal", keywords: ["terminal", "zsh", "zdotdir", "shell", "configuration"] },
	inheritEnv: { sectionId: "terminal", keywords: ["terminal", "environment", "variables", "inherit", "env"] },

	// Prompts section
	customSupportPrompts: { sectionId: "prompts", keywords: ["prompts", "custom", "support", "instructions"] },

	// Advanced section
	diffEnabled: { sectionId: "advanced", translationKey: "diff", keywords: ["diff", "enabled", "advanced"] },
	fuzzyMatchThreshold: {
		sectionId: "advanced",
		translationKey: "diff.matchPrecision",
		keywords: ["fuzzy", "match", "threshold", "search"],
	},
	mcpEnabled: { sectionId: "advanced", keywords: ["mcp", "model", "context", "protocol", "enabled"] },

	// Language section
	language: { sectionId: "language", keywords: ["language", "locale", "translation", "i18n"] },

	// About section
	telemetrySetting: { sectionId: "about", keywords: ["telemetry", "analytics", "privacy", "data"] },
}

// Experimental settings that are dynamically added
export const EXPERIMENTAL_SETTINGS = [
	"DIFF_STRATEGY_UNIFIED",
	"SEARCH_AND_REPLACE",
	"INSERT_BLOCK",
	"POWER_STEERING",
	"CONCURRENT_FILE_READS",
	"MULTI_SEARCH_AND_REPLACE",
	"MARKETPLACE",
	"MULTI_FILE_APPLY_DIFF",
]

// Generate searchable settings dynamically based on the configuration
export const getSearchableSettings = (t: (key: string) => string): SearchableItem[] => {
	const settings: SearchableItem[] = []

	// Process regular settings from config
	Object.entries(SETTINGS_SEARCH_CONFIG).forEach(([settingId, config]) => {
		const { sectionId, translationKey, keywords } = config

		// Build translation keys based on section and setting ID
		const sectionKey = `settings:sections.${sectionId}`
		let labelKey: string
		let descriptionKey: string

		// Use custom translation key if provided
		if (translationKey) {
			// Special case: if it's a property like "delayLabel", use it directly
			if (translationKey.endsWith("Label")) {
				labelKey = `settings:${sectionId}.${translationKey}`
				// Try to find a description by replacing Label with Description
				descriptionKey = `settings:${sectionId}.${translationKey.replace("Label", "Description")}`
			} else if (translationKey.includes(".name")) {
				// For keys like "autoCondenseContext.name"
				labelKey = `settings:${sectionId}.${translationKey}`
				descriptionKey = `settings:${sectionId}.${translationKey.replace(".name", ".description")}`
			} else {
				// Standard pattern: add .label and .description
				labelKey = `settings:${sectionId}.${translationKey}.label`
				descriptionKey = `settings:${sectionId}.${translationKey}.description`
			}
		} else {
			// Default behavior for settings without custom translation keys
			labelKey = `settings:${sectionId}.${settingId}.label`
			descriptionKey = `settings:${sectionId}.${settingId}.description`
		}

		// Handle special cases that don't follow the pattern
		if (settingId === "language") {
			labelKey = "settings:sections.language"
			descriptionKey = "settings:language.description"
		} else if (settingId === "telemetrySetting") {
			labelKey = "settings:footer.telemetry.label"
			descriptionKey = "settings:footer.telemetry.description"
		} else if (settingId === "apiProvider" || settingId === "model") {
			labelKey = `settings:providers.${settingId}`
			descriptionKey = `settings:providers.${settingId}Description`
		}

		const label = t(labelKey)
		const description = t(descriptionKey)

		// Add the setting with translated labels
		settings.push({
			sectionId,
			sectionLabel: t(sectionKey),
			settingId,
			settingLabel: label.startsWith("settings:") ? settingId : label, // Fallback to settingId if translation not found
			settingDescription: description.startsWith("settings:") ? undefined : description,
			keywords,
		})
	})

	// Add experimental settings
	EXPERIMENTAL_SETTINGS.forEach((id) => {
		settings.push({
			sectionId: "experimental",
			sectionLabel: t("settings:sections.experimental"),
			settingId: id,
			settingLabel: t(`settings:experimental.${id}.name`),
			settingDescription: t(`settings:experimental.${id}.description`),
			keywords: ["experimental", "experiment", id.toLowerCase().replace(/_/g, " ")],
		})
	})

	return settings
}

export interface SearchResult {
	sectionId: string
	matches: SearchableItem[]
}

export const searchSettings = (query: string, searchableItems: SearchableItem[]): SearchResult[] => {
	if (!query.trim()) return []

	// Create searchable items for fuzzy search
	const searchableData = searchableItems.map((item) => ({
		original: item,
		searchStr: [item.sectionLabel, item.settingLabel, item.settingDescription || "", ...(item.keywords || [])]
			.filter(Boolean)
			.join(" "),
	}))

	// Initialize Fzf instance for fuzzy search with case-insensitive matching
	const fzf = new Fzf(searchableData, {
		selector: (item) => item.searchStr.toLowerCase(),
		// Add scoring options to prioritize certain matches
		tiebreakers: [
			// Prioritize matches in setting labels
			(a, b) => {
				const aInLabel = a.item.original.settingLabel.toLowerCase().includes(query.toLowerCase())
				const bInLabel = b.item.original.settingLabel.toLowerCase().includes(query.toLowerCase())
				if (aInLabel && !bInLabel) return -1
				if (!aInLabel && bInLabel) return 1
				return 0
			},
		],
	})

	// Get fuzzy matching items with case-insensitive search
	const fuzzyResults = fzf.find(query.toLowerCase())
	const results = new Map<string, SearchableItem[]>()

	// Group results by section
	fuzzyResults.forEach((result) => {
		const item = result.item.original
		const sectionMatches = results.get(item.sectionId) || []
		sectionMatches.push(item)
		results.set(item.sectionId, sectionMatches)
	})

	// Convert to array format
	return Array.from(results.entries()).map(([sectionId, matches]) => ({
		sectionId,
		matches,
	}))
}

/**
 * Scrolls to a specific setting element and highlights it temporarily
 * @param settingId - The ID of the setting to scroll to
 * @returns true if the element was found and scrolled to, false otherwise
 */
export const scrollToSetting = (settingId: string): boolean => {
	// Find the element with the data-setting-id attribute
	const element = document.querySelector(`[data-setting-id="${settingId}"]`)

	if (!element) {
		console.warn(`Setting element with id "${settingId}" not found`)
		return false
	}

	// Scroll the element into view
	element.scrollIntoView({
		behavior: "smooth",
		block: "center",
	})

	// Add highlight class for animation
	element.classList.add("setting-highlight")

	// Remove the highlight class after animation completes
	setTimeout(() => {
		element.classList.remove("setting-highlight")
	}, 2000)

	return true
}
