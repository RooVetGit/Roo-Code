import {
	type OrganizationDefaultProviders,
	type OrganizationDefaultProviderProfile,
	type ProviderSettings,
} from "@roo-code/types"

/**
 * Utility functions for managing organization default provider profiles
 */

export const createDefaultProviderProfile = (
	name: string,
	settings: ProviderSettings,
	options: {
		description?: string
		isRecommended?: boolean
		priority?: number
	} = {},
): OrganizationDefaultProviderProfile => {
	return {
		id: `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		name: name.trim(),
		description: options.description?.trim(),
		isRecommended: options.isRecommended || false,
		priority: options.priority || 1,
		settings,
	}
}

export const updateProviderProfile = (
	profiles: OrganizationDefaultProviderProfile[],
	profileId: string,
	updates: Partial<OrganizationDefaultProviderProfile>,
): OrganizationDefaultProviderProfile[] => {
	return profiles.map((profile) =>
		profile.id === profileId ? { ...profile, ...updates } : profile,
	)
}

export const deleteProviderProfile = (
	profiles: OrganizationDefaultProviderProfile[],
	profileId: string,
): OrganizationDefaultProviderProfile[] => {
	return profiles.filter((profile) => profile.id !== profileId)
}

export const reorderProviderProfiles = (
	profiles: OrganizationDefaultProviderProfile[],
	fromIndex: number,
	toIndex: number,
): OrganizationDefaultProviderProfile[] => {
	const result = [...profiles]
	const [removed] = result.splice(fromIndex, 1)
	result.splice(toIndex, 0, removed)

	// Update priorities based on new order
	return result.map((profile, index) => ({
		...profile,
		priority: index + 1,
	}))
}

export const validateProviderProfile = (
	profile: Partial<OrganizationDefaultProviderProfile>,
	existingProfiles: OrganizationDefaultProviderProfile[],
	isEditing = false,
	currentProfileId?: string,
): { isValid: boolean; errors: string[] } => {
	const errors: string[] = []

	// Validate name
	if (!profile.name?.trim()) {
		errors.push("Profile name is required")
	} else {
		// Check for duplicate names
		const nameExists = existingProfiles.some(
			(p) =>
				p.name.toLowerCase() === profile.name!.toLowerCase() &&
				(!isEditing || p.id !== currentProfileId),
		)
		if (nameExists) {
			errors.push("Profile name already exists")
		}
	}

	// Validate provider settings
	if (!profile.settings?.apiProvider) {
		errors.push("Provider selection is required")
	}

	// Validate priority
	if (profile.priority !== undefined && profile.priority < 1) {
		errors.push("Priority must be at least 1")
	}

	return {
		isValid: errors.length === 0,
		errors,
	}
}

export const getProviderDisplayName = (
	apiProvider: string | undefined,
	providers: Array<{ value: string; label: string }>,
): string => {
	if (!apiProvider) return "Unknown Provider"
	const provider = providers.find((p) => p.value === apiProvider)
	return provider?.label || apiProvider
}

export const sortProfilesByPriority = (
	profiles: OrganizationDefaultProviderProfile[],
): OrganizationDefaultProviderProfile[] => {
	return [...profiles].sort((a, b) => (a.priority || 0) - (b.priority || 0))
}

export const getRecommendedProfiles = (
	profiles: OrganizationDefaultProviderProfile[],
): OrganizationDefaultProviderProfile[] => {
	return profiles.filter((profile) => profile.isRecommended)
}

export const getPrimaryProfile = (
	profiles: OrganizationDefaultProviderProfile[],
	primaryProfileId?: string,
): OrganizationDefaultProviderProfile | undefined => {
	if (!primaryProfileId) return undefined
	return profiles.find((profile) => profile.id === primaryProfileId)
}

export const getFallbackProfiles = (
	profiles: OrganizationDefaultProviderProfile[],
	fallbackProfileIds?: string[],
): OrganizationDefaultProviderProfile[] => {
	if (!fallbackProfileIds || fallbackProfileIds.length === 0) return []
	return profiles.filter((profile) => fallbackProfileIds.includes(profile.id))
}

export const applyOrganizationDefaults = (
	userSettings: ProviderSettings,
	organizationDefaults: OrganizationDefaultProviders,
): ProviderSettings => {
	// If organization defaults are disabled, return user settings as-is
	if (!organizationDefaults.enabled || !organizationDefaults.profiles) {
		return userSettings
	}

	// If user has already configured a provider, respect their choice
	if (userSettings.apiProvider) {
		return userSettings
	}

	// Apply primary profile if available
	const primaryProfile = getPrimaryProfile(
		organizationDefaults.profiles,
		organizationDefaults.primaryProfileId,
	)

	if (primaryProfile) {
		return {
			...primaryProfile.settings,
			...userSettings, // User settings take precedence
		}
	}

	// Apply first recommended profile if no primary is set
	const recommendedProfiles = getRecommendedProfiles(organizationDefaults.profiles)
	if (recommendedProfiles.length > 0) {
		return {
			...recommendedProfiles[0].settings,
			...userSettings, // User settings take precedence
		}
	}

	// Apply first profile if no recommended profiles
	if (organizationDefaults.profiles.length > 0) {
		const sortedProfiles = sortProfilesByPriority(organizationDefaults.profiles)
		return {
			...sortedProfiles[0].settings,
			...userSettings, // User settings take precedence
		}
	}

	return userSettings
}