import { useEffect, useRef, useState } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { ApiConfigMeta } from "../../../../src/shared/ExtensionMessage"

import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Dialog,
	DialogContent,
	DialogTitle,
} from "@/components/ui"

interface ProfileSwitcherProps {
	currentApiConfigName?: string
	listApiConfigMeta?: ApiConfigMeta[]
	onSelectConfig: (configName: string) => void
	onDeleteConfig: (configName: string) => void
	onRenameConfig: (oldName: string, newName: string) => void
	onUpsertConfig: (configName: string) => void
}

export const ProfileSwitcher = ({
	currentApiConfigName = "",
	listApiConfigMeta = [],
	onSelectConfig,
	onDeleteConfig,
	onRenameConfig,
	onUpsertConfig,
}: ProfileSwitcherProps) => {
	const [isRenaming, setIsRenaming] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [inputValue, setInputValue] = useState("")
	const [newProfileName, setNewProfileName] = useState("")
	const [error, setError] = useState<string | null>(null)
	const inputRef = useRef<any>(null)
	const newProfileInputRef = useRef<any>(null)

	const validateName = (name: string, isNewProfile: boolean): string | null => {
		const trimmed = name.trim()

		if (!trimmed) {
			return "Name cannot be empty"
		}

		const nameExists = listApiConfigMeta?.some((config) => config.name.toLowerCase() === trimmed.toLowerCase())

		// For new profiles, any existing name is invalid.
		if (isNewProfile && nameExists) {
			return "A profile with this name already exists"
		}

		// For rename, only block if trying to rename to a different existing profile.
		if (!isNewProfile && nameExists && trimmed.toLowerCase() !== currentApiConfigName?.toLowerCase()) {
			return "A profile with this name already exists"
		}

		return null
	}

	const resetCreateState = () => {
		setIsCreating(false)
		setNewProfileName("")
		setError(null)
	}

	const resetRenameState = () => {
		setIsRenaming(false)
		setInputValue("")
		setError(null)
	}

	// Focus input when entering rename mode
	useEffect(() => {
		if (isRenaming) {
			const timeoutId = setTimeout(() => inputRef.current?.focus(), 0)
			return () => clearTimeout(timeoutId)
		}
	}, [isRenaming])

	// Focus input when opening new dialog
	useEffect(() => {
		if (isCreating) {
			const timeoutId = setTimeout(() => newProfileInputRef.current?.focus(), 0)
			return () => clearTimeout(timeoutId)
		}
	}, [isCreating])

	// Reset state when current profile changes
	useEffect(() => {
		resetCreateState()
		resetRenameState()
	}, [currentApiConfigName])

	const handleAdd = () => {
		resetCreateState()
		setIsCreating(true)
	}

	const handleStartRename = () => {
		setIsRenaming(true)
		setInputValue(currentApiConfigName || "")
		setError(null)
	}

	const handleCancel = () => {
		resetRenameState()
	}

	const handleSave = () => {
		const trimmedValue = inputValue.trim()
		const error = validateName(trimmedValue, false)

		if (error) {
			setError(error)
			return
		}

		if (isRenaming && currentApiConfigName) {
			if (currentApiConfigName === trimmedValue) {
				resetRenameState()
				return
			}
			onRenameConfig(currentApiConfigName, trimmedValue)
		}

		resetRenameState()
	}

	const handleNewProfileSave = () => {
		const trimmedValue = newProfileName.trim()
		const error = validateName(trimmedValue, true)

		if (error) {
			setError(error)
			return
		}

		onUpsertConfig(trimmedValue)
		resetCreateState()
	}

	const handleDelete = () => {
		if (!currentApiConfigName || !listApiConfigMeta || listApiConfigMeta.length <= 1) return

		// Let the extension handle both deletion and selection
		onDeleteConfig(currentApiConfigName)
	}

	const isOnlyProfile = listApiConfigMeta?.length === 1

	return (
		<>
			{isRenaming ? (
				<>
					<div className="flex items-center gap-1 mt-1" data-testid="rename-form">
						<VSCodeTextField
							ref={inputRef}
							value={inputValue}
							onInput={(e: unknown) => {
								const target = e as { target: { value: string } }
								setInputValue(target.target.value)
								setError(null)
							}}
							placeholder="Enter new name"
							style={{ flexGrow: 1 }}
							onKeyDown={(e: unknown) => {
								const event = e as { key: string }
								if (event.key === "Enter" && inputValue.trim()) {
									handleSave()
								} else if (event.key === "Escape") {
									handleCancel()
								}
							}}
							className="w-full"
						/>
						<Button
							variant="ghost"
							size="icon"
							disabled={!inputValue.trim()}
							onClick={handleSave}
							title="Save">
							<span className="codicon codicon-check" />
						</Button>
						<Button variant="ghost" size="icon" onClick={handleCancel} title="Cancel">
							<span className="codicon codicon-close" />
						</Button>
					</div>
					{error && (
						<div className="text-vscode-errorForeground text-sm mt-2" data-testid="error-message">
							{error}
						</div>
					)}
				</>
			) : (
				<>
					<div className="flex items-center gap-1 mt-1">
						<Select value={currentApiConfigName} onValueChange={onSelectConfig}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{listApiConfigMeta.map(({ name }) => (
										<SelectItem key={name} value={name}>
											{name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
						<Button variant="ghost" size="icon" onClick={handleAdd} title="Add profile">
							<span className="codicon codicon-add" />
						</Button>
						{currentApiConfigName && (
							<>
								<Button variant="ghost" size="icon" onClick={handleStartRename} title="Rename profile">
									<span className="codicon codicon-edit" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onClick={handleDelete}
									title={isOnlyProfile ? "Cannot delete the only profile" : "Delete profile"}
									disabled={isOnlyProfile}>
									<span className="codicon codicon-trash" />
								</Button>
							</>
						)}
					</div>
					<div className="text-vscode-descriptionForeground text-sm">
						Save different configuration profiles to quickly switch between providers and settings.
					</div>
				</>
			)}

			<Dialog
				open={isCreating}
				onOpenChange={(open: boolean) => {
					if (open) {
						setIsCreating(true)
						setNewProfileName("")
						setError(null)
					} else {
						resetCreateState()
					}
				}}
				aria-labelledby="new-profile-title">
				<DialogContent className="p-4 max-w-sm">
					<DialogTitle>New Configuration Profile</DialogTitle>
					<Input
						ref={newProfileInputRef}
						value={newProfileName}
						onInput={(e: unknown) => {
							const target = e as { target: { value: string } }
							setNewProfileName(target.target.value)
							setError(null)
						}}
						placeholder="Name"
						onKeyDown={(e: { key: string }) => {
							if (e.key === "Enter" && newProfileName.trim()) {
								handleNewProfileSave()
							} else if (e.key === "Escape") {
								resetCreateState()
							}
						}}
						className="w-full"
					/>
					{error && (
						<p className="text-vscode-errorForeground text-sm mt-2" data-testid="error-message">
							{error}
						</p>
					)}
					<div className="flex justify-end gap-2 mt-4">
						<Button variant="secondary" onClick={resetCreateState}>
							Cancel
						</Button>
						<Button variant="default" disabled={!newProfileName.trim()} onClick={handleNewProfileSave}>
							Create Profile
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
