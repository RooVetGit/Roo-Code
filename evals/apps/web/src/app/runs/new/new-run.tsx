"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import fuzzysort from "fuzzysort"
import { toast } from "sonner"
import { X, Rocket, Check, ChevronsUpDown, HardDriveUpload, CircleCheck, Save, ArrowLeft } from "lucide-react"

import { globalSettingsSchema, providerSettingsSchema, rooCodeDefaults } from "@evals/types"

import { createRun } from "@/lib/server/runs"
import {
	createRunSchema as formSchema,
	type CreateRun as FormValues,
	CONCURRENCY_MIN,
	CONCURRENCY_MAX,
	CONCURRENCY_DEFAULT,
} from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { useOpenRouterModels } from "@/hooks/use-open-router-models"
import { useExercises } from "@/hooks/use-exercises"
import {
	Button,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Textarea,
	Tabs,
	TabsList,
	TabsTrigger,
	MultiSelect,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ScrollArea,
	Slider,
} from "@/components/ui"

import { SettingsDiff } from "./settings-diff"
import { SettingsProfiles } from "./settings-profiles"
import { AgentRunConfiguration } from "./agent-run-configuration" // Renamed import

export function NewRun() {
	const router = useRouter()

	// Check for saved profiles on mount and set mode accordingly
	const [mode, setMode] = useState<"openrouter" | "settings">("openrouter")
	const [savedProfilesExist, setSavedProfilesExist] = useState(false)

	// Check if there are saved profiles on component mount
	useEffect(() => {
		try {
			const savedProfiles = localStorage.getItem("settingsProfiles")
			if (savedProfiles) {
				const profiles = JSON.parse(savedProfiles)
				if (profiles && Array.isArray(profiles) && profiles.length > 0) {
					setSavedProfilesExist(true)
					// Don't automatically switch to settings mode to allow OpenRouter model selection
				}
			}
		} catch (error) {
			console.error("Error checking for saved profiles:", error)
		}
	}, [])

	const [modelSearchValue, setModelSearchValue] = useState("")
	const [modelPopoverOpen, setModelPopoverOpen] = useState(false)
	const modelSearchResultsRef = useRef<Map<string, number>>(new Map())
	const modelSearchValueRef = useRef("")
	const models = useOpenRouterModels()

	const exercises = useExercises()

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			model: "",
			description: "",
			suite: "full",
			exercises: [],
			settings: undefined,
			concurrency: CONCURRENCY_DEFAULT,
		},
	})

	const {
		setValue,
		clearErrors,
		watch,
		formState: { isSubmitting },
	} = form

	const [model, suite, settings, concurrency] = watch(["model", "suite", "settings", "concurrency"])

	const onSubmit = useCallback(
		async (values: FormValues) => {
			try {
				if (mode === "openrouter") {
					const openRouterModel = models.data?.find(({ id }) => id === model)

					if (!openRouterModel) {
						console.error(
							`Model not found: ${model}. Available models:`,
							models.data?.map((m) => m.id),
						)
						throw new Error(`Model not found: ${model}. Please try importing the profile again.`)
					}

					const openRouterModelId = openRouterModel.id
					// Ensure settings object exists and merge defaults, existing form settings, and OpenRouter specifics
					const currentFormSettings = form.getValues("settings") || {}
					values.settings = {
						...rooCodeDefaults, // Start with base defaults
						...currentFormSettings, // Merge any user-configured settings
						apiProvider: "openrouter", // Set the provider
						openRouterModelId, // Set the specific model
						// Add necessary OpenRouter specific defaults if not already present
						openRouterUseMiddleOutTransform:
							currentFormSettings.openRouterUseMiddleOutTransform ??
							rooCodeDefaults.openRouterUseMiddleOutTransform ?? // Use schema default
							false, // Final fallback
					}
				} else {
					// For "Settings Profiles" mode, ensure defaults are merged if settings exist
					if (values.settings) {
						values.settings = {
							...rooCodeDefaults,
							...values.settings,
						}
					}
				}

				const { id } = await createRun(values)
				router.push(`/runs/${id}`)
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "An unknown error occurred.")
			}
		},
		[mode, model, models.data, router],
	)

	const onFilterModels = useCallback(
		(value: string, search: string) => {
			if (modelSearchValueRef.current !== search) {
				modelSearchValueRef.current = search
				modelSearchResultsRef.current.clear()

				for (const {
					obj: { id },
					score,
				} of fuzzysort.go(search, models.data || [], {
					key: "name",
				})) {
					modelSearchResultsRef.current.set(id, score)
				}
			}

			return modelSearchResultsRef.current.get(value) ?? 0
		},
		[models.data],
	)

	const onSelectModel = useCallback(
		(model: string) => {
			setValue("model", model)
			setModelPopoverOpen(false)
		},
		[setValue],
	)

	const onImportSettings = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0]

			if (!file) {
				return
			}

			clearErrors("settings")

			try {
				const { providerProfiles, globalSettings } = z
					.object({
						providerProfiles: z.object({
							currentApiConfigName: z.string(),
							apiConfigs: z.record(z.string(), providerSettingsSchema),
						}),
						globalSettings: globalSettingsSchema,
					})
					.parse(JSON.parse(await file.text()))

				const providerSettings = providerProfiles.apiConfigs[providerProfiles.currentApiConfigName] ?? {}

				const {
					apiProvider,
					apiModelId,
					openRouterModelId,
					glamaModelId,
					requestyModelId,
					unboundModelId,
					ollamaModelId,
					lmStudioModelId,
					openAiModelId,
				} = providerSettings

				switch (apiProvider) {
					case "anthropic":
					case "bedrock":
					case "deepseek":
					case "gemini":
					case "mistral":
					case "openai-native":
					case "xai":
					case "vertex":
						setValue("model", apiModelId ?? "")
						break
					case "openrouter":
						setValue("model", openRouterModelId ?? "")
						break
					case "glama":
						setValue("model", glamaModelId ?? "")
						break
					case "requesty":
						setValue("model", requestyModelId ?? "")
						break
					case "unbound":
						setValue("model", unboundModelId ?? "")
						break
					case "openai":
						setValue("model", openAiModelId ?? "")
						break
					case "ollama":
						setValue("model", ollamaModelId ?? "")
						break
					case "lmstudio":
						setValue("model", lmStudioModelId ?? "")
						break
					default:
						throw new Error(`Unsupported API provider: ${apiProvider}`)
				}

				const mergedSettings = { ...rooCodeDefaults, ...providerSettings, ...globalSettings }
				setValue("settings", mergedSettings)
				setMode("settings")

				event.target.value = ""
			} catch (e) {
				console.error(e)
				toast.error(e instanceof Error ? e.message : "An unknown error occurred.")
			}
		},
		[clearErrors, setValue],
	)

	return (
		<>
			<div className="flex justify-between items-center mb-4">
				<Button variant="outline" size="sm" onClick={() => router.push("/")} title="Back to runs">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Runs
				</Button>
				<h1 className="text-2xl font-bold">New Evaluation Run</h1>
			</div>

			<div className="mb-6">
				<Tabs value={mode} onValueChange={(value) => setMode(value as "openrouter" | "settings")}>
					<TabsList>
						<TabsTrigger value="openrouter">OpenRouter Model</TabsTrigger>
						<TabsTrigger value="settings">Settings Profiles</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>
			<FormProvider {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="flex flex-col justify-center divide-y divide-primary *:py-5">
					<div className="flex flex-row justify-between gap-4">
						{mode === "openrouter" && (
							<div className="flex-1">
								<FormField
									control={form.control}
									name="model"
									render={() => (
										<FormItem className="flex-1">
											<Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
												<PopoverTrigger asChild>
													<Button
														variant="input"
														role="combobox"
														aria-expanded={modelPopoverOpen}
														className="flex items-center justify-between">
														<div>
															{models.data?.find(({ id }) => id === model)?.name ||
																model ||
																"Select OpenRouter Model"}
														</div>
														<ChevronsUpDown className="opacity-50" />
													</Button>
												</PopoverTrigger>
												<PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
													<Command filter={onFilterModels}>
														<CommandInput
															placeholder="Search"
															value={modelSearchValue}
															onValueChange={setModelSearchValue}
															className="h-9"
														/>
														<CommandList>
															<CommandEmpty>No model found.</CommandEmpty>
															<CommandGroup>
																{models.data?.map(({ id, name }) => (
																	<CommandItem
																		key={id}
																		value={id}
																		onSelect={onSelectModel}>
																		{name}
																		<Check
																			className={cn(
																				"ml-auto text-accent group-data-[selected=true]:text-accent-foreground size-4",
																				id === model
																					? "opacity-100"
																					: "opacity-0",
																			)}
																		/>
																	</CommandItem>
																))}
															</CommandGroup>
														</CommandList>
													</Command>
												</PopoverContent>
											</Popover>
											<FormMessage />
										</FormItem>
									)}
								/>

								{/* AdvancedSettings moved below */}
							</div>
						)}

						<FormItem className="flex-1">
							{/* Always show SettingsProfiles if saved profiles exist */}
							{(mode === "settings" || savedProfilesExist) && (
								<div className="mb-4">
									<SettingsProfiles
										currentSettings={settings}
										onSelectProfile={(profileSettings) => {
											setValue("settings", profileSettings)

											// Try to set the model based on the profile settings
											const {
												apiProvider,
												apiModelId,
												openRouterModelId,
												glamaModelId,
												requestyModelId,
												unboundModelId,
												ollamaModelId,
												lmStudioModelId,
												openAiModelId,
											} = profileSettings || {}

											// Set the model ID based on provider
											let modelId = ""
											switch (apiProvider) {
												case "anthropic":
												case "bedrock":
												case "deepseek":
												case "gemini":
												case "mistral":
												case "openai-native":
												case "xai":
												case "vertex":
													modelId = apiModelId || ""
													break
												case "openrouter":
													modelId = openRouterModelId || ""
													break
												case "glama":
													modelId = glamaModelId || ""
													break
												case "requesty":
													modelId = requestyModelId || ""
													break
												case "unbound":
													modelId = unboundModelId || ""
													break
												case "openai":
													modelId = openAiModelId || ""
													break
												case "ollama":
													modelId = ollamaModelId || ""
													break
												case "lmstudio":
													modelId = lmStudioModelId || ""
													break
											}

											// Set the model and switch to the appropriate mode
											setValue("model", modelId)
											if (apiProvider === "openrouter") {
												setMode("openrouter")
											} else {
												setMode("settings")
											}
										}}
									/>
								</div>
							)}
							<div className="flex flex-wrap gap-2 items-center">
								<Button
									type="button"
									variant="secondary"
									onClick={() => document.getElementById("json-upload")?.click()}>
									<HardDriveUpload className="mr-2 h-4 w-4" />
									Import Settings
								</Button>

								{savedProfilesExist && !settings && (
									<div className="text-sm text-muted-foreground ml-2">
										You have saved profiles available. Click "Load Profile" to use them.
									</div>
								)}
							</div>
							<input
								id="json-upload"
								type="file"
								accept="application/json"
								className="hidden"
								onChange={onImportSettings}
							/>
							{settings && (
								<ScrollArea className="max-h-64 border rounded-sm">
									<>
										<div className="flex items-center gap-1 p-2 border-b">
											<CircleCheck className="size-4 text-ring" />
											<div className="text-sm">
												Imported valid Roo Code settings. Showing differences from default
												settings.
											</div>
										</div>
										<SettingsDiff defaultSettings={rooCodeDefaults} customSettings={settings} />
									</>
								</ScrollArea>
							)}
							<FormMessage />
						</FormItem>
					</div>
					{/* Render AgentRunConfiguration below the main row if in openrouter mode */}
					{mode === "openrouter" && <AgentRunConfiguration />}

					<FormField
						control={form.control}
						name="suite"
						render={() => (
							<FormItem>
								<FormLabel>Exercises</FormLabel>
								<Tabs
									defaultValue="full"
									onValueChange={(value) => setValue("suite", value as "full" | "partial")}>
									<TabsList>
										<TabsTrigger value="full">All</TabsTrigger>
										<TabsTrigger value="partial">Some</TabsTrigger>
									</TabsList>
								</Tabs>
								{suite === "partial" && (
									<MultiSelect
										options={exercises.data?.map((path) => ({ value: path, label: path })) || []}
										onValueChange={(value) => setValue("exercises", value)}
										placeholder="Select"
										variant="inverted"
										maxCount={4}
									/>
								)}
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="concurrency"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Concurrency</FormLabel>
								<FormControl>
									<div className="flex flex-row items-center gap-2">
										<Slider
											defaultValue={[field.value]}
											min={CONCURRENCY_MIN}
											max={CONCURRENCY_MAX}
											step={1}
											onValueChange={(value) => field.onChange(value[0])}
										/>
										<div>{field.value}</div>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Description / Notes</FormLabel>
								<FormControl>
									<Textarea placeholder="Optional" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="flex justify-end">
						<Button size="lg" type="submit" disabled={isSubmitting}>
							<Rocket className="size-4" />
							Launch
						</Button>
					</div>
				</form>
			</FormProvider>
			<Button
				variant="default"
				className="absolute top-4 right-12 size-12 rounded-full"
				onClick={() => router.push("/")}>
				<X className="size-6" />
			</Button>
		</>
	)
}
