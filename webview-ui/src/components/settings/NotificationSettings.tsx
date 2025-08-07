import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { Bell } from "lucide-react"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { Slider } from "../ui"
import { GoogleCloudTtsSettings } from "./GoogleCloudTtsSettings"
import { AzureTtsSettings } from "./AzureTtsSettings"

type NotificationSettingsProps = HTMLAttributes<HTMLDivElement> & {
	ttsEnabled?: boolean
	ttsSpeed?: number
	ttsProvider?: string
	ttsVoice?: string
	googleCloudTtsApiKey?: string
	googleCloudTtsProjectId?: string
	azureTtsSubscriptionKey?: string
	azureTtsRegion?: string
	soundEnabled?: boolean
	soundVolume?: number
	setCachedStateField: SetCachedStateField<
		| "ttsEnabled"
		| "ttsSpeed"
		| "ttsProvider"
		| "ttsVoice"
		| "googleCloudTtsApiKey"
		| "googleCloudTtsProjectId"
		| "azureTtsSubscriptionKey"
		| "azureTtsRegion"
		| "soundEnabled"
		| "soundVolume"
	>
}

export const NotificationSettings = ({
	ttsEnabled,
	ttsSpeed,
	ttsProvider = "native",
	ttsVoice,
	googleCloudTtsApiKey,
	googleCloudTtsProjectId,
	azureTtsSubscriptionKey,
	azureTtsRegion,
	soundEnabled,
	soundVolume,
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
							<label className="block font-medium mb-1">{t("settings:notifications.tts.provider")}</label>
							<VSCodeDropdown
								value={ttsProvider}
								onChange={(e: any) => setCachedStateField("ttsProvider", e.target.value)}
								className="w-full">
								<VSCodeOption value="native">System TTS</VSCodeOption>
								<VSCodeOption value="google-cloud">Google Cloud TTS</VSCodeOption>
								<VSCodeOption value="azure">Azure Speech Services</VSCodeOption>
							</VSCodeDropdown>
						</div>

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

						{ttsProvider === "google-cloud" && (
							<GoogleCloudTtsSettings
								apiKey={googleCloudTtsApiKey}
								projectId={googleCloudTtsProjectId}
								onApiKeyChange={(value) => setCachedStateField("googleCloudTtsApiKey", value)}
								onProjectIdChange={(value) => setCachedStateField("googleCloudTtsProjectId", value)}
							/>
						)}

						{ttsProvider === "azure" && (
							<AzureTtsSettings
								subscriptionKey={azureTtsSubscriptionKey}
								region={azureTtsRegion}
								onSubscriptionKeyChange={(value) =>
									setCachedStateField("azureTtsSubscriptionKey", value)
								}
								onRegionChange={(value) => setCachedStateField("azureTtsRegion", value)}
							/>
						)}
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
