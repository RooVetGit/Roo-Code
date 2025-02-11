import { useCallback, useEffect, useState } from "react"
import { useEvent } from "react-use"

import { vscode } from "./utils/vscode"
import { ExtensionMessage } from "../../src/shared/ExtensionMessage"
import { ExtensionStateContextProvider, useExtensionState } from "./context/ExtensionStateContext"
import ChatView from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import SettingsView from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeView"
import McpView from "./components/mcp/McpView"
import PromptsView from "./components/prompts/PromptsView"
import { ResearchView } from "./components/research/ResearchView"

type Tab = "settings" | "history" | "mcp" | "prompts" | "research" | "chat"

const tabsByMessageAction: Partial<Record<NonNullable<ExtensionMessage["action"]>, Tab>> = {
	chatButtonClicked: "chat",
	researchButtonClicked: "research",
	settingsButtonClicked: "settings",
	promptsButtonClicked: "prompts",
	mcpButtonClicked: "mcp",
	historyButtonClicked: "history",
}

const App = () => {
	const { didHydrateState, showWelcome, shouldShowAnnouncement } = useExtensionState()
	const [showAnnouncement, setShowAnnouncement] = useState(false)
	const [tab, setTab] = useState<Tab>("chat")

	const onMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		console.log(`[App#onMessage] type=${message.type}`)

		if (message.type === "action" && message.action) {
			const newTab = tabsByMessageAction[message.action]

			if (newTab) {
				setTab(newTab)
			}
		}
	}, [])

	useEvent("message", onMessage)

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)
			vscode.postMessage({ type: "didShowAnnouncement" })
		}
	}, [shouldShowAnnouncement])

	if (!didHydrateState) {
		return null
	}

	// Do not conditionally load ChatView, it's expensive and there's state we
	// don't want to lose (user input, disableInput, askResponse promise, etc.)

	return showWelcome ? (
		<WelcomeView />
	) : (
		<>
			{tab === "settings" && <SettingsView onDone={() => setTab("chat")} />}
			{tab === "history" && <HistoryView onDone={() => setTab("chat")} />}
			{tab === "mcp" && <McpView onDone={() => setTab("chat")} />}
			{tab === "prompts" && <PromptsView onDone={() => setTab("chat")} />}
			<ResearchView isHidden={tab !== "research"} onDone={() => setTab("chat")} />
			<ChatView
				isHidden={tab !== "chat"}
				showAnnouncement={showAnnouncement}
				hideAnnouncement={() => setShowAnnouncement(false)}
				showHistoryView={() => setTab("history")}
			/>
		</>
	)
}

const AppWithProviders = () => (
	<ExtensionStateContextProvider>
		<App />
	</ExtensionStateContextProvider>
)

export default AppWithProviders
