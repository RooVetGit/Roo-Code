import React from "react"
import { VSCodeCheckbox, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "../../i18n/TranslationContext"
import { vscode } from "../../utils/vscode"

interface SilentModeSettingsProps {
	silentMode: boolean
	silentModeAutoActivate?: boolean
	silentModeNotifications?: boolean
	silentModeSound?: boolean
	silentModeAutoApply?: boolean
	silentModeBufferSize?: number
	silentModeInactivityDelay?: number
	setCachedStateField: (field: string, value: any) => void
}

export const SilentModeSettings: React.FC<SilentModeSettingsProps> = ({
	silentMode,
	silentModeAutoActivate = true,
	silentModeNotifications = true,
	silentModeSound = true,
	silentModeAutoApply = false,
	silentModeBufferSize = 50,
	silentModeInactivityDelay = 30,
	setCachedStateField,
}) => {
	const { t } = useAppTranslation()

	const handleTestNotification = () => {
		vscode.postMessage({
			type: "silentModeTaskCompleted",
			summary: {
				filesChanged: 3,
				linesAdded: 25,
				linesRemoved: 8,
				changes: [],
			},
		})
	}

	return (
		<div className="space-y-6">
			{/* Main Silent Mode Toggle */}
			<div>
				<VSCodeCheckbox
					checked={silentMode}
					onChange={(e: any) => setCachedStateField("silentMode", e.target.checked)}
					data-testid="silent-mode-checkbox">
					<span className="font-medium text-base">{t("settings:silentMode.enable.label")}</span>
				</VSCodeCheckbox>
				<div className="text-vscode-descriptionForeground text-sm mt-1">
					{t("settings:silentMode.enable.description")}
				</div>
			</div>

			{silentMode && (
				<div className="pl-6 border-l-2 border-vscode-button-background space-y-4">
					{/* Auto-activation */}
					<div>
						<VSCodeCheckbox
							checked={silentModeAutoActivate}
							onChange={(e: any) => setCachedStateField("silentModeAutoActivate", e.target.checked)}
							data-testid="silent-mode-auto-activate-checkbox">
							<span className="font-medium">{t("settings:silentMode.autoActivate.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							{t("settings:silentMode.autoActivate.description")}
						</div>
					</div>

					{/* Inactivity delay for auto-activation */}
					{silentModeAutoActivate && (
						<div className="ml-6">
							<label className="block font-medium mb-2">
								{t("settings:silentMode.inactivityDelay.label")}
							</label>
							<div className="flex items-center gap-3">
								<input
									type="range"
									min={5}
									max={300}
									value={silentModeInactivityDelay}
									onChange={(e: any) =>
										setCachedStateField("silentModeInactivityDelay", parseInt(e.target.value))
									}
									className="flex-1"
									data-testid="silent-mode-inactivity-delay-slider"
									style={{
										background: "var(--vscode-scrollbarSlider-background)",
										height: "4px",
										borderRadius: "2px",
										outline: "none",
										cursor: "pointer",
									}}
								/>
								<span className="w-12 text-sm">{silentModeInactivityDelay}s</span>
							</div>
							<div className="text-vscode-descriptionForeground text-xs mt-1">
								{t("settings:silentMode.inactivityDelay.description")}
							</div>
						</div>
					)}

					{/* Notifications */}
					<div>
						<VSCodeCheckbox
							checked={silentModeNotifications}
							onChange={(e: any) => setCachedStateField("silentModeNotifications", e.target.checked)}
							data-testid="silent-mode-notifications-checkbox">
							<span className="font-medium">{t("settings:silentMode.notifications.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							{t("settings:silentMode.notifications.description")}
						</div>
					</div>

					{/* Completion sound */}
					<div className="ml-6">
						<VSCodeCheckbox
							checked={silentModeSound}
							onChange={(e: any) => setCachedStateField("silentModeSound", e.target.checked)}
							disabled={!silentModeNotifications}
							data-testid="silent-mode-sound-checkbox">
							<span className="font-medium">{t("settings:silentMode.sound.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							{t("settings:silentMode.sound.description")}
						</div>
					</div>

					{/* Auto-apply changes */}
					<div>
						<VSCodeCheckbox
							checked={silentModeAutoApply}
							onChange={(e: any) => setCachedStateField("silentModeAutoApply", e.target.checked)}
							data-testid="silent-mode-auto-apply-checkbox">
							<span className="font-medium">{t("settings:silentMode.autoApply.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							{t("settings:silentMode.autoApply.description")}
						</div>
						{silentModeAutoApply && (
							<div className="text-vscode-editorWarning-foreground text-xs mt-1">
								⚠️ {t("settings:silentMode.autoApply.warning")}
							</div>
						)}
					</div>

					{/* Buffer size */}
					<div>
						<label className="block font-medium mb-2">{t("settings:silentMode.bufferSize.label")}</label>
						<div className="flex items-center gap-3">
							<input
								type="range"
								min={10}
								max={200}
								value={silentModeBufferSize}
								onChange={(e: any) =>
									setCachedStateField("silentModeBufferSize", parseInt(e.target.value))
								}
								className="flex-1"
								data-testid="silent-mode-buffer-size-slider"
								style={{
									background: "var(--vscode-scrollbarSlider-background)",
									height: "4px",
									borderRadius: "2px",
									outline: "none",
									cursor: "pointer",
								}}
							/>
							<span className="w-16 text-sm">{silentModeBufferSize} files</span>
						</div>
						<div className="text-vscode-descriptionForeground text-xs mt-1">
							{t("settings:silentMode.bufferSize.description")}
						</div>
					</div>

					{/* Test notification */}
					<div>
						<VSCodeButton
							onClick={handleTestNotification}
							disabled={!silentModeNotifications}
							data-testid="test-silent-mode-notification-button">
							{t("settings:silentMode.testNotification.label")}
						</VSCodeButton>
						<div className="text-vscode-descriptionForeground text-xs mt-1">
							{t("settings:silentMode.testNotification.description")}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
