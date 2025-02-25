import React from "react"
import type { Preview, StoryFn } from "@storybook/react"
import { themes } from "@storybook/theming"
import "./preview.css"
import "@vscode/codicons/dist/codicon.css"
import { PreviewExtensionStateContextProvider } from "./preview-context"

const preview: Preview = {
	parameters: {
		actions: { argTypesRegex: "^on.*" },
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/,
			},
		},
		darkMode: {
			dark: { ...themes.dark },
			light: { ...themes.light },
			current: "dark",
		},
	},
	decorators: [
		(Story: StoryFn) => {
			return (
				<PreviewExtensionStateContextProvider>
					<Story />
				</PreviewExtensionStateContextProvider>
			)
		},
	],
}

export default preview
