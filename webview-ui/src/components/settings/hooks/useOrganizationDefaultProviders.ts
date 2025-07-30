import { useState, useCallback, useMemo } from "react"
import {
	type OrganizationDefaultProviders,
	type OrganizationDefaultProviderProfile,
	type ProviderSettings,
} from "@roo-code/types"

import {
	createDefaultProviderProfile,
	updateProviderProfile,
	deleteProviderProfile,
	reorderProviderProfiles,
	validateProviderProfile,
	sortProfilesByPriority,
	getRecommendedProfiles,
	getPrimaryProfile,
	getFallbackProfiles,
} from "../utils/providerProfileUtils"

export interface UseOrganizationDefaultProvidersProps {
	initialSettings: OrganizationDefaultProviders
	onUpdate: (settings: OrganizationDefaultProviders) => void
	providers: Array<{ value: string; label: string }>
}

export interface UseOrganizationDefaultProvidersReturn {
	// State
	settings: OrganizationDefaultProviders
	profiles: OrganizationDefaultProviderProfile[]
	sortedProfiles: OrganizationDefaultProviderProfile[]
	recommendedProfiles: OrganizationDefaultProviderProfile[]
	primaryProfile: OrganizationDefaultProviderProfile | undefined
	fallbackProfiles: OrganizationDefaultProviderProfile[]

	// Actions
	toggleEnabled: () => void
	createProfile: (
		name: string,
		providerSettings: ProviderSettings,
		options?: {
			description?: string
			isRecommended?: boolean
			priority?: number
		},
	) => Promise<{ success: boolean; error?: string }>
	updateProfile: (
		profileId: string,
		updates: Partial<OrganizationDefaultProviderProfile>,
	) => Promise<{ success: boolean; error?: string }>
	deleteProfile: (profileId: string) => void
	reorderProfile: (profileId: string, direction: "up" | "down") => void
	setPrimaryProfile: (profileId: string) => void
	addFallbackProfile: (profileId: string) => void
	removeFallbackProfile: (profileId: string) => void
	validateProfile: (
		profile: Partial<OrganizationDefaultProviderProfile>,
		isEditing?: boolean,
		currentProfileId?: string,
	) => { isValid: boolean; errors: string[] }

	// Utilities
	getProviderDisplayName: (apiProvider: string | undefined) => string
}

