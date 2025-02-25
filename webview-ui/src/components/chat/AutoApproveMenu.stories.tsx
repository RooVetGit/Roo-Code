import type { Meta, StoryObj } from "@storybook/react"
import AutoApproveMenu from "./AutoApproveMenu"
import { PreviewExtensionStateContextProvider } from "../../../.storybook/preview-context" // Import PreviewExtensionStateContextProvider

const meta: Meta<typeof AutoApproveMenu> = {
	title: "Chat/AutoApproveMenu",
	component: AutoApproveMenu,
	parameters: {
		layout: "fullscreen",
	},
}

export default meta
type Story = StoryObj<typeof AutoApproveMenu>

// Replace withInteractiveState decorator with PreviewExtensionStateContextProvider
export const Default: Story = {
	decorators: [
		(
			Story, // Use PreviewExtensionStateContextProvider as decorator
		) => (
			<PreviewExtensionStateContextProvider>
				<div
					style={{
						background: "var(--vscode-editor-background)",
						color: "var(--vscode-editor-foreground)",
						padding: "20px",
						minHeight: "100vh",
						display: "flex",
						flexDirection: "column",
						gap: "20px",
					}}>
					<Story />
					<div style={{ height: "80vh" }} /> {/* Spacer to test modal positioning */}
				</div>
			</PreviewExtensionStateContextProvider>
		),
	],
}

// Test overflow behavior with a narrow container
export const NarrowContainer: Story = {
	decorators: [
		(
			Story, // Use PreviewExtensionStateContextProvider as decorator
		) => (
			<PreviewExtensionStateContextProvider>
				<div style={{ maxWidth: "400px" }}>
					<Story />
				</div>
			</PreviewExtensionStateContextProvider>
		),
	],
}

// Test overflow behavior with a very narrow container
export const VeryNarrowContainer: Story = {
	decorators: [
		(
			Story, // Use PreviewExtensionStateContextProvider as decorator
		) => (
			<PreviewExtensionStateContextProvider>
				<div style={{ maxWidth: "300px" }}>
					<Story />
				</div>
			</PreviewExtensionStateContextProvider>
		),
	],
}
