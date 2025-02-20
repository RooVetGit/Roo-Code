import { useEffect, useMemo, useState } from "react"
import { useFormContext, Controller } from "react-hook-form"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui"

import { DeepResearchModel, ProviderId, ResearchSession, deepResearchModels } from "./types"
import { useProvider } from "./useProvider"
import { formatTokenCount, formatCurrency, toSentenceCase } from "./format"

type ButtonProps = React.HTMLAttributes<HTMLButtonElement>

export function Models({ className, ...props }: ButtonProps) {
	const [open, setOpen] = useState(false)
	const { control, setValue, watch } = useFormContext<ResearchSession>()
	const { provider } = useProvider()
	const [model, setModel] = useState<DeepResearchModel>()

	const models = useMemo(
		() => (provider ? deepResearchModels.map((model) => model.modelIds[provider.providerId]) : undefined),
		[provider],
	)

	useEffect(() => {
		setValue("modelId", deepResearchModels[0].modelIds[provider?.providerId || ProviderId.OpenRouter])
	}, [provider, setValue])

	const modelId = watch("modelId")

	useEffect(() => {
		setModel(
			modelId ? deepResearchModels.find(({ modelIds }) => Object.values(modelIds).includes(modelId)) : undefined,
		)
	}, [modelId, setValue])

	return models ? (
		<Controller
			name="modelId"
			control={control}
			render={({ field: { value, onChange } }) => (
				<>
					<Popover open={open} onOpenChange={setOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="combobox"
								role="combobox"
								aria-expanded={open}
								className={cn(className, open && "border-vscode-focusBorder")}
								{...props}>
								{value ?? "Select"}
								<ChevronsUpDown className="opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="max-w-[200px] p-0">
							<Command>
								<CommandInput placeholder="Search" className="h-9" />
								<CommandList>
									<CommandEmpty>No model found.</CommandEmpty>
									<CommandGroup>
										{models.map((model) => (
											<CommandItem
												key={model}
												value={model}
												onSelect={(currentValue) => {
													onChange(currentValue)
													setOpen(false)
												}}>
												{model}
												<Check
													className={cn(
														"ml-auto",
														value === model ? "opacity-100" : "opacity-0",
													)}
												/>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					{model && (
						<div>
							<div>Context Window: {formatTokenCount(model.contextWindow)}</div>
							<div>Input Price: {formatCurrency(model.inputPrice)} / 1M Tokens</div>
							<div>Output Price: {formatCurrency(model.outputPrice)} / 1M Tokens</div>
							{model.reasoningEffort && (
								<div>Reasoning Effort: {toSentenceCase(model.reasoningEffort)}</div>
							)}
						</div>
					)}
				</>
			)}
		/>
	) : null
}
