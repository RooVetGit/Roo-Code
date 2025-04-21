import type { GlobalSettings } from "@roo/schemas"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

type AutoApproveToggles = Pick<
	GlobalSettings,
	| "alwaysAllowReadOnly"
	| "alwaysAllowWrite"
	| "alwaysAllowBrowser"
	| "alwaysApproveResubmit"
	| "alwaysAllowMcp"
	| "alwaysAllowExtTools"
	| "alwaysAllowModeSwitch"
	| "alwaysAllowSubtasks"
	| "alwaysAllowExecute"
>

export type AutoApproveSetting = keyof AutoApproveToggles

type AutoApproveConfig = {
	key: AutoApproveSetting
	labelKey: string
	descriptionKey: string
	icon: string
	testId: string
	order?: number
}

export const autoApproveSettingsConfig: Record<AutoApproveSetting, AutoApproveConfig> = {
	alwaysAllowReadOnly: {
		key: "alwaysAllowReadOnly",
		labelKey: "settings:autoApprove.readOnly.label",
		descriptionKey: "settings:autoApprove.readOnly.description",
		icon: "eye",
		testId: "always-allow-readonly-toggle",
		order: 1,
	},
	alwaysAllowWrite: {
		key: "alwaysAllowWrite",
		labelKey: "settings:autoApprove.write.label",
		descriptionKey: "settings:autoApprove.write.description",
		icon: "edit",
		testId: "always-allow-write-toggle",
		order: 2,
	},
	alwaysAllowBrowser: {
		key: "alwaysAllowBrowser",
		labelKey: "settings:autoApprove.browser.label",
		descriptionKey: "settings:autoApprove.browser.description",
		icon: "globe",
		testId: "always-allow-browser-toggle",
		order: 3,
	},
	alwaysApproveResubmit: {
		key: "alwaysApproveResubmit",
		labelKey: "settings:autoApprove.retry.label",
		descriptionKey: "settings:autoApprove.retry.description",
		icon: "refresh",
		testId: "always-approve-resubmit-toggle",
		order: 4,
	},
	alwaysAllowMcp: {
		key: "alwaysAllowMcp",
		labelKey: "settings:autoApprove.mcp.label",
		descriptionKey: "settings:autoApprove.mcp.description",
		icon: "plug",
		testId: "always-allow-mcp-toggle",
		order: 5,
	},
	alwaysAllowExtTools: {
		key: "alwaysAllowExtTools",
		labelKey: "settings:autoApprove.ext.label",
		descriptionKey: "settings:autoApprove.ext.description",
		icon: "extensions",
		testId: "always-allow-ext-tools-toggle",
		order: 6,
	},
	alwaysAllowModeSwitch: {
		key: "alwaysAllowModeSwitch",
		labelKey: "settings:autoApprove.modeSwitch.label",
		descriptionKey: "settings:autoApprove.modeSwitch.description",
		icon: "sync",
		testId: "always-allow-mode-switch-toggle",
		order: 7,
	},
	alwaysAllowSubtasks: {
		key: "alwaysAllowSubtasks",
		labelKey: "settings:autoApprove.subtasks.label",
		descriptionKey: "settings:autoApprove.subtasks.description",
		icon: "list-tree",
		testId: "always-allow-subtasks-toggle",
		order: 8,
	},
	alwaysAllowExecute: {
		key: "alwaysAllowExecute",
		labelKey: "settings:autoApprove.execute.label",
		descriptionKey: "settings:autoApprove.execute.description",
		icon: "terminal",
		testId: "always-allow-execute-toggle",
		order: 9,
	},
}

type AutoApproveToggleProps = AutoApproveToggles & {
	onToggle: (key: AutoApproveSetting, value: boolean) => void
}

export const AutoApproveToggle = ({ onToggle, ...props }: AutoApproveToggleProps) => {
	const { t } = useAppTranslation()

	// Sort buttons by order property
	const orderedSettings = Object.values(autoApproveSettingsConfig).sort((a, b) => (a.order || 0) - (b.order || 0))

	return (
		<div
			className={cn(
				"grid grid-cols-3 gap-3 w-full mx-auto my-2",
				"[@media(min-width:600px)]:grid-cols-4 [@media(min-width:600px)]:gap-4",
				"[@media(min-width:800px)]:grid-cols-5",
				"[@media(min-width:1200px)]:grid-cols-5",
			)}>
			{orderedSettings.map(({ key, descriptionKey, labelKey, icon, testId }) => (
				<Button
					key={key}
					variant={props[key] ? "default" : "outline"}
					onClick={() => onToggle(key, !props[key])}
					title={t(descriptionKey || "")}
					aria-label={t(labelKey)}
					aria-pressed={!!props[key]}
					data-testid={testId}
					className={cn(" aspect-square h-[80px]", !props[key] && "opacity-50")}>
					<span className={cn("flex flex-col items-center gap-1")}>
						<span className={`codicon codicon-${icon}`} />
						<span className="text-sm text-center">{t(labelKey)}</span>
					</span>
				</Button>
			))}
		</div>
	)
}
