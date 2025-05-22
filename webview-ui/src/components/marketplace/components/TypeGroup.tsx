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

	// Determine if we should use horizontal layout (modes only for now) or card layout (for mcps)
	const isHorizontalLayout = type === "mode"

	// Memoize the list items
	const listItems = useMemo(() => {
		if (!items?.length) return null

		if (isHorizontalLayout) {
			// Horizontal layout for modes
			return (
				<div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] mt-2 gap-1.5">
					{items.map((item, index) => {
						const cardClassName = cn(
							"flex items-center gap-2 py-1 px-2 rounded-md bg-vscode-input-background/50",
							"hover:border-vscode-focusBorder transition-colors",
							{
								"border-vscode-textLink": item.matchInfo?.matched,
								"border-vscode-panel-border": !item.matchInfo?.matched,
							},
						)

						return (
							<div
								key={`${item.path || index}`}
								className={cardClassName}
								title={item.description || item.name}>
								<span
									className={cn("font-medium text-sm", {
										"text-vscode-textLink": item.matchInfo?.matched,
										"text-vscode-foreground": !item.matchInfo?.matched,
									})}>
									{item.name}
								</span>
								{item.matchInfo?.matched && (
									<span className="text-xs bg-vscode-badge-background text-vscode-badge-foreground px-1 py-0.5 rounded">
										{t("marketplace:type-group.match")}
									</span>
								)}
							</div>
						)
					})}
				</div>
			)
		} else {
			return (
				<div className="grid grid-cols-1 gap-3 mt-2">
					{items.map((item, index) => (
						<div key={`${item.path || index}`} className="bg-vscode-input-background/50 p-2 rounded-sm">
							<div className="flex items-center gap-2 mb-1">
								<h5
									className={cn(
										"text-sm font-medium m-0",
										item.matchInfo?.matched ? "text-vscode-textLink" : "text-vscode-foreground",
									)}>
									{item.name}
								</h5>
								{item.matchInfo?.matched && (
									<span className="ml-auto text-xs bg-vscode-badge-background text-vscode-badge-foreground px-1 py-0.5 rounded">
										{t("marketplace:type-group.match")}
									</span>
								)}
							</div>
							{item.description && (
								<p className="text-sm text-vscode-descriptionForeground m-0 ml-4">{item.description}</p>
							)}
						</div>
					))}
				</div>
			)
		}
	}, [items, t, isHorizontalLayout])

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
