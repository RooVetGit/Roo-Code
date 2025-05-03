// Test types

// Provider types
export interface ClineState {
	maxReadFileLine?: number
}

export interface ClineProvider {
	getState(): Promise<ClineState>
}

export interface ClineProviderStatic {
	getInstance(): Promise<ClineProvider | null>
}

// Utility types
export interface FormatLanguageUtil {
	(lang: string): string
}

// Global declarations
declare global {
	var cwd: string
	var mode: string
	var language: string | undefined
}

export interface PromptVariables {
	workspace: string
	mode: string
	language: string
	shell: string
	operatingSystem: string
	maxReadFileLine: number
}
