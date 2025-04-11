import React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"

interface GrokReasoningSettingsProps {
	reasoningEffort: "low" | "high"
	setReasoningEffort: (value: "low" | "high") => void
}

export const GrokReasoningSettings: React.FC<GrokReasoningSettingsProps> = ({
	reasoningEffort,
	setReasoningEffort,
}) => {
	return (
		<div className="flex flex-col gap-3">
			<div>
				<label className="block font-medium mb-1">Reasoning Effort</label>
				<Select value={reasoningEffort} onValueChange={(value) => setReasoningEffort(value as "low" | "high")}>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Select reasoning effort" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="low">Low (faster responses, less thinking)</SelectItem>
						<SelectItem value="high">High (more thorough thinking, slower responses)</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>
	)
}
