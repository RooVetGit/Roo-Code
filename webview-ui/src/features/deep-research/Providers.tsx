import { useCallback, useState } from "react"
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

import { useProvider } from "./useProvider"

export function Providers() {
	const [open, setOpen] = useState(false)
	const { provider, providers, setProvider } = useProvider()

	const onSelect = useCallback(
		(value: string) => {
			const provider = providers.find(({ profileId }) => profileId === value)

			if (provider) {
				setProvider(provider)
				setOpen(false)
			}
		},
		[providers, setProvider, setOpen],
	)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="combobox"
					role="combobox"
					aria-expanded={open}
					className={cn(open && "border-vscode-focusBorder")}>
					{provider ? `${provider.profileName} (${provider.providerName})` : "Select"}
					<ChevronsUpDown className="opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="max-w-[200px] p-0">
				<Command>
					<CommandInput placeholder="Search" className="h-9" />
					<CommandList>
						<CommandEmpty>No matches.</CommandEmpty>
						<CommandGroup>
							{providers?.map(({ profileId, profileName, providerName }) => (
								<CommandItem key={profileId} value={profileId} onSelect={onSelect}>
									{profileName} ({providerName})
									<Check
										className={cn("ml-auto", { hidden: provider?.profileName !== profileName })}
									/>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
