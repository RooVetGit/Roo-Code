import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Bell } from "lucide-react"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { Slider } from "../ui"

type NotificationSettingsProps = HTMLAttributes<HTMLDivElement> & {
	ttsEnabled?: boolean
	ttsSpeed?: number
	soundEnabled?: boolean
	soundVolume?: number
	desktopNotificationsEnabled?: boolean
	showApprovalRequests?: boolean
	showErrors?: boolean
	showTaskCompletion?: boolean
	showUserInputRequired?: boolean
	showSessionTimeouts?: boolean
	notificationTimeout?: number
	desktopNotificationSound?: boolean
	setCachedStateField: SetCachedStateField<
		| "ttsEnabled"
		| "ttsSpeed"
		| "soundEnabled"
		| "soundVolume"
		| "desktopNotificationsEnabled"
		| "showApprovalRequests"
		| "showErrors"
		| "showTaskCompletion"
		| "showUserInputRequired"
		| "showSessionTimeouts"
		| "notificationTimeout"
		| "desktopNotificationSound"
	>
}

export const NotificationSettings = ({
	ttsEnabled,
	ttsSpeed,
	soundEnabled,
	soundVolume,
	desktopNotificationsEnabled,
	showApprovalRequests,
	showErrors,
	showTaskCompletion,
	showUserInputRequired,
	showSessionTimeouts,
	notificationTimeout,
	desktopNotificationSound,
	setCachedStateField,
	...props
}: NotificationSettingsProps) => {
	const { t } = useAppTranslation()
	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Bell className="w-4" />
					<div>{t("settings:sections.notifications")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<VSCodeCheckbox
						checked={desktopNotificationsEnabled}
						onChange={(e: any) => setCachedStateField("desktopNotificationsEnabled", e.target.checked)}
						data-testid="desktop-notifications-enabled-checkbox">
						<span className="font-medium">{t("settings:notifications.desktop.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:notifications.desktop.description")}
					</div>
				</div>

				{desktopNotificationsEnabled && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<div>
							<VSCodeCheckbox
								checked={showApprovalRequests}
								onChange={(e: any) => setCachedStateField("showApprovalRequests", e.target.checked)}
								data-testid="show-approval-requests-checkbox">
								<span className="font-medium">
									{t("settings:notifications.desktop.showApprovalRequests.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:notifications.desktop.showApprovalRequests.description")}
							</div>
						</div>

						<div>
							<VSCodeCheckbox
								checked={showErrors}
								onChange={(e: any) => setCachedStateField("showErrors", e.target.checked)}
								data-testid="show-errors-checkbox">
								<span className="font-medium">
									{t("settings:notifications.desktop.showErrors.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:notifications.desktop.showErrors.description")}
							</div>
						</div>

						<div>
							<VSCodeCheckbox
								checked={showTaskCompletion}
								onChange={(e: any) => setCachedStateField("showTaskCompletion", e.target.checked)}
								data-testid="show-task-completion-checkbox">
								<span className="font-medium">
									{t("settings:notifications.desktop.showTaskCompletion.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:notifications.desktop.showTaskCompletion.description")}
							</div>
						</div>

						<div>
							<VSCodeCheckbox
								checked={showUserInputRequired}
								onChange={(e: any) => setCachedStateField("showUserInputRequired", e.target.checked)}
								data-testid="show-user-input-required-checkbox">
								<span className="font-medium">
									{t("settings:notifications.desktop.showUserInputRequired.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:notifications.desktop.showUserInputRequired.description")}
							</div>
						</div>

						<div>
							<VSCodeCheckbox
								checked={showSessionTimeouts}
								onChange={(e: any) => setCachedStateField("showSessionTimeouts", e.target.checked)}
								data-testid="show-session-timeouts-checkbox">
								<span className="font-medium">
									{t("settings:notifications.desktop.showSessionTimeouts.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:notifications.desktop.showSessionTimeouts.description")}
							</div>
						</div>

						<div>
							<label className="block font-medium mb-1">
								{t("settings:notifications.desktop.timeout.label")}
							</label>
							<div className="text-vscode-descriptionForeground text-sm mb-2">
								{t("settings:notifications.desktop.timeout.description")}
							</div>
							<div className="flex items-center gap-2">
								<Slider
									min={0}
									max={60}
									step={1}
									value={[notificationTimeout ?? 10]}
									onValueChange={([value]) => setCachedStateField("notificationTimeout", value)}
									data-testid="notification-timeout-slider"
								/>
								<span className="w-16">{notificationTimeout ?? 10}s</span>
							</div>
						</div>

						<div>
							<VSCodeCheckbox
								checked={desktopNotificationSound}
								onChange={(e: any) => setCachedStateField("desktopNotificationSound", e.target.checked)}
								data-testid="desktop-notification-sound-checkbox">
								<span className="font-medium">{t("settings:notifications.desktop.sound.label")}</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:notifications.desktop.sound.description")}
							</div>
						</div>
					</div>
				)}

				<div>
					<VSCodeCheckbox
						checked={ttsEnabled}
						onChange={(e: any) => setCachedStateField("ttsEnabled", e.target.checked)}
						data-testid="tts-enabled-checkbox">
						<span className="font-medium">{t("settings:notifications.tts.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:notifications.tts.description")}
					</div>
				</div>

				{ttsEnabled && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<div>
							<label className="block font-medium mb-1">
								{t("settings:notifications.tts.speedLabel")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={0.1}
									max={2.0}
									step={0.01}
									value={[ttsSpeed ?? 1.0]}
									onValueChange={([value]) => setCachedStateField("ttsSpeed", value)}
									data-testid="tts-speed-slider"
								/>
								<span className="w-10">{((ttsSpeed ?? 1.0) * 100).toFixed(0)}%</span>
							</div>
						</div>
					</div>
				)}

				<div>
					<VSCodeCheckbox
						checked={soundEnabled}
						onChange={(e: any) => setCachedStateField("soundEnabled", e.target.checked)}
						data-testid="sound-enabled-checkbox">
						<span className="font-medium">{t("settings:notifications.sound.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:notifications.sound.description")}
					</div>
				</div>

				{soundEnabled && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<div>
							<label className="block font-medium mb-1">
								{t("settings:notifications.sound.volumeLabel")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={0}
									max={1}
									step={0.01}
									value={[soundVolume ?? 0.5]}
									onValueChange={([value]) => setCachedStateField("soundVolume", value)}
									data-testid="sound-volume-slider"
								/>
								<span className="w-10">{((soundVolume ?? 0.5) * 100).toFixed(0)}%</span>
							</div>
						</div>
					</div>
				)}
			</Section>
		</div>
	)
}
