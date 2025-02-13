import { useMemo, useState } from "react"
import { useForm, FormProvider, useFormContext, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { BrainCircuit, Check, ChevronsUpDown } from "lucide-react"

import { openAiNativeModels } from "../../../../src/shared/api"

import { cn } from "@/lib/utils"
import {
	Button,
	Slider,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
	AutosizeTextarea,
	Input,
} from "@/components/ui"

import { useSession } from "./useSession"
import { Session, sessionSchema } from "./types"

export const GetStarted = () => {
	const { setSession } = useSession()

	const form = useForm<Session>({
		resolver: zodResolver(sessionSchema),
		defaultValues: {
			breadth: 4,
			depth: 2,
			modelId: "o3-mini",
			query: "",
			firecrawlApiKey: "",
			openaiApiKey: "",
		},
	})

	const { handleSubmit, control } = form

	return (
		<div className="flex flex-col gap-4 w-full max-w-sm px-4">
			<div className="flex flex-col items-center justify-center gap-2">
				<div className="flex flex-row items-center justify-center gap-2">
					<BrainCircuit className="text-muted" />
					<h2 className="my-0">Open Deep Research</h2>
				</div>
				<h3 className="my-0">
					The ultimate <span className="text-vscode-badge-background">planner</span>.
				</h3>
			</div>
			<div className="flex flex-col gap-2 bg-vscode-editor-background p-4 rounded-sm">
				<div>Get detailed insights on any topic by synthesizing large amounts of online information.</div>
				<div>
					Complete multi-step research tasks that can be fed into a Roo Code task to super-charge its problem
					solving abilities.
				</div>
			</div>
			<FormProvider {...form}>
				<form onSubmit={handleSubmit(setSession)} className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<div>OpenAI Model</div>
						<Models />
					</div>
					<Controller
						name="openaiApiKey"
						control={control}
						render={({ field }) => (
							<div className="flex flex-col gap-1">
								<div>OpenAI API Key</div>
								<Input {...field} type="password" placeholder="sk-..." className="flex-1" />
							</div>
						)}
					/>
					<Controller
						name="firecrawlApiKey"
						control={control}
						render={({ field }) => (
							<div className="flex flex-col gap-1">
								<div>Firecrawl API Key</div>
								<Input {...field} type="password" placeholder="fc-..." className="flex-1" />
							</div>
						)}
					/>
					<Controller
						name="breadth"
						control={control}
						render={({ field: { value, onChange } }) => (
							<div className="flex flex-row items-center gap-2">
								<div className="w-14 shrink-0">Breadth</div>
								<Slider
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
							<div className="flex flex-row items-center gap-2">
								<div className="w-14 shrink-0">Depth</div>
								<Slider
									max={10}
									step={1}
									value={[value]}
									onValueChange={(values) => onChange(values[0])}
								/>
							</div>
						)}
					/>
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
					<Button type="submit">Start Researching</Button>
				</form>
			</FormProvider>
		</div>
	)
}

export function Models() {
	const [open, setOpen] = useState(false)
	const { control } = useFormContext<Session>()
	const models = useMemo(() => Object.keys(openAiNativeModels), [])

	return (
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
							className={cn(open && "border-vscode-focusBorder")}>
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
	)
}
