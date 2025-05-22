import { MarketplaceSource } from "../../../../src/services/marketplace/types"
import { MarketplaceViewStateManager } from "./MarketplaceViewStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useStateManager } from "./useStateManager"
import { validateSource, ValidationError } from "@roo/shared/MarketplaceValidation"
import { cn } from "@src/lib/utils"

export interface MarketplaceSourcesConfigProps {
	stateManager: MarketplaceViewStateManager
}

export function MarketplaceSourcesConfig({ stateManager }: MarketplaceSourcesConfigProps) {
	const { t } = useAppTranslation()
	const [state, manager] = useStateManager(stateManager)
	const [newSourceUrl, setNewSourceUrl] = useState("")
	const [newSourceName, setNewSourceName] = useState("")
	const [error, setError] = useState("")
	const [fieldErrors, setFieldErrors] = useState<{
		name?: string
		url?: string
	}>({})

	// Check if name contains emoji characters
	const containsEmoji = (str: string): boolean => {
		// Simple emoji detection using common emoji ranges
		// This avoids using Unicode property escapes which require ES2018+
		return (
			/[\ud83c\ud83d\ud83e][\ud000-\udfff]/.test(str) || // Common emoji surrogate pairs
			/[\u2600-\u27BF]/.test(str) || // Misc symbols and pictographs
			/[\u2300-\u23FF]/.test(str) || // Miscellaneous Technical
			/[\u2700-\u27FF]/.test(str) || // Dingbats
			/[\u2B50\u2B55]/.test(str) || // Star, Circle
			// eslint-disable-next-line no-misleading-character-class
			/[\u203C\u2049\u20E3\u2122\u2139\u2194-\u2199\u21A9\u21AA]/.test(str)
		) // Punctuation
	}

	// Validate input fields without submitting
	const validateFields = () => {
		const newErrors: { name?: string; url?: string } = {}

		// Validate name if provided
		if (newSourceName) {
			if (newSourceName.length > 20) {
				newErrors.name = t("marketplace:sources.errors.nameTooLong")
			} else if (containsEmoji(newSourceName)) {
				newErrors.name = t("marketplace:sources.errors.emojiName")
			} else {
				// Check for duplicate names
				const hasDuplicateName = state.sources.some(
					(source) => source.name && source.name.toLowerCase() === newSourceName.toLowerCase(),
				)
				if (hasDuplicateName) {
					newErrors.name = t("marketplace:sources.errors.duplicateName")
				}
			}
		}

		// Validate URL
		if (!newSourceUrl.trim()) {
			newErrors.url = t("marketplace:sources.errors.emptyUrl")
		} else {
			// Check for duplicate URLs
			const hasDuplicateUrl = state.sources.some(
				(source) => source.url.toLowerCase().trim() === newSourceUrl.toLowerCase().trim(),
			)
			if (hasDuplicateUrl) {
				newErrors.url = t("marketplace:sources.errors.duplicateUrl")
			}
		}

		setFieldErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const handleAddSource = () => {
		const MAX_SOURCES = 10
		if (state.sources.length >= MAX_SOURCES) {
			setError(t("marketplace:sources.errors.maxSources", { max: MAX_SOURCES }))
			return
		}

		// Clear previous errors
		setError("")

		// Perform quick validation first
		if (!validateFields()) {
			// If we have specific field errors, show the first one as the main error
			if (fieldErrors.url) {
				setError(fieldErrors.url)
			} else if (fieldErrors.name) {
				setError(fieldErrors.name)
			}
			return
		}

		const sourceToValidate: MarketplaceSource = {
			url: newSourceUrl.trim(),
			name: newSourceName.trim() || undefined,
			enabled: true,
		}

		const validationErrors = validateSource(sourceToValidate, state.sources)
		if (validationErrors.length > 0) {
			const errorMessages: Record<string, string> = {
				"url:empty": "marketplace:sources.errors.emptyUrl",
				"url:nonvisible": "marketplace:sources.errors.nonVisibleChars",
				"url:invalid": "marketplace:sources.errors.invalidGitUrl",
				"url:duplicate": "marketplace:sources.errors.duplicateUrl",
				"name:length": "marketplace:sources.errors.nameTooLong",
				"name:nonvisible": "marketplace:sources.errors.nonVisibleCharsName",
				"name:duplicate": "marketplace:sources.errors.duplicateName",
			}

			// Group errors by field for better user feedback
			const fieldErrorMap: Record<string, ValidationError[]> = {}
			for (const error of validationErrors) {
				if (!fieldErrorMap[error.field]) {
					fieldErrorMap[error.field] = []
				}
				fieldErrorMap[error.field].push(error)
			}

			// Update field-specific errors
			const newFieldErrors: { name?: string; url?: string } = {}
			if (fieldErrorMap.name) {
				const error = fieldErrorMap.name[0]
				const errorKey = `name:${error.message.toLowerCase().split(" ")[0]}`
				newFieldErrors.name = t(errorMessages[errorKey] || error.message)
			}

			if (fieldErrorMap.url) {
				const error = fieldErrorMap.url[0]
				const errorKey = `url:${error.message.toLowerCase().split(" ")[0]}`
				newFieldErrors.url = t(errorMessages[errorKey] || error.message)
			}

			setFieldErrors(newFieldErrors)

			// Set the main error message (prioritize URL errors)
			const error = fieldErrorMap.url?.[0] || validationErrors[0]
			const errorKey = `${error.field}:${error.message.toLowerCase().split(" ")[0]}`
			setError(t(errorMessages[errorKey] || "marketplace:sources.errors.invalidGitUrl"))
			return
		}
		manager.transition({
			type: "UPDATE_SOURCES",
			payload: { sources: [...state.sources, sourceToValidate] },
		})
		setNewSourceUrl("")
		setNewSourceName("")
		setError("")
	}

	const handleToggleSource = useCallback(
		(index: number) => {
			manager.transition({
				type: "UPDATE_SOURCES",
				payload: {
					sources: state.sources.map((source, i) =>
						i === index ? { ...source, enabled: !source.enabled } : source,
					),
				},
			})
		},
		[state.sources, manager],
	)

	const handleRemoveSource = useCallback(
		(index: number) => {
			manager.transition({
				type: "UPDATE_SOURCES",
				payload: {
					sources: state.sources.filter((_, i) => i !== index),
				},
			})
		},
		[state.sources, manager],
	)

	return (
		<div className="mx-auto">
			<h4 className="text-xl font-semibold text-vscode-foreground my-0">{t("marketplace:sources.title")}</h4>
			<p className="text-vscode-descriptionForeground mt-2 mb-4">{t("marketplace:sources.description")}</p>

			<div className="bg-vscode-panel-background">
				<div className="flex flex-col gap-2">
					<div className="relative">
						<Input
							type="text"
							placeholder={t("marketplace:sources.add.namePlaceholder")}
							value={newSourceName}
							onChange={(e) => {
								setNewSourceName(e.target.value.slice(0, 20))
								setError("")
								setFieldErrors((prev) => ({ ...prev, name: undefined }))

								// Live validation for emojis and length
								const value = e.target.value
								if (value && containsEmoji(value)) {
									setFieldErrors((prev) => ({
										...prev,
										name: t("marketplace:sources.errors.emojiName"),
									}))
								} else if (value.length >= 20) {
									setFieldErrors((prev) => ({
										...prev,
										name: t("marketplace:sources.errors.nameTooLong"),
									}))
								}
							}}
							maxLength={20}
							className={cn("pl-10", {
								"border-red-500 focus-visible:ring-red-500": fieldErrors.name,
							})}
							onBlur={() => validateFields()}
						/>
						<span className="absolute left-3 top-1/2 -translate-y-1/2 text-vscode-descriptionForeground">
							<span className="codicon codicon-tag"></span>
						</span>
						<span
							className={cn(
								"absolute right-3 top-1/2 -translate-y-1/2 text-xs",
								newSourceName.length >= 18 ? "text-amber-500" : "text-vscode-descriptionForeground",
								newSourceName.length >= 20 ? "text-red-500" : "",
							)}>
							{newSourceName.length}/20
						</span>
						{fieldErrors.name && <p className="text-xs text-red-500 mt-1 mb-0">{fieldErrors.name}</p>}
					</div>
					<div className="relative">
						<Input
							type="text"
							placeholder={t("marketplace:sources.add.urlPlaceholder")}
							value={newSourceUrl}
							onChange={(e) => {
								setNewSourceUrl(e.target.value)
								setError("")
								setFieldErrors((prev) => ({ ...prev, url: undefined }))

								// Live validation for empty URL
								if (!e.target.value.trim()) {
									setFieldErrors((prev) => ({
										...prev,
										url: t("marketplace:sources.errors.emptyUrl"),
									}))
								}
							}}
							className={cn("pl-10", {
								"border-red-500 focus-visible:ring-red-500": fieldErrors.url,
							})}
							onBlur={() => validateFields()}
						/>
						<span className="absolute left-3 top-1/2 -translate-y-1/2 text-vscode-descriptionForeground">
							<span className="codicon codicon-link"></span>
						</span>
						{fieldErrors.url && <p className="text-xs text-red-500 mt-1 mb-0">{fieldErrors.url}</p>}
					</div>
					<p className="text-xs text-vscode-descriptionForeground m-0">
						{t("marketplace:sources.add.urlFormats")}
					</p>
				</div>
				{error && (
					<div className="flex flex-col items-center justify-center mb-0 mt-2">
						<p className="text-red-500 p-2 bg-red-100 dark:bg-red-900 dark:bg-opacity-20 rounded-md flex items-center w-full my-0">
							<span className="codicon codicon-error mr-2"></span>
							{error}
						</p>
					</div>
				)}
				<Button
					onClick={handleAddSource}
					className="mt-2 w-full shadow-none border-none"
					disabled={!!fieldErrors.name || !!fieldErrors.url || !newSourceUrl.trim()}>
					<span className="codicon codicon-add"></span>
					{t("marketplace:sources.add.button")}
				</Button>
			</div>

			<div className="flex items-center justify-between pb-2 pt-4">
				<div className="flex items-center">
					<span className="codicon codicon-repo mr-2"></span>
					<span className="text-base font-medium text-vscode-foreground">
						{t("marketplace:sources.current.title")}
					</span>
				</div>
				<span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
					{state.sources.length} / 10
				</span>
			</div>

			{state.sources.length === 0 ? (
				<div className="flex flex-col items-center justify-center h-64 text-vscode-descriptionForeground animate-fade-in border border-dashed border-vscode-panel-border rounded-lg bg-vscode-panel-background bg-opacity-80 text-center">
					<span className="codicon codicon-inbox text-5xl mb-4 opacity-70"></span>
					<p className="font-medium">{t("marketplace:sources.current.empty")}</p>
					<p className="text-sm mt-2">{t("marketplace:sources.current.emptyHint")}</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3 pb-3">
					{state.sources.map((source, index) => (
						<div
							key={source.url}
							className={cn(
								"group flex items-center justify-between p-2 border rounded-sm bg-vscode-panel-background",
								{
									"border-vscode-input-border": source.enabled,
									"border-dashed border-vscode-input-border opacity-75": !source.enabled,
								},
							)}
							style={{ animationDelay: `${index * 40}ms` }}>
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<div className="px-1">
										<Checkbox
											id={`source-${index}`}
											checked={source.enabled}
											onCheckedChange={() => handleToggleSource(index)}
											variant="description"
										/>
									</div>
									<div>
										<p
											className={cn(
												"text-vscode-foreground font-medium my-0",
												!source.enabled && "text-vscode-disabledForeground",
											)}>
											{source.name || source.url}
										</p>
										{source.name && (
											<p className="text-xs text-vscode-descriptionForeground my-0 flex items-center">
												{source.url}
											</p>
										)}
									</div>
								</div>
							</div>
							<div className="flex items-center">
								<Button
									variant="ghost"
									size="icon"
									onClick={() =>
										manager.transition({ type: "REFRESH_SOURCE", payload: { url: source.url } })
									}
									title={t("marketplace:sources.current.refresh")}
									className="text-vscode-foreground"
									disabled={state.refreshingUrls.includes(source.url)}>
									<span
										className={cn(
											"codicon",
											state.refreshingUrls.includes(source.url)
												? "codicon-sync codicon-modifier-spin"
												: "codicon-refresh",
										)}></span>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => handleRemoveSource(index)}
									title={t("marketplace:sources.current.remove")}
									className="text-vscode-errorForeground hover:bg-vscode-errorForeground/10 hover:text-vscode-errorForeground">
									<span className="codicon codicon-trash"></span>
								</Button>
								<Button variant="ghost" size="icon" className="text-vscode-foreground">
									<span className="codicon codicon-link-external"></span>
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
