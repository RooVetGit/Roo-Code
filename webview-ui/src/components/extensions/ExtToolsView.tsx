import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import ExtToolRow from "./ExtToolRow"

// Sample extension type (should be defined in shared types)
type ExtensionWithTools = {
	id: string
	name: string
	tools?: Array<{
		name: string
		description?: string
		alwaysAllow?: boolean
		inputSchema?: {
			properties?: Record<string, any>
			required?: string[]
		}
	}>
	disabled?: boolean
}

type ExtToolsViewProps = {
	onDone: () => void
}

const ExtToolsView = ({ onDone }: ExtToolsViewProps) => {
	// In a real implementation, we would get this from context
	// This is just a placeholder for demonstration
	const [extensions] = useState<ExtensionWithTools[]>([
		{
			id: "example.extension",
			name: "Example Extension",
			tools: [
				{
					name: "sampleTool",
					description: "This is a sample extension tool",
					inputSchema: {
						properties: {
							param1: {
								description: "First parameter",
							},
							param2: {
								description: "Second parameter",
							},
						},
						required: ["param1"],
					},
				},
			],
		},
	])

	const { alwaysAllowExtTools } = useExtensionState()

	const { t } = useAppTranslation()

	return (
		<Tab>
			<TabHeader className="flex justify-between items-center">
				<h3 className="text-vscode-foreground m-0">{t("extTools:title") || "Extension Tools"}</h3>
				<Button onClick={onDone}>{t("mcp:done")}</Button>
			</TabHeader>

			<TabContent>
				<div
					style={{
						color: "var(--vscode-foreground)",
						fontSize: "13px",
						marginBottom: "10px",
						marginTop: "5px",
					}}>
					{t("extTools:description") || "Extension tools allow Roo to interact with VS Code extensions."}
				</div>

				{/* Extension Tools List */}
				{extensions.length > 0 && (
					<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
						{extensions.map((extension) => (
							<ExtensionRow
								key={extension.id}
								extension={extension}
								alwaysAllowExtTools={alwaysAllowExtTools}
							/>
						))}
					</div>
				)}
			</TabContent>
		</Tab>
	)
}

const ExtensionRow = ({
	extension,
	alwaysAllowExtTools,
}: {
	extension: ExtensionWithTools
	alwaysAllowExtTools?: boolean
}) => {
	const { t } = useAppTranslation()
	const [isExpanded, setIsExpanded] = useState(false)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

	const handleRowClick = () => {
		setIsExpanded(!isExpanded)
	}

	return (
		<div style={{ marginBottom: "10px" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					padding: "8px",
					background: "var(--vscode-textCodeBlock-background)",
					cursor: "pointer",
					borderRadius: isExpanded ? "4px 4px 0 0" : "4px",
					opacity: extension.disabled ? 0.6 : 1,
				}}
				onClick={handleRowClick}>
				<span
					className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
					style={{ marginRight: "8px" }}
				/>
				<span style={{ flex: 1 }}>{extension.name}</span>
			</div>

			{isExpanded && (
				<div
					style={{
						background: "var(--vscode-textCodeBlock-background)",
						padding: "0 10px 10px 10px",
						fontSize: "13px",
						borderRadius: "0 0 4px 4px",
					}}>
					<div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
						{extension.tools && extension.tools.length > 0 ? (
							extension.tools.map((tool) => (
								<ExtToolRow
									key={`${tool.name}-${extension.id}`}
									tool={tool}
									extensionId={extension.id}
									alwaysAllowExtTools={alwaysAllowExtTools}
								/>
							))
						) : (
							<div style={{ padding: "10px 0", color: "var(--vscode-descriptionForeground)" }}>
								{t("extTools:noTools") || "No tools found in this extension"}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Delete Confirmation Dialog */}
			<Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("extTools:disableDialog.title") || "Disable Extension"}</DialogTitle>
						<DialogDescription>
							{t("extTools:disableDialog.description", { extensionName: extension.name }) ||
								`Are you sure you want to disable ${extension.name}?`}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
							{t("extTools:disableDialog.cancel") || "Cancel"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export default ExtToolsView
