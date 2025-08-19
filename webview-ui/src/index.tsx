import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App"
import "../node_modules/@vscode/codicons/dist/codicon.css"

import { getHighlighter } from "./utils/highlighter"

// Prevent service worker registration in VSCode webview context
// VSCode webviews don't support service workers and attempting to register them causes errors
if ("serviceWorker" in navigator) {
	// Override the register method to prevent any service worker registration attempts
	navigator.serviceWorker.register = () => {
		console.warn("Service worker registration is disabled in VSCode webview context")
		return Promise.reject(new Error("Service worker registration is disabled in VSCode webview"))
	}
}

// Initialize Shiki early to hide initialization latency (async)
getHighlighter().catch((error: Error) => console.error("Failed to initialize Shiki highlighter:", error))

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
