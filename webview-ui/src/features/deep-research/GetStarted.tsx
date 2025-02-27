import { useCallback, useEffect, useState } from "react"
import { useForm, FormProvider, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleBackslashIcon } from "@radix-ui/react-icons"
import { ChevronsUpDown, ChevronsDownUp, BrainCircuit } from "lucide-react"

import { cn } from "@/lib/utils"
import {
	Button,
	Slider,
	AutosizeTextarea,
	Input,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui"

import {
	deepResearchModels,
	ProviderId,
	ResearchSession,
	researchSessionSchema,
	validateFirecrawlApiKey,
} from "./types"
import { useResearchSession } from "./useResearchSession"
import { useProvider } from "./useProvider"
import { Providers } from "./Providers"
import { Models } from "./Models"

export const GetStarted = () => {
	const [isProvidersOpen, setIsProvidersOpen] = useState(false)
	const [isValidatingFirecrawl, setIsValidatingFirecrawl] = useState(false)
	const [firecrawlError, setFirecrawlError] = useState<string | null>(null)
	const { setSession } = useResearchSession()
	const { provider, providers, setProviderValue } = useProvider()

	const form = useForm<ResearchSession>({
		resolver: zodResolver(researchSessionSchema),
		defaultValues: {
			providerId: provider?.providerId,
			providerApiKey: provider?.providerApiKey,
			firecrawlApiKey: provider?.firecrawlApiKey,
			modelId: deepResearchModels[0].modelIds[provider?.providerId ?? ProviderId.OpenRouter],
			breadth: 4,
			depth: 2,
			query: "",
			concurrency: 1,
		},
	})

	const {
		handleSubmit,
		control,
		setValue,
		getValues,
		formState: { errors },
	} = form

	const onSubmit = useCallback(
		async (data: ResearchSession) => {
			// Check for empty key first
			if (!data.firecrawlApiKey) {
				setFirecrawlError("Firecrawl API key is required.")
				setIsProvidersOpen(true)
				return
			}

			// Validate Firecrawl API key before submission
			setIsValidatingFirecrawl(true)
			try {
				const isValid = await validateFirecrawlApiKey(data.firecrawlApiKey)
				if (!isValid) {
					setFirecrawlError("Invalid Firecrawl API key. Please check your credentials.")
					setIsProvidersOpen(true)
					return
				}
				setFirecrawlError(null)
				setSession(data)
			} catch (error) {
				setFirecrawlError("Failed to validate Firecrawl API key. Please try again.")
				setIsProvidersOpen(true)
			} finally {
				setIsValidatingFirecrawl(false)
			}
		},
		[setSession, setIsProvidersOpen],
	)

	useEffect(() => {
		setValue("providerId", provider?.providerId ?? ProviderId.OpenRouter)
		setValue("providerApiKey", provider?.providerApiKey ?? "")
		setValue("firecrawlApiKey", provider?.firecrawlApiKey ?? "")
	}, [provider, setValue])

	useEffect(() => {
		if (errors.providerId || errors.providerApiKey || errors.firecrawlApiKey) {
			setIsProvidersOpen(true)
		}
	}, [errors.providerId, errors.providerApiKey, errors.firecrawlApiKey])

	return (
		<div className="flex flex-col gap-4">
			<Hero />
			<FormProvider {...form}>
				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
					{providers?.length ? (
						<Card>
							<Collapsible open={isProvidersOpen} onOpenChange={setIsProvidersOpen}>
								<div className="flex items-center justify-between">
									<div className="text-muted-foreground">
										{provider && !isProvidersOpen
											? `${provider.providerName} (${provider.profileName})`
											: "API Configuration"}
									</div>
									<CollapsibleTrigger asChild>
										<Button variant="ghost" size="icon">
											{isProvidersOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
										</Button>
									</CollapsibleTrigger>
								</div>
								<CollapsibleContent className="flex flex-col gap-4 mt-1">
									<div className="flex flex-col gap-1">
										<div>Profile</div>
										<Providers />
										<div className="text-muted-foreground">
											Deep Research leverages structured LLM outputs and therefore only OpenRouter
											and OpenAI providers are currently supported.
										</div>
									</div>
									<Controller
										name="providerApiKey"
										control={control}
										render={({ field }) => (
											<div className="xflex flex-col gap-1 hidden">
												<div>{provider?.providerName} API Key</div>
												<Input
													{...field}
													type="password"
													placeholder={
														provider ? `${provider.providerName} API Key` : "API Key"
													}
													className="flex-1"
												/>
											</div>
										)}
									/>
									<Controller
										name="firecrawlApiKey"
										control={control}
										render={({ field }) => (
											<div className="flex flex-col gap-1">
												<div>Firecrawl API Key</div>
												<Input
													{...field}
													type="password"
													placeholder="fc-..."
													className={cn(
														"flex-1",
														(errors.firecrawlApiKey || firecrawlError) &&
															"border-destructive",
													)}
													onKeyDown={async (e) => {
														if (e.key === "Enter") {
															e.preventDefault() // Prevent form submission
															if (field.value) {
																setIsValidatingFirecrawl(true)
																setFirecrawlError(null)
																try {
																	const isValid = await validateFirecrawlApiKey(
																		field.value,
																	)
																	if (!isValid) {
																		setFirecrawlError(
																			"Invalid Firecrawl API key. Please check your credentials.",
																		)
																	}
																} catch (error) {
																	setFirecrawlError(
																		"Failed to validate Firecrawl API key. Please try again.",
																	)
																} finally {
																	setIsValidatingFirecrawl(false)
																}
															}
														}
													}}
													onBlur={async () => {
														setProviderValue("firecrawlApiKey", field.value)
														if (field.value) {
															setIsValidatingFirecrawl(true)
															setFirecrawlError(null)
															try {
																const isValid = await validateFirecrawlApiKey(
																	field.value,
																)
																if (!isValid) {
																	setFirecrawlError(
																		"Invalid Firecrawl API key. Please check your credentials.",
																	)
																}
															} catch (error) {
																setFirecrawlError(
																	"Failed to validate Firecrawl API key. Please try again.",
																)
															} finally {
																setIsValidatingFirecrawl(false)
															}
														}
													}}
												/>
												{(errors.firecrawlApiKey || firecrawlError) && (
													<div className="text-destructive text-sm">
														{firecrawlError || errors.firecrawlApiKey?.message}
													</div>
												)}
												{isValidatingFirecrawl && (
													<div className="text-muted-foreground text-sm">
														Validating API key...
													</div>
												)}
												<div className="flex flex-row items-center justify-between gap-2">
													<div className="text-muted-foreground">
														Firecrawl turns websites into LLM-ready data.
													</div>
													<Button
														variant="outline"
														size="sm"
														asChild
														tabIndex={-1} // Remove from tab order
													>
														<a href="https://www.firecrawl.com/">Get API Key</a>
													</Button>
												</div>
											</div>
										)}
									/>
								</CollapsibleContent>
							</Collapsible>
						</Card>
					) : (
						<Card className="flex-row items-center">
							<CircleBackslashIcon className="text-destructive shrink-0" />
							<div className="text-muted-foreground">
								Deep research requires usage of an OpenAI model. Please create an OpenAI or OpenRouter
								profile to get started.
							</div>
						</Card>
					)}
					<Card title="Deep Research Parameters">
						<Controller
							name="breadth"
							control={control}
							render={({ field: { value, onChange } }) => (
								<div className="flex flex-row items-center gap-3">
									<div className="w-24 whitespace-nowrap shrink-0 text-right">
										Breadth <span className="text-muted-foreground">({value})</span>
									</div>
									<Slider
										min={1}
										max={10}
										step={1}
										value={[value]}
										onValueChange={(values) => onChange(values[0])}
									/>
								</div>
							)}
						/>
						<Controller
							name="depth"
							control={control}
							render={({ field: { value, onChange } }) => (
								<div className="flex flex-row items-center gap-3">
									<div className="w-24 whitespace-nowrap shrink-0 text-right">
										Depth <span className="text-muted-foreground">({value})</span>
									</div>
									<Slider
										min={0}
										max={9}
										step={1}
										value={[value]}
										onValueChange={(values) => onChange(values[0])}
									/>
								</div>
							)}
						/>
						<Controller
							name="concurrency"
							control={control}
							render={({ field: { value, onChange } }) => (
								<div className="flex flex-row items-center gap-3">
									<div className="w-24 whitespace-nowrap shrink-0 text-right">
										Concurrency <span className="text-muted-foreground">({value})</span>
									</div>
									<Slider
										min={1}
										max={5}
										step={1}
										value={[value]}
										onValueChange={(values) => onChange(values[0])}
									/>
								</div>
							)}
						/>
						{provider && <Models className="w-full" />}
						<Controller
							name="query"
							control={control}
							render={({ field }) => (
								<AutosizeTextarea
									{...field}
									placeholder="What would you like me to research?"
									minHeight={75}
									maxHeight={200}
									className="p-3"
								/>
							)}
						/>
					</Card>
					<Button
						variant="default"
						size="lg"
						type="submit"
						disabled={isValidatingFirecrawl || !!firecrawlError || !getValues("firecrawlApiKey")}>
						<span className="codicon codicon-rocket" />
						<span className="font-bold text-lg">Start</span>
					</Button>
					<div className="flex flex-col gap-1">
						{Object.entries(errors).map(([field, error]) => (
							<div key={field} className="text-red-500">
								{error?.message}
							</div>
						))}
						{firecrawlError && <div className="text-red-500">{firecrawlError}</div>}
					</div>
				</form>
			</FormProvider>
		</div>
	)
}

const Hero = () => (
	<div className="flex flex-col gap-4 w-full">
		<div className="flex flex-col items-center justify-center gap-2">
			<div className="flex flex-row items-center justify-center gap-2">
				<BrainCircuit className="text-muted" />
				<h2 className="my-0">Deep Research (β)</h2>
			</div>
			<h3 className="text-vscode-button-background my-0">The ultimate planner.</h3>
		</div>
		<Card>
			<div>Get detailed insights on any topic by synthesizing large amounts of online information.</div>
			<div>
				Complete multi-step research tasks that can be fed into a Roo Code task to super-charge its problem
				solving abilities.
			</div>
		</Card>
	</div>
)

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
	title?: string
}

const Card = ({ title, className, children, ...props }: CardProps) => (
	<div className={cn("flex flex-col gap-4 bg-vscode-editor-background p-4 rounded-xs", className)} {...props}>
		{title && <div className="text-muted-foreground">{title}</div>}
		{children}
	</div>
)
