import React, { useMemo } from "react"
import { cn } from "@/lib/utils"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Rocket, Server, Package, Sparkles } from "lucide-react"

interface TypeGroupProps {
	type: "mode" | "mcp" | "prompt" | "package" | (string & {})
	items: Array<{
		name: string
		description?: string
		metadata?: any
		path?: string
		matchInfo?: {
			matched: boolean
			matchReason?: Record<string, boolean>
		}
	}>
	className?: string
}

const typeIcons = {
	mode: <Rocket className="size-3" />,
	mcp: <Server className="size-3" />,
	prompt: <Sparkles className="size-3" />,
	package: <Package className="size-3" />,
}

export const TypeGroup: React.FC<TypeGroupProps> = ({ type, items, className }) => {
	const { t } = useAppTranslation()
	const typeLabel = useMemo(() => {
		switch (type) {
			case "mode":
				return t("marketplace:type-group.modes")
			case "mcp":
				return t("marketplace:type-group.mcps")
			case "prompt":
				return t("marketplace:type-group.prompts")
			case "package":
				return t("marketplace:type-group.packages")
			default:
				return t("marketplace:type-group.generic-type", {
					type: type.charAt(0).toUpperCase() + type.slice(1),
				})
		}
	}, [type, t])

	// Get the appropriate icon for the type
	const typeIcon = typeIcons[type as keyof typeof typeIcons] || <Package className="size-3" />

	// Memoize the list items
	const listItems = useMemo(() => {
		if (!items?.length) return null

		if (type === "mode") {
			return (
				<div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] mt-2 gap-1.5">
					{items.map((item, index) => {
						return (
							<div
								key={`${item.path || index}`}
								className={cn(
									"flex items-center justify-between gap-2 py-1 px-2 rounded-md bg-vscode-input-background/50",
									"hover:border-vscode-focusBorder transition-colors border",
									{
										"border-primary border-dashed": item.matchInfo?.matched,
										"border-transparent": !item.matchInfo?.matched,
									},
								)}
								title={item.description || item.name}>
								<span className="font-medium text-sm text-vscode-foreground">{item.name}</span>
							</div>
						)
					})}
				</div>
			)
		} else {
			return (
				<div className="grid grid-cols-1 gap-3 mt-2">
					{items.map((item, index) => (
						<div
							key={`${item.path || index}`}
							className={cn("bg-vscode-input-background/50 p-2 rounded-sm border", {
								"border-primary border-dashed": item.matchInfo?.matched,
								"border-transparent": !item.matchInfo?.matched,
							})}>
							<div className="flex items-center gap-2 mb-2">
								<h5 className="text-sm font-medium m-0 text-vscode-foreground">{item.name}</h5>
							</div>
							{item.description && (
								<p className="text-sm text-vscode-descriptionForeground m-0 ml-4">{item.description}</p>
							)}
						</div>
					))}
				</div>
			)
		}
	}, [items, type])

	if (!items?.length) {
		return null
	}

	return (
		<div className={className}>
			<div className="flex items-center gap-2 bg-vscode-input-background p-1 rounded-sm">
				<div
					className={cn("p-1 rounded-sm", {
						"bg-chart-2 text-vscode-button-foreground": type === "mode",
						"bg-chart-5 text-vscode-button-foreground": type === "mcp",
						"bg-vscode-badge-background text-vscode-badge-foreground": type === "prompt",
						"bg-chart-4 text-vscode-button-foreground": type === "package",
					})}>
					{typeIcon}
				</div>
				<h4 className="text-sm font-medium text-vscode-foreground my-0">{typeLabel}</h4>
			</div>
			{listItems}
		</div>
	)
}
