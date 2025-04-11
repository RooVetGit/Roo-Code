import { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { FluentProvider, webLightTheme, webDarkTheme } from "@fluentui/react-components"
import SettingsView from "./components/SettingsView"
import "./App.css"

function App() {
	const [initialized, setInitialized] = useState<boolean>(false)
	const [isDarkTheme, setIsDarkTheme] = useState<boolean>(document.body.classList.contains("vscode-dark"))

	// Use the built-in themes based on VS Code's theme
	const theme = isDarkTheme ? webDarkTheme : webLightTheme

	useEffect(() => {
		// Setup message handler from extension to webview
		window.addEventListener("message", (event) => {
			const message = event.data
			switch (message.type) {
				case "init":
					setInitialized(true)
					break
				case "theme":
					try {
						const themeData = JSON.parse(message.text)
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
		vscode.postMessage({ type: "webviewDidLaunch" })
	}, [])

	return (
		<FluentProvider theme={theme}>
			<Router>
				<div className="app-container">
					{!initialized ? (
						<div style={{ padding: "20px" }}>Loading settings...</div>
					) : (
						<Routes>
							<Route path="/" element={<SettingsView />} />
						</Routes>
					)}
				</div>
			</Router>
		</FluentProvider>
	)
}

export default App
