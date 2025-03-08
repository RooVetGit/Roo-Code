import { HTMLAttributes } from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { SquareMousePointer } from "lucide-react"

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { sliderLabelStyle } from "./styles"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type BrowserSettingsProps = HTMLAttributes<HTMLDivElement> & {
	browserToolEnabled?: boolean
	browserViewportSize?: string
	screenshotQuality?: number
	setCachedStateField: SetCachedStateField<"browserToolEnabled" | "browserViewportSize" | "screenshotQuality">
}

export const BrowserSettings = ({
	browserToolEnabled,
	browserViewportSize,
	screenshotQuality,
	setCachedStateField,
	...props
}: BrowserSettingsProps) => {
	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<SquareMousePointer className="w-4" />
					<div>Browser / Computer Use</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<VSCodeCheckbox
						checked={browserToolEnabled}
						onChange={(e: any) => setCachedStateField("browserToolEnabled", e.target.checked)}>
						<span className="font-medium">Enable browser tool</span>
					</VSCodeCheckbox>
					<p className="text-vscode-descriptionForeground text-sm mt-0">
						When enabled, Roo can use a browser to interact with websites when using models that support
						computer use.
					</p>
					{browserToolEnabled && (
						<div className="flex flex-col gap-2 border-l-2 border-vscode-button-background pl-3">
							<div>
								<label className="font-medium">Viewport size</label>
								<Select
									value={browserViewportSize}
									onValueChange={(value) => setCachedStateField("browserViewportSize", value)}>
									<SelectTrigger className="w-full mt-1">
										<SelectValue placeholder="Select" />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectItem value="1280x800">Large Desktop (1280x800)</SelectItem>
											<SelectItem value="900x600">Small Desktop (900x600)</SelectItem>
											<SelectItem value="768x1024">Tablet (768x1024)</SelectItem>
											<SelectItem value="360x640">Mobile (360x640)</SelectItem>
										</SelectGroup>
									</SelectContent>
								</Select>
								<p className="text-vscode-descriptionForeground text-sm mt-1">
									Select the viewport size for browser interactions. This affects how websites are
									displayed and interacted with.
								</p>
							</div>
							<div>
								<span className="font-medium">Screenshot quality</span>
								<div className="flex items-center gap-2">
									<input
										type="range"
										min="1"
										max="100"
										step="1"
										value={screenshotQuality ?? 75}
										onChange={(e) =>
											setCachedStateField("screenshotQuality", parseInt(e.target.value))
										}
										className="h-2 focus:outline-0 w-4/5 accent-vscode-button-background"
									/>
									<span style={{ ...sliderLabelStyle }}>{screenshotQuality ?? 75}%</span>
								</div>
								<p className="text-vscode-descriptionForeground text-sm mt-0">
									Adjust the WebP quality of browser screenshots. Higher values provide clearer
									screenshots but increase token usage.
								</p>
							</div>
						</div>
					)}
				</div>
			</Section>
		</div>
	)
}
