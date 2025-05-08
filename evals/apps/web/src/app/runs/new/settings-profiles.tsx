"use client"

import { useState, useEffect } from "react"
import { Plus, Save, Trash2, Check } from "lucide-react"
import { toast } from "sonner"

import {
	Button,
	Input,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	FormMessage,
} from "@/components/ui"

// Define the type for settings profiles
export type SettingsProfile = {
	id: string
	name: string
	settings: Record<string, any>
}

interface SettingsProfilesProps {
	currentSettings: Record<string, any> | undefined
	onSelectProfile: (settings: Record<string, any>) => void
}

export function SettingsProfiles({ currentSettings, onSelectProfile }: SettingsProfilesProps) {
	// Initialize profiles from localStorage if available
	const initialProfiles = (() => {
		try {
			const savedProfiles = localStorage.getItem("settingsProfiles")
			if (savedProfiles) {
				return JSON.parse(savedProfiles) as SettingsProfile[]
			}
		} catch (error) {
			console.error("Failed to load initial profiles:", error)
		}
		return []
	})()

	const [profiles, setProfiles] = useState<SettingsProfile[]>(initialProfiles)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [profileName, setProfileName] = useState("")
	const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

	// Load profiles from localStorage on component mount
	useEffect(() => {
		try {
			const savedProfiles = localStorage.getItem("settingsProfiles")
			if (savedProfiles) {
				const parsedProfiles = JSON.parse(savedProfiles)
				setProfiles(parsedProfiles)
			}
		} catch (error) {
			console.error("Failed to load settings profiles:", error)
		}
	}, [])

	// Save profiles to localStorage whenever they change
	useEffect(() => {
		try {
			// Only save if profiles array is not empty
			if (profiles.length > 0) {
				const profilesJson = JSON.stringify(profiles)
				localStorage.setItem("settingsProfiles", profilesJson)
			}
		} catch (error) {
			console.error("Failed to save settings profiles:", error)
		}
	}, [profiles])

	const saveProfile = () => {
		if (!profileName.trim()) {
			toast.error("Profile name cannot be empty")
			return
		}

		if (!currentSettings) {
			toast.error("No settings to save")
			return
		}

		// Ensure we have a deep copy of the settings to avoid reference issues
		const settingsCopy = JSON.parse(JSON.stringify(currentSettings))

		const newProfile: SettingsProfile = {
			id: Date.now().toString(),
			name: profileName,
			settings: settingsCopy,
		}
		console.log("Saving profile with settings:", newProfile.settings) // DEBUG LOG

		// Create a new array with the new profile
		const updatedProfiles = [...profiles, newProfile]

		try {
			// Save directly to localStorage as well to ensure it persists
			const profilesJson = JSON.stringify(updatedProfiles)
			localStorage.setItem("settingsProfiles", profilesJson)

			// Update state
			setProfiles(updatedProfiles)
			setProfileName("")
			setIsDialogOpen(false)
			toast.success(`Profile "${profileName}" saved successfully. ${updatedProfiles.length} profiles available.`)
		} catch (error) {
			console.error("Failed to save profile:", error)
			toast.error("Failed to save profile. Please try again.")
		}
	}

	const deleteProfile = (id: string) => {
		const newProfiles = profiles.filter((profile) => profile.id !== id)
		setProfiles(newProfiles)

		// If all profiles are deleted, clear localStorage
		if (newProfiles.length === 0) {
			localStorage.removeItem("settingsProfiles")
		}

		toast.success("Profile deleted")
	}

	const selectProfile = (profile: SettingsProfile) => {
		console.log("Loading profile with settings:", profile.settings) // DEBUG LOG
		setSelectedProfileId(profile.id)
		onSelectProfile(profile.settings) // Pass loaded settings to parent
		toast.success(`Profile "${profile.name}" loaded`)
	}

	return (
		<div className="flex flex-wrap items-center gap-2 mb-2">
			{profiles.length > 0 && (
				<div className="w-full mb-2 p-2 bg-muted/30 rounded-md">
					<div className="text-sm font-medium mb-1">Available Profiles: {profiles.length}</div>
				</div>
			)}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button type="button" variant="outline" size="sm">
						Load Profile ({profiles.length})
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{profiles.length === 0 ? (
						<div className="px-2 py-1.5 text-sm text-muted-foreground">No saved profiles</div>
					) : (
						profiles.map((profile) => (
							<DropdownMenuItem
								key={profile.id}
								onClick={() => selectProfile(profile)}
								className="flex items-center justify-between">
								<span>{profile.name}</span>
								{selectedProfileId === profile.id && <Check className="ml-2 h-4 w-4" />}
								<Button
									variant="ghost"
									size="icon"
									type="button"
									className="ml-2 h-6 w-6"
									onClick={(e) => {
										e.stopPropagation()
										deleteProfile(profile.id)
									}}>
									<Trash2 className="h-4 w-4" />
								</Button>
							</DropdownMenuItem>
						))
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Button
				variant="outline"
				size="sm"
				type="button"
				onClick={() => setIsDialogOpen(true)}
				disabled={!currentSettings}>
				<Save className="mr-2 h-4 w-4" />
				Save Profile
			</Button>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save Settings Profile</DialogTitle>
						<DialogDescription>Save your current settings as a profile for future use.</DialogDescription>
					</DialogHeader>
					<FormField
						name="profileName"
						render={() => (
							<FormItem>
								<FormLabel>Profile Name</FormLabel>
								<FormControl>
									<Input
										placeholder="My Settings Profile"
										value={profileName}
										onChange={(e) => setProfileName(e.target.value)}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
							Cancel
						</Button>
						<Button type="button" onClick={saveProfile}>
							<Plus className="mr-2 h-4 w-4" />
							Save Profile
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
