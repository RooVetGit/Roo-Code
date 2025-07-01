import "@testing-library/jest-dom"
import "@testing-library/jest-dom/vitest"

// Create shared translation function to avoid duplication
const createTranslationFunction = () => (key: string, options?: Record<string, any>) => {
	// File changes translations
	if (key === "file-changes:summary.count_with_changes") {
		return `(${options?.count || 0}) Files Changed${options?.changes || ""}`
	}
	if (key === "file-changes:header.expand") {
		return "Expand files list"
	}
	if (key === "file-changes:header.collapse") {
		return "Collapse files list"
	}
	if (key === "file-changes:actions.accept_all") {
		return "Accept All"
	}
	if (key === "file-changes:actions.reject_all") {
		return "Reject All"
	}
	if (key === "file-changes:actions.view_diff") {
		return "View Diff"
	}
	if (key === "file-changes:actions.accept_file") {
		return "Accept changes for this file"
	}
	if (key === "file-changes:actions.reject_file") {
		return "Reject changes for this file"
	}
	if (key === "file-changes:file_types.edit") {
		return "edit"
	}
	if (key === "file-changes:file_types.create") {
		return "create"
	}
	if (key === "file-changes:file_types.delete") {
		return "delete"
	}
	if (key === "file-changes:line_changes.added") {
		return `+${options?.count || 0} lines`
	}
	if (key === "file-changes:line_changes.removed") {
		return `-${options?.count || 0} lines`
	}
	if (key === "file-changes:line_changes.added_removed") {
		return `+${options?.added || 0}, -${options?.removed || 0} lines`
	}
	if (key === "file-changes:line_changes.deleted") {
		return "deleted"
	}
	if (key === "file-changes:line_changes.modified") {
		return "modified"
	}
	if (key === "file-changes:accessibility.files_list") {
		return `Files list. ${options?.count || 0} files. ${options?.state || ""}`
	}
	if (key === "file-changes:accessibility.expanded") {
		return "Expanded"
	}
	if (key === "file-changes:accessibility.collapsed") {
		return "Collapsed"
	}
	// Common translations
	if (key === "common:ui.search_placeholder") {
		return "Search..."
	}
	// Default fallback - return the key for debugging
	return key
}

// Create comprehensive i18n mock object that includes all methods that might be used
const createI18nMock = (translateFn: (key: string, options?: Record<string, any>) => string) => ({
	t: translateFn,
	changeLanguage: vi.fn(() => Promise.resolve()),
	language: "en",
	languages: ["en"],
	exists: vi.fn(() => true),
	getFixedT: vi.fn(() => translateFn),
	hasResourceBundle: vi.fn(() => true),
	loadNamespaces: vi.fn(() => Promise.resolve()),
	loadLanguages: vi.fn(() => Promise.resolve()),
	loadResources: vi.fn(() => Promise.resolve()),
	reloadResources: vi.fn(() => Promise.resolve()),
	setDefaultNamespace: vi.fn(),
	getResource: vi.fn(() => ({})),
	addResource: vi.fn(),
	addResources: vi.fn(),
	addResourceBundle: vi.fn(),
	getResourceBundle: vi.fn(() => ({})),
	removeResourceBundle: vi.fn(),
	on: vi.fn(),
	off: vi.fn(),
	emit: vi.fn(),
	services: {},
	options: {},
	modules: {},
	isInitialized: true,
	initializedStoreOnce: true,
	init: vi.fn(() => Promise.resolve(translateFn)),
	use: vi.fn(),
	cloneInstance: vi.fn(),
	createInstance: vi.fn(),
	dir: vi.fn(() => "ltr"),
	format: vi.fn(() => ""),
	getDataByLanguage: vi.fn(() => ({})),
})

// Mock react-i18next for tests
vi.mock("react-i18next", () => {
	const t = createTranslationFunction()
	const i18n = createI18nMock(t)

	return {
		useTranslation: () => ({
			t,
			i18n,
		}),
		Trans: ({ children }: { children: React.ReactNode }) => children,
		initReactI18next: {
			type: "3rdParty",
			init: vi.fn(),
		},
	}
})

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.ResizeObserver = MockResizeObserver

// Fix for Microsoft FAST Foundation compatibility with JSDOM
// FAST Foundation tries to set HTMLElement.focus property, but it's read-only in JSDOM
// The issue is that FAST Foundation's handleUnsupportedDelegatesFocus tries to set element.focus = originalFocus
// but JSDOM's HTMLElement.focus is a getter-only property
Object.defineProperty(HTMLElement.prototype, "focus", {
	get: function () {
		return (
			this._focus ||
			function () {
				// Mock focus behavior for tests
			}
		)
	},
	set: function (value) {
		this._focus = value
	},
	configurable: true,
})

Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = vi.fn()

// Suppress console.log during tests to reduce noise.
// Keep console.error for actual errors.
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const originalConsoleInfo = console.info

console.log = () => {}
console.warn = () => {}
console.info = () => {}

afterAll(() => {
	console.log = originalConsoleLog
	console.warn = originalConsoleWarn
	console.info = originalConsoleInfo
})
