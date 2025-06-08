import { VSCodeButton, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { ProviderSettingsEntry } from "@roo-code/types"

interface ProfileThresholdManagerProps {
	listApiConfigMeta: ProviderSettingsEntry[]
	profileThresholds: Record<string, number>
	defaultThreshold: number
	onUpdateThresholds: (thresholds: Record<string, number>) => void
}

export const ProfileThresholdManager: React.FC<ProfileThresholdManagerProps> = ({
	listApiConfigMeta,
	profileThresholds,
	defaultThreshold,
	onUpdateThresholds,
}) => {
	const { t } = useTranslation()
	const [selectedProfileId, setSelectedProfileId] = useState<string>("")
	const [thresholdInput, setThresholdInput] = useState<string>("")
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

	const handleProfileChange = (profileId: string) => {
		setSelectedProfileId(profileId)
		const existingThreshold = profileThresholds[profileId]
		if (existingThreshold === -1) {
			setThresholdInput("-1")
		} else if (existingThreshold !== undefined) {
			setThresholdInput(existingThreshold.toString())
		} else {
			setThresholdInput("")
		}
		setHasUnsavedChanges(false)
	}

	const handleThresholdChange = (value: string) => {
		setThresholdInput(value)
		setHasUnsavedChanges(true)
	}

	const handleSave = () => {
		if (selectedProfileId && thresholdInput !== "") {
			const numValue = parseInt(thresholdInput, 10)
			if (!isNaN(numValue)) {
				const newThresholds = {
					...profileThresholds,
					[selectedProfileId]: numValue,
				}
				onUpdateThresholds(newThresholds)
				setSelectedProfileId("")
				setThresholdInput("")
				setHasUnsavedChanges(false)
			}
		}
	}

	const handleRemove = (profileId: string) => {
		const newThresholds = { ...profileThresholds }
		delete newThresholds[profileId]
		onUpdateThresholds(newThresholds)
	}

	const formatThresholdDisplay = (threshold: number): string => {
		if (threshold === -1) {
			return (
				t("settings:contextManagement.profileThresholds.defaultThreshold") || `Default (${defaultThreshold}%)`
			)
		}
		return `${threshold}%`
	}

	return (
		<div className="border border-vscode-panel-border rounded p-4 mt-2">
			<div className="mb-4">
				<label className="text-sm font-medium mb-2 block">
					{t("settings:contextManagement.profileThresholds.configureLabel") ||
						"Configure threshold for profile:"}
				</label>
				<div className="flex items-center gap-2">
					<VSCodeDropdown
						value={selectedProfileId}
						onChange={(e: any) => handleProfileChange(e.target.value)}
						className="flex-1">
						<VSCodeOption value="">
							{t("settings:contextManagement.profileThresholds.selectProfile") || "Select a profile"}
						</VSCodeOption>
						{listApiConfigMeta.map((profile) => (
							<VSCodeOption key={profile.id} value={profile.id}>
								{profile.name}
							</VSCodeOption>
						))}
					</VSCodeDropdown>
					<input
						type="number"
						value={thresholdInput}
						onChange={(e) => handleThresholdChange(e.target.value)}
						placeholder="%"
						className="w-20 bg-vscode-input-background text-vscode-input-foreground p-1 rounded border border-vscode-input-border"
						disabled={!selectedProfileId}
					/>
					<VSCodeButton
						onClick={handleSave}
						disabled={!selectedProfileId || thresholdInput === "" || !hasUnsavedChanges}>
						{t("settings:common.save") || "Save"}
					</VSCodeButton>
				</div>
				<div className="text-xs text-vscode-descriptionForeground mt-2">
					{t("settings:contextManagement.profileThresholds.infoText") ||
						"ℹ️ Enter -1 to use the default threshold"}
				</div>
			</div>
			{Object.keys(profileThresholds).length > 0 && (
				<div>
					<h4 className="text-sm font-medium mb-2">
						{t("settings:contextManagement.profileThresholds.configuredProfiles") || "Configured Profiles:"}
					</h4>
					<ul className="space-y-1">
						{Object.entries(profileThresholds).map(([profileId, threshold]) => {
							const profile = listApiConfigMeta.find((p) => p.id === profileId)
							return (
								<li key={profileId} className="flex items-center justify-between py-1">
									<span className="text-sm">
										• {profile?.name || profileId}: {formatThresholdDisplay(threshold)}
									</span>
									<VSCodeButton
										appearance="icon"
										onClick={() => handleRemove(profileId)}
										aria-label={
											t("settings:contextManagement.profileThresholds.removeAriaLabel") ||
											`Remove threshold for ${profile?.name}`
										}>
										<span className="codicon codicon-close" />
									</VSCodeButton>
								</li>
							)
						})}
					</ul>
				</div>
			)}
		</div>
	)
}
