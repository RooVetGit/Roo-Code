import React, { useState, useCallback, useMemo } from "react"
import {
	type OrganizationDefaultProviders,
	type OrganizationDefaultProviderProfile,
	type ProviderSettings,
	type ProviderName,
} from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Textarea,
	Checkbox,
} from "@src/components/ui"
import { PROVIDERS } from "./constants"
import ApiOptions from "./ApiOptions"

interface OrganizationDefaultProvidersProps {
	defaultProviders: OrganizationDefaultProviders
	onUpdate: (defaultProviders: OrganizationDefaultProviders) => void
	organizationAllowList: any
}

interface ProviderProfileFormData {
	name: string
	description: string
	isRecommended: boolean
	priority: number
	settings: ProviderSettings
}

const OrganizationDefaultProviders: React.FC<OrganizationDefaultProvidersProps> = ({
	defaultProviders,
	onUpdate,
	organizationAllowList,
}) => {
	const { t } = useAppTranslation()
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [editingProfile, setEditingProfile] = useState<OrganizationDefaultProviderProfile | null>(null)
	const [formData, setFormData] = useState<ProviderProfileFormData>({
		name: "",
		description: "",
		isRecommended: false,
		priority: 1,
		settings: { apiProvider: undefined },
	})
	const [errorMessage, setErrorMessage] = useState<string | undefined>()

	const profiles = defaultProviders.profiles || []

	const handleToggleEnabled = useCallback(() => {
		onUpdate({
			...defaultProviders,
			enabled: !defaultProviders.enabled,
		})
	}, [defaultProviders, onUpdate])

	const handleOpenDialog = useCallback((profile?: OrganizationDefaultProviderProfile) => {
		if (profile) {
			setEditingProfile(profile)
			setFormData({
				name: profile.name,
				description: profile.description || "",
				isRecommended: profile.isRecommended || false,
				priority: profile.priority || 1,
				settings: profile.settings,
			})
		} else {
			setEditingProfile(null)
			setFormData({
				name: "",
				description: "",
				isRecommended: false,
				priority: profiles.length + 1,
				settings: { apiProvider: undefined },
			})
		}
		setErrorMessage(undefined)
		setIsDialogOpen(true)
	}, [profiles.length])

	const handleCloseDialog = useCallback(() => {
		setIsDialogOpen(false)
		setEditingProfile(null)
		setErrorMessage(undefined)
	}, [])

	const handleSaveProfile = useCallback(() => {
		if (!formData.name.trim()) {
			setErrorMessage(t("settings:providers.nameEmpty"))
			return
		}

		if (!formData.settings.apiProvider) {
			setErrorMessage(t("settings:providers.providerRequired"))
			return
		}

		const newProfile: OrganizationDefaultProviderProfile = {
			id: editingProfile?.id || `profile-${Date.now()}`,
			name: formData.name.trim(),
			description: formData.description.trim() || undefined,
			isRecommended: formData.isRecommended,
			priority: formData.priority,
			settings: formData.settings,
		}

		const updatedProfiles = editingProfile
			? profiles.map((p) => (p.id === editingProfile.id ? newProfile : p))
			: [...profiles, newProfile]

		onUpdate({
			...defaultProviders,
			profiles: updatedProfiles,
		})

		handleCloseDialog()
	}, [formData, editingProfile, profiles, defaultProviders, onUpdate, handleCloseDialog, t])

	const handleDeleteProfile = useCallback(
		(profileId: string) => {
			const updatedProfiles = profiles.filter((p) => p.id !== profileId)
			onUpdate({
				...defaultProviders,
				profiles: updatedProfiles,
				primaryProfileId:
					defaultProviders.primaryProfileId === profileId
						? undefined
						: defaultProviders.primaryProfileId,
				fallbackProfileIds: defaultProviders.fallbackProfileIds?.filter((id) => id !== profileId),
			})
		},
		[profiles, defaultProviders, onUpdate],
	)

	const handleSetPrimary = useCallback(
		(profileId: string) => {
			onUpdate({
				...defaultProviders,
				primaryProfileId: profileId,
			})
		},
		[defaultProviders, onUpdate],
	)

	const handleMoveProfile = useCallback(
		(profileId: string, direction: "up" | "down") => {
			const currentIndex = profiles.findIndex((p) => p.id === profileId)
			if (currentIndex === -1) return

			const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
			if (newIndex < 0 || newIndex >= profiles.length) return

			const updatedProfiles = [...profiles]
			const [movedProfile] = updatedProfiles.splice(currentIndex, 1)
			updatedProfiles.splice(newIndex, 0, movedProfile)

			// Update priorities
			updatedProfiles.forEach((profile, index) => {
				profile.priority = index + 1
			})

			onUpdate({
				...defaultProviders,
				profiles: updatedProfiles,
			})
		},
		[profiles, defaultProviders, onUpdate],
	)

	const sortedProfiles = useMemo(() => {
		return [...profiles].sort((a, b) => (a.priority || 0) - (b.priority || 0))
	}, [profiles])

	const providerOptions = useMemo(() => {
		return PROVIDERS.map(({ value, label }) => ({
			value,
			label,
		}))
	}, [])

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-medium">{t("settings:organizationDefaultProviders.title")}</h3>
					<p className="text-sm text-vscode-descriptionForeground">
						{t("settings:organizationDefaultProviders.description")}
					</p>
				</div>
				<Checkbox checked={defaultProviders.enabled || false} onChange={handleToggleEnabled}>
					{t("settings:organizationDefaultProviders.enabled")}
				</Checkbox>
			</div>

			{defaultProviders.enabled && (
				<>
					<div className="flex justify-between items-center">
						<h4 className="font-medium">{t("settings:organizationDefaultProviders.profiles")}</h4>
						<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
							<DialogTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleOpenDialog()}
									className="flex items-center gap-2">
									+ {t("settings:organizationDefaultProviders.addProfile")}
								</Button>
							</DialogTrigger>
							<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
								<DialogHeader>
									<DialogTitle>
										{editingProfile
											? t("settings:organizationDefaultProviders.editProfile")
											: t("settings:organizationDefaultProviders.createProfile")}
									</DialogTitle>
								</DialogHeader>
								<div className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block font-medium mb-1">
												{t("settings:organizationDefaultProviders.profileName")}
											</label>
											<Input
												value={formData.name}
												onChange={(e) =>
													setFormData((prev) => ({ ...prev, name: e.target.value }))
												}
												placeholder={t("settings:organizationDefaultProviders.profileNamePlaceholder")}
											/>
										</div>
										<div>
											<label className="block font-medium mb-1">
												{t("settings:organizationDefaultProviders.priority")}
											</label>
											<Input
												type="number"
												min="1"
												value={formData.priority}
												onChange={(e) =>
													setFormData((prev) => ({
														...prev,
														priority: parseInt(e.target.value) || 1,
													}))
												}
											/>
										</div>
									</div>
									<div>
										<label className="block font-medium mb-1">
											{t("settings:organizationDefaultProviders.description")}
										</label>
										<Textarea
											value={formData.description}
											onChange={(e) =>
												setFormData((prev) => ({ ...prev, description: e.target.value }))
											}
											placeholder={t("settings:organizationDefaultProviders.descriptionPlaceholder")}
											rows={2}
										/>
									</div>
									<div>
										<Checkbox
											checked={formData.isRecommended}
											onChange={(checked) =>
												setFormData((prev) => ({ ...prev, isRecommended: checked }))
											}>
											{t("settings:organizationDefaultProviders.recommended")}
										</Checkbox>
									</div>
									<div>
										<h4 className="font-medium mb-2">
											{t("settings:organizationDefaultProviders.providerSettings")}
										</h4>
										<ApiOptions
											uriScheme="vscode"
											apiConfiguration={formData.settings}
											setApiConfigurationField={(field, value) =>
												setFormData((prev) => ({
													...prev,
													settings: { ...prev.settings, [field]: value },
												}))
											}
											errorMessage={errorMessage}
											setErrorMessage={setErrorMessage}
											fromWelcomeView={false}
										/>
									</div>
									{errorMessage && (
										<div className="text-sm text-vscode-errorForeground">{errorMessage}</div>
									)}
									<div className="flex justify-end gap-2">
										<Button variant="outline" onClick={handleCloseDialog}>
											{t("settings:common.cancel")}
										</Button>
										<Button onClick={handleSaveProfile}>
											{editingProfile
												? t("settings:common.save")
												: t("settings:organizationDefaultProviders.createProfile")}
										</Button>
									</div>
								</div>
							</DialogContent>
						</Dialog>
					</div>

					<div className="space-y-2">
						{sortedProfiles.length === 0 ? (
							<div className="text-center py-8 text-vscode-descriptionForeground">
								{t("settings:organizationDefaultProviders.noProfiles")}
							</div>
						) : (
							sortedProfiles.map((profile, index) => (
								<div key={profile.id} className="border border-vscode-panel-border rounded p-4">
									<div className="flex items-center justify-between mb-2">
										<div className="flex items-center gap-2">
											<h4 className="text-base font-medium">{profile.name}</h4>
											{profile.isRecommended && (
												<span className="text-xs text-yellow-600">★</span>
											)}
											{defaultProviders.primaryProfileId === profile.id && (
												<span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
													{t("settings:organizationDefaultProviders.primary")}
												</span>
											)}
										</div>
										<div className="flex items-center gap-1">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleMoveProfile(profile.id, "up")}
												disabled={index === 0}>
												↑
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleMoveProfile(profile.id, "down")}
												disabled={index === sortedProfiles.length - 1}>
												↓
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleSetPrimary(profile.id)}>
												★
											</Button>
											<Button variant="ghost" size="sm" onClick={() => handleOpenDialog(profile)}>
												✏️
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleDeleteProfile(profile.id)}>
												🗑️
											</Button>
										</div>
									</div>
									{profile.description && (
										<p className="text-sm text-vscode-descriptionForeground mb-2">
											{profile.description}
										</p>
									)}
									<div className="text-sm">
										<span className="font-medium">
											{t("settings:organizationDefaultProviders.provider")}:
										</span>{" "}
										{PROVIDERS.find((p) => p.value === profile.settings.apiProvider)?.label ||
											profile.settings.apiProvider}
									</div>
								</div>
							))
						)}
					</div>
				</>
			)}
		</div>
	)
}

export default OrganizationDefaultProviders