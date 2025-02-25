import { ExtensionStateContextType, ExtensionStateContext } from "../src/context/ExtensionStateContext"
import { McpServer } from "../../src/shared/mcp"
import { ApiConfiguration, ModelInfo } from "../../src/shared/api"
import { HistoryItem } from "../../src/shared/HistoryItem" // Import HistoryItem
import { useContext } from "react"

// Mock ModelInfo
const mockModelInfo: ModelInfo = {
	contextWindow: 2048,
	supportsImages: true,
	supportsPromptCache: true,
	reasoningEffort: "low",
}

// Mock API configuration
const mockApiConfig: ApiConfiguration = {
	apiModelId: "mock-model",
	glamaModelInfo: mockModelInfo,
}

// Mock MCP server
const mockMcpServer: McpServer = {
	name: "mock-server",
	tools: [],
	resources: [],
	resourceTemplates: [],
	disabled: false,
	config: "?",
	status: "disconnected",
}

// Mock task history item (Corrected to match HistoryItem type)
const mockTaskHistoryItem: HistoryItem = {
	id: "mock-task-id",
	ts: Date.now(),
	task: "Sample task",
	tokensIn: 100,
	tokensOut: 200,
	totalCost: 0.5,
}

// Mock file paths and opened tabs (more realistic mock data)
const mockFilePaths: string[] = [
	"/Roo-Code/src/components/chat/ChatTextArea.tsx",
	"/Roo-Code/src/components/common/CodeBlock.tsx",
	"/Roo-Code/webview-ui/.storybook/preview-context.tsx",
]
const mockOpenedTabs: Array<{ label: string; isActive: boolean; path?: string }> = [
	{ label: "ChatTextArea.tsx", isActive: true, path: "/Roo-Code/src/components/chat/ChatTextArea.tsx" },
	{ label: "CodeBlock.tsx", isActive: false, path: "/Roo-Code/src/components/common/CodeBlock.tsx" },
]

const defaultContext: ExtensionStateContextType = {
	// Version and state
	version: "1.0.0",
	didHydrateState: true,
	showWelcome: false,

	// Messages and history
	clineMessages: [],
	taskHistory: [mockTaskHistoryItem],
	shouldShowAnnouncement: false,

	// API and models
	apiConfiguration: mockApiConfig,
	glamaModels: {},
	requestyModels: {},
	openRouterModels: {},
	unboundModels: {},
	openAiModels: [],

	// MCP
	mcpServers: [mockMcpServer],
	mcpEnabled: true,
	enableMcpServerCreation: true,

	// Files and tabs
	filePaths: mockFilePaths,
	openedTabs: mockOpenedTabs,
	currentCheckpoint: undefined,

	// Settings
	mode: "code",
	preferredLanguage: "English",
	requestDelaySeconds: 0,
	rateLimitSeconds: 0,
	writeDelayMs: 0,
	browserViewportSize: "1200x800",
	screenshotQuality: 75,
	terminalOutputLineLimit: 500,
	fuzzyMatchThreshold: 1.0,
	maxOpenTabsContext: 20,

	// Features
	diffEnabled: false,
	checkpointsEnabled: false,
	soundEnabled: false,
	soundVolume: 0.5,
	autoApprovalEnabled: true,

	// Permissions
	alwaysAllowBrowser: true,
	alwaysAllowExecute: true,
	alwaysAllowMcp: true,
	alwaysAllowModeSwitch: true,
	alwaysAllowReadOnly: true,
	alwaysApproveResubmit: true,
	alwaysAllowWrite: true,
	allowedCommands: [],

	// Other state
	customModePrompts: {},
	customSupportPrompts: {},
	experiments: {
		experimentalDiffStrategy: false,
		search_and_replace: false,
		insert_content: false,
		powerSteering: false,
	},
	customModes: [],
	enhancementApiConfigId: undefined,
	currentApiConfigName: "default",
	listApiConfigMeta: [],
	theme: {},

	// Setters
	setApiConfiguration: () => {},
	setCustomInstructions: () => {},
	setAlwaysAllowReadOnly: () => {},
	setAlwaysAllowWrite: () => {},
	setAlwaysAllowExecute: () => {},
	setAlwaysAllowBrowser: () => {},
	setAlwaysAllowMcp: () => {},
	setAlwaysAllowModeSwitch: () => {},
	setShowAnnouncement: () => {},
	setAllowedCommands: () => {},
	setSoundEnabled: () => {},
	setSoundVolume: () => {},
	setDiffEnabled: () => {},
	setCheckpointsEnabled: () => {},
	setBrowserViewportSize: () => {},
	setFuzzyMatchThreshold: () => {},
	setPreferredLanguage: () => {},
	setWriteDelayMs: () => {},
	setScreenshotQuality: () => {},
	setTerminalOutputLineLimit: () => {},
	setMcpEnabled: () => {},
	setEnableMcpServerCreation: () => {},
	setAlwaysApproveResubmit: () => {},
	setRequestDelaySeconds: () => {},
	setRateLimitSeconds: () => {},
	setCurrentApiConfigName: () => {},
	setListApiConfigMeta: () => {},
	onUpdateApiConfig: () => {},
	setMode: () => {},
	setCustomModePrompts: () => {},
	setCustomSupportPrompts: () => {},
	setEnhancementApiConfigId: () => {},
	setExperimentEnabled: () => {},
	setAutoApprovalEnabled: () => {},
	setCustomModes: () => {},
	setMaxOpenTabsContext: () => {},
}

export const PreviewExtensionStateContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	console.log("PreviewExtensionStateContextProvider is rendering!") // Re-add console log
	console.log("Context Value:", defaultContext) // Log context value
	return <ExtensionStateContext.Provider value={defaultContext}>{children}</ExtensionStateContext.Provider>
}

export const usePreviewExtensionState = () => {
	const context = useContext(ExtensionStateContext)
	console.log("useExtensionState Hook Context:", context) // Log context in hook
	return context
}
