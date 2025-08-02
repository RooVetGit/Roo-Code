import { useState, memo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@src/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

interface HierarchicalMemoryModalProps {
	isOpen: boolean
	onClose: () => void
	memories: Array<{ path: string; content: string }>
}

const HierarchicalMemoryModal = ({ isOpen, onClose, memories }: HierarchicalMemoryModalProps) => {
	const { t } = useAppTranslation()
	const [selectedMemoryIndex, setSelectedMemoryIndex] = useState(0)

	if (!memories || memories.length === 0) {
		return (
			<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
				<DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
					<DialogHeader>
						<DialogTitle>{t("chat:hierarchicalMemory.title")}</DialogTitle>
						<DialogDescription>{t("chat:hierarchicalMemory.noMemories")}</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>
		)
	}

	const selectedMemory = memories[selectedMemoryIndex]

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle>{t("chat:hierarchicalMemory.title")}</DialogTitle>
					<DialogDescription>
						{t("chat:hierarchicalMemory.description", { count: memories.length })}
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 flex gap-4 min-h-0">
					{/* Memory list sidebar */}
					<div className="w-64 flex-shrink-0 border-r border-vscode-editorGroup-border pr-4">
						<h3 className="text-sm font-medium mb-2 text-vscode-foreground">
							{t("chat:hierarchicalMemory.loadedFiles")}
						</h3>
						<div className="space-y-1 overflow-y-auto max-h-[calc(80vh-200px)]">
							{memories.map((memory, index) => {
								const fileName = memory.path.split("/").pop() || memory.path
								const dirPath = memory.path.substring(0, memory.path.lastIndexOf("/")) || "/"

								return (
									<button
										key={memory.path}
										onClick={() => setSelectedMemoryIndex(index)}
										className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
											index === selectedMemoryIndex
												? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
												: "hover:bg-vscode-list-hoverBackground"
										}`}>
										<div className="font-medium truncate" title={fileName}>
											{fileName}
										</div>
										<div
											className="text-xs text-vscode-descriptionForeground truncate"
											title={dirPath}>
											{dirPath}
										</div>
									</button>
								)
							})}
						</div>
					</div>

					{/* Memory content viewer */}
					<div className="flex-1 flex flex-col min-w-0">
						<div className="flex items-center justify-between mb-2">
							<h3
								className="text-sm font-medium text-vscode-foreground truncate"
								title={selectedMemory.path}>
								{selectedMemory.path}
							</h3>
							<VSCodeButton
								appearance="icon"
								onClick={() => {
									navigator.clipboard.writeText(selectedMemory.content)
								}}
								title={t("chat:hierarchicalMemory.copyContent")}>
								<span className="codicon codicon-copy"></span>
							</VSCodeButton>
						</div>
						<div className="flex-1 overflow-auto bg-vscode-editor-background rounded border border-vscode-editorGroup-border p-4">
							<pre className="text-xs font-mono text-vscode-editor-foreground whitespace-pre-wrap">
								{selectedMemory.content}
							</pre>
						</div>
					</div>
				</div>

				<div className="flex justify-end mt-4">
					<VSCodeButton onClick={onClose}>{t("common:answers.close")}</VSCodeButton>
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default memo(HierarchicalMemoryModal)
