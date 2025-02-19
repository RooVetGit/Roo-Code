import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App"
import "../../node_modules/@vscode/codicons/dist/codicon.css"
import "./i18n" // Import i18n configuration

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
