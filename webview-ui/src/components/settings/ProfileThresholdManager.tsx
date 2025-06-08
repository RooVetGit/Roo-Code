import { VSCodeButton, VSCodeDropdown, VSCodeOption, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
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
		<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
			<div className="flex items-center gap-4 font-bold">
				<span className="codicon codicon-settings-gear" />
				<div>
					{t("settings:contextManagement.profileThresholds.configureLabel") ||
						"Configure threshold for profile:"}
				</div>
			</div>
			<div>
				<div className="flex flex-col gap-2">
					<VSCodeDropdown
						value={selectedProfileId}
						onChange={(e: any) => handleProfileChange(e.target.value)}
						className="w-full"
						data-testid="profile-dropdown">
						<VSCodeOption value="">
							{t("settings:contextManagement.profileThresholds.selectProfile") || "Select a profile"}
						</VSCodeOption>
						{listApiConfigMeta.map((profile) => (
							<VSCodeOption key={profile.id} value={profile.id}>
								{profile.name}
							</VSCodeOption>
						))}
					</VSCodeDropdown>
					<div className="flex items-center justify-between">
						<VSCodeTextField
							value={thresholdInput}
							onInput={(e: any) => handleThresholdChange(e.target.value)}
							placeholder="%"
							className="w-16"
							disabled={!selectedProfileId}
						/>
						<VSCodeButton
							onClick={handleSave}
							disabled={!selectedProfileId || thresholdInput === "" || !hasUnsavedChanges}>
							{t("settings:common.save") || "Save"}
						</VSCodeButton>
					</div>
				</div>
				<div className="inline-flex items-center text-vscode-descriptionForeground text-sm mt-1">
					<span className="codicon codicon-info mr-1" />
					<span>Enter -1 to use the default threshold</span>
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
