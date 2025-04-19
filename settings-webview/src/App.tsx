import { useState, useEffect } from "react"
import { MemoryRouter as Router, Routes, Route } from "react-router-dom"
import SettingsView from "./components/SettingsView"

// Define the VS Code API
declare global {
	interface Window {
		vscode?: {
			postMessage: (message: unknown) => void
			getState: () => unknown
			setState: (state: unknown) => void
		}
	}
}

// Use the global vscode object that was set in the HTML
const vscode = window.vscode || {
	postMessage: (message: unknown) => console.log("VS Code message:", message),
	getState: () => ({}),
	setState: () => {},
}

// Define the message type for communication with the extension
interface VSCodeMessage {
	type: string
	[key: string]: unknown
}

function App() {
	const [initialized, setInitialized] = useState<boolean>(false)
	const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
		// Initialize theme from localStorage if available
		const savedTheme = localStorage.getItem("vscode-theme-preference")
		return savedTheme ? JSON.parse(savedTheme) : false
	})

	// Save theme preference whenever it changes
	useEffect(() => {
		localStorage.setItem("vscode-theme-preference", JSON.stringify(isDarkTheme))
	}, [isDarkTheme])

	useEffect(() => {
		// Setup message handler from extension to webview
		window.addEventListener("message", (event) => {
			const message = event.data as VSCodeMessage
			console.log("Received message:", message)
			switch (message.type) {
				case "init":
					console.log("Initializing settings webview")
					setInitialized(true)
					break
				case "theme":
					try {
						const themeText = message.text as string
						const themeData = JSON.parse(themeText)
						setIsDarkTheme(themeData.kind === "dark" || themeData.kind === "highContrast")
					} catch (error) {
						console.error("Error parsing theme data:", error)
					}
					break
				default:
					console.log("Unhandled message:", message)
			}
		})

		// Notify the extension that the webview is ready
		console.log("Sending webviewDidLaunch message")
		vscode.postMessage({ type: "webviewDidLaunch" })
	}, [])

	return (
		<Router initialEntries={["/"]} initialIndex={0}>
			<div className="w-full h-screen box-border flex flex-col overflow-hidden bg-vscode-bg text-vscode-fg">
				{!initialized ? (
					<div className="p-5">Loading settings...</div>
				) : (
					<Routes>
						<Route path="/" element={<SettingsView />} />
					</Routes>
				)}
			</div>
		</Router>
	)
}

export default App
