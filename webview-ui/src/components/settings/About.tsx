import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Trans } from "react-i18next"
import { Info, Download, Upload, TriangleAlert } from "lucide-react"

import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { TelemetrySetting } from "../../../../src/shared/TelemetrySetting"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type AboutProps = HTMLAttributes<HTMLDivElement> & {
	version: string
	telemetrySetting: TelemetrySetting
	setTelemetrySetting: (setting: TelemetrySetting) => void
}

export const About = ({ version, telemetrySetting, setTelemetrySetting, className, ...props }: AboutProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={`Version: ${version}`}>
				<div className="flex items-center gap-2">
					<Info className="w-4" />
					<div>{t("settings:sections.about")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<VSCodeCheckbox
						checked={telemetrySetting === "enabled"}
						onChange={(e: any) => {
							const checked = e.target.checked === true
							setTelemetrySetting(checked ? "enabled" : "disabled")
						}}>
						{t("settings:footer.telemetry.label")}
					</VSCodeCheckbox>
					<p className="text-vscode-descriptionForeground text-sm mt-0">
						{t("settings:footer.telemetry.description")}
					</p>
				</div>

				<div>
					<Trans
						i18nKey="settings:footer.feedback"
						components={{
							githubLink: <VSCodeLink href="https://github.com/RooVetGit/Roo-Code" />,
							redditLink: <VSCodeLink href="https://reddit.com/r/RooCode" />,
							discordLink: <VSCodeLink href="https://discord.gg/roocode" />,
						}}
					/>
				</div>

				<div className="flex items-center gap-2 mt-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button>
								<Download className="p-0.5" />
								Import
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem
								onClick={() => vscode.postMessage({ type: "importSettings", text: "provider" })}>
								Current Provider Settings
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => vscode.postMessage({ type: "importSettings", text: "global" })}>
								Global Settings
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button>
								<Upload className="p-0.5" />
								Export
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem
								onClick={() => vscode.postMessage({ type: "exportSettings", text: "provider" })}>
								Current Provider Settings
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => vscode.postMessage({ type: "exportSettings", text: "global" })}>
								Global Settings
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<Button variant="destructive" onClick={() => vscode.postMessage({ type: "resetState" })}>
						<TriangleAlert className="p-0.5" />
						{t("settings:footer.reset.button")}
					</Button>
				</div>
			</Section>
		</div>
	)
}
