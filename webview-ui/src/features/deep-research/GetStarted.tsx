import * as React from "react"
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
} from "@/components/ui"
import { useMemo } from "react"

export const GetStarted = () => {
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
					Complete multi-step research tasks that can be feed into a Roo Code task to super-charge its problem
					solving abilities.
				</div>
			</div>
			<Models />
			<div className="flex flex-row items-center gap-2">
				<div className="w-14 shrink-0">Breadth</div>
				<Slider max={10} step={1} defaultValue={[4]} />
			</div>
			<div className="flex flex-row items-center gap-2">
				<div className="w-14 shrink-0">Depth</div>
				<Slider max={10} step={1} defaultValue={[2]} />
			</div>
			<Button>Start Researching</Button>
		</div>
	)
}

export function Models() {
	const [open, setOpen] = React.useState(false)
	const [value, setValue] = React.useState("o3-mini")
	const models = useMemo(() => Object.keys(openAiNativeModels), [])

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<div className="flex flex-row items-center gap-2">
				<div className="w-14 shrink-0">Model</div>
				<PopoverTrigger asChild>
					<Button variant="outline" role="combobox" aria-expanded={open} className="flex-1">
						{value ? models.find((model) => model === value) : "Select"}
						<ChevronsUpDown className="opacity-50" />
					</Button>
				</PopoverTrigger>
			</div>
			<PopoverContent className="w-[200px] p-0">
				<Command>
					<CommandInput placeholder="Search" className="h-9" />
					<CommandList>
						<CommandEmpty>No model found.</CommandEmpty>
						<CommandGroup>
							{models.map((models) => (
								<CommandItem
									key={models}
									value={models}
									onSelect={(currentValue) => {
										setValue(currentValue === value ? "" : currentValue)
										setOpen(false)
									}}>
									{models}
									<Check className={cn("ml-auto", value === models ? "opacity-100" : "opacity-0")} />
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
