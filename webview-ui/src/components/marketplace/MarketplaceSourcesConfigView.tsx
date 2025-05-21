import { MarketplaceSource } from "../../../../src/services/marketplace/types"
import { MarketplaceViewStateManager } from "./MarketplaceViewStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useStateManager } from "./useStateManager"
import { validateSource } from "@roo/shared/MarketplaceValidation"
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

	const handleAddSource = () => {
		const MAX_SOURCES = 10
		if (state.sources.length >= MAX_SOURCES) {
			setError(t("marketplace:sources.errors.maxSources", { max: MAX_SOURCES }))
			return
		}
		const sourceToValidate: MarketplaceSource = {
			url: newSourceUrl,
			name: newSourceName || undefined,
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
			const error = validationErrors[0]
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
							}}
							maxLength={20}
							className="pl-10"
						/>
						<span className="absolute left-3 top-1/2 -translate-y-1/2 text-vscode-descriptionForeground">
							<span className="codicon codicon-tag"></span>
						</span>
						<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-vscode-descriptionForeground">
							{newSourceName.length}/20
						</span>
					</div>
					<div className="relative">
						<Input
							type="text"
							placeholder={t("marketplace:sources.add.urlPlaceholder")}
							value={newSourceUrl}
							onChange={(e) => {
								setNewSourceUrl(e.target.value)
								setError("")
							}}
							className="pl-10"
						/>
						<span className="absolute left-3 top-1/2 -translate-y-1/2 text-vscode-descriptionForeground">
							<span className="codicon codicon-link"></span>
						</span>
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
				<Button onClick={handleAddSource} className="mt-2 w-full shadow-none border-none">
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
