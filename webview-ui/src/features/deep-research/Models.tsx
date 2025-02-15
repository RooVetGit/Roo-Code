import { useEffect, useMemo, useState } from "react"
import { useFormContext, Controller } from "react-hook-form"
import { Check, ChevronsUpDown } from "lucide-react"

import { openAiNativeModels } from "../../../../src/shared/api"

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

import { Session } from "./types"
import { useProvider } from "./useProvider"

export function Models() {
	const [open, setOpen] = useState(false)
	const { control, setValue } = useFormContext<Session>()
	const { provider } = useProvider()

	const models = useMemo(() => {
		if (provider?.providerId === "openai-native") {
			return Object.keys(openAiNativeModels)
		}

		if (provider?.providerId === "openrouter") {
			return [
				"openai/o3-mini-high",
				"openai/o3-mini",
				"openai/o1",
				"openai/o1-preview",
				"openai/o1-mini",
				"openai/gpt-4o",
				"openai/gpt-4o-mini",
			]
		}

		return undefined
	}, [provider])

	useEffect(() => {
		setValue("modelId", models?.[0] ?? "")
	}, [models, setValue])

	return models ? (
		<Controller
			name="modelId"
			control={control}
			render={({ field: { value, onChange } }) => (
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="combobox"
							role="combobox"
							aria-expanded={open}
							className={cn("flex-1", open && "border-vscode-focusBorder")}>
							{value ? models.find((model) => model === value) : "Select"}
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
												className={cn("ml-auto", value === model ? "opacity-100" : "opacity-0")}
											/>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			)}
		/>
	) : null
}