export const useOrganizationDefaultProviders = ({
	initialSettings,
	onUpdate,
	providers,
}: UseOrganizationDefaultProvidersProps): UseOrganizationDefaultProvidersReturn => {
	const [settings, setSettings] = useState<OrganizationDefaultProviders>(initialSettings)

	const updateSettings = useCallback(
		(newSettings: OrganizationDefaultProviders) => {
			setSettings(newSettings)
			onUpdate(newSettings)
		},
		[onUpdate],
	)

	const profiles = useMemo(() => settings.profiles || [], [settings.profiles])

	const sortedProfiles = useMemo(() => sortProfilesByPriority(profiles), [profiles])

	const recommendedProfiles = useMemo(() => getRecommendedProfiles(profiles), [profiles])

	const primaryProfile = useMemo(
		() => getPrimaryProfile(profiles, settings.primaryProfileId),
		[profiles, settings.primaryProfileId],
	)

	const fallbackProfiles = useMemo(
		() => getFallbackProfiles(profiles, settings.fallbackProfileIds),
		[profiles, settings.fallbackProfileIds],
	)

	const toggleEnabled = useCallback(() => {
		updateSettings({
			...settings,
			enabled: !settings.enabled,
		})
	}, [settings, updateSettings])

	const createProfile = useCallback(
		async (
			name: string,
			providerSettings: ProviderSettings,
			options: {
				description?: string
				isRecommended?: boolean
				priority?: number
			} = {},
		): Promise<{ success: boolean; error?: string }> => {
			const newProfile = createDefaultProviderProfile(name, providerSettings, {
				...options,
				priority: options.priority || profiles.length + 1,
			})

			const validation = validateProviderProfile(newProfile, profiles)
			if (!validation.isValid) {
				return {
					success: false,
					error: validation.errors.join(", "),
				}
			}

			const updatedProfiles = [...profiles, newProfile]
			updateSettings({
				...settings,
				profiles: updatedProfiles,
			})

			return { success: true }
		},
		[profiles, settings, updateSettings],
	)

	const updateProfile = useCallback(
		async (
			profileId: string,
			updates: Partial<OrganizationDefaultProviderProfile>,
		): Promise<{ success: boolean; error?: string }> => {
			const existingProfile = profiles.find((p) => p.id === profileId)
			if (!existingProfile) {
				return {
					success: false,
					error: "Profile not found",
				}
			}

			const updatedProfile = { ...existingProfile, ...updates }
			const validation = validateProviderProfile(updatedProfile, profiles, true, profileId)
			if (!validation.isValid) {
				return {
					success: false,
					error: validation.errors.join(", "),
				}
			}

			const updatedProfiles = updateProviderProfile(profiles, profileId, updates)
			updateSettings({
				...settings,
				profiles: updatedProfiles,
			})

			return { success: true }
		},
		[profiles, settings, updateSettings],
	)

	const deleteProfile = useCallback(
		(profileId: string) => {
			const updatedProfiles = deleteProviderProfile(profiles, profileId)
			updateSettings({
				...settings,
				profiles: updatedProfiles,
				primaryProfileId:
					settings.primaryProfileId === profileId ? undefined : settings.primaryProfileId,
				fallbackProfileIds: settings.fallbackProfileIds?.filter((id) => id !== profileId),
			})
		},
		[profiles, settings, updateSettings],
	)

	const reorderProfile = useCallback(
		(profileId: string, direction: "up" | "down") => {
			const currentIndex = sortedProfiles.findIndex((p) => p.id === profileId)
			if (currentIndex === -1) return

			const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
			if (newIndex < 0 || newIndex >= sortedProfiles.length) return

			const reorderedProfiles = reorderProviderProfiles(sortedProfiles, currentIndex, newIndex)
			updateSettings({
				...settings,
				profiles: reorderedProfiles,
			})
		},
		[sortedProfiles, settings, updateSettings],
	)

	const setPrimaryProfile = useCallback(
		(profileId: string) => {
			updateSettings({
				...settings,
				primaryProfileId: profileId,
			})
		},
		[settings, updateSettings],
	)

	const addFallbackProfile = useCallback(
		(profileId: string) => {
			const currentFallbacks = settings.fallbackProfileIds || []
			if (!currentFallbacks.includes(profileId)) {
				updateSettings({
					...settings,
					fallbackProfileIds: [...currentFallbacks, profileId],
				})
			}
		},
		[settings, updateSettings],
	)

	const removeFallbackProfile = useCallback(
		(profileId: string) => {
			const currentFallbacks = settings.fallbackProfileIds || []
			updateSettings({
				...settings,
				fallbackProfileIds: currentFallbacks.filter((id) => id !== profileId),
			})
		},
		[settings, updateSettings],
	)

	const validateProfile = useCallback(
		(
			profile: Partial<OrganizationDefaultProviderProfile>,
			isEditing = false,
			currentProfileId?: string,
		) => {
			return validateProviderProfile(profile, profiles, isEditing, currentProfileId)
		},
		[profiles],
	)

	const getProviderDisplayName = useCallback(
		(apiProvider: string | undefined): string => {
			if (!apiProvider) return "Unknown Provider"
			const provider = providers.find((p) => p.value === apiProvider)
			return provider?.label || apiProvider
		},
		[providers],
	)

	return {
		// State
		settings,
		profiles,
		sortedProfiles,
		recommendedProfiles,
		primaryProfile,
		fallbackProfiles,

		// Actions
		toggleEnabled,
		createProfile,
		updateProfile,
		deleteProfile,
		reorderProfile,
		setPrimaryProfile,
		addFallbackProfile,
		removeFallbackProfile,
		validateProfile,

		// Utilities
		getProviderDisplayName,
	}
}