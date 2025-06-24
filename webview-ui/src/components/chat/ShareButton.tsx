import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import type { HistoryItem } from "@roo-code/types"
import { TelemetryEventName } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { telemetryClient } from "@/utils/TelemetryClient"
import { useExtensionState } from "@/context/ExtensionStateContext"
import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Command,
	CommandList,
	CommandItem,
	CommandGroup,
} from "@/components/ui"

interface ShareButtonProps {
	item?: HistoryItem
	disabled?: boolean
}

export const ShareButton = ({ item, disabled = false }: ShareButtonProps) => {
	const [shareDropdownOpen, setShareDropdownOpen] = useState(false)
	const { t } = useTranslation()
	const { sharingEnabled, cloudIsAuthenticated, cloudUserInfo } = useExtensionState()
	const wasUnauthenticatedRef = useRef(false)

	// Track authentication state changes to auto-open popover after login
	useEffect(() => {
		if (!cloudIsAuthenticated || !sharingEnabled) {
			wasUnauthenticatedRef.current = true
		} else if (wasUnauthenticatedRef.current && cloudIsAuthenticated && sharingEnabled) {
			// User just authenticated, open the popover
			setShareDropdownOpen(true)
			wasUnauthenticatedRef.current = false
		}
	}, [cloudIsAuthenticated, sharingEnabled])

	const handleShare = (visibility: "organization" | "public") => {
		// Send telemetry for share action
		if (visibility === "organization") {
			telemetryClient.capture(TelemetryEventName.SHARE_ORGANIZATION_CLICKED)
		} else {
			telemetryClient.capture(TelemetryEventName.SHARE_PUBLIC_CLICKED)
		}

		vscode.postMessage({
			type: "shareCurrentTask",
			visibility,
		})
		setShareDropdownOpen(false)
	}

	const handleConnectToCloud = () => {
		// Send telemetry for connect to cloud action
		telemetryClient.capture(TelemetryEventName.SHARE_CONNECT_TO_CLOUD_CLICKED)

		vscode.postMessage({ type: "rooCloudSignIn" })
		setShareDropdownOpen(false)
	}

	const handleShareButtonClick = () => {
		// Send telemetry for share button click
		telemetryClient.capture(TelemetryEventName.SHARE_BUTTON_CLICKED)
		setShareDropdownOpen(true)
	}

	// Determine share button state
	const getShareButtonState = () => {
		if (!cloudIsAuthenticated) {
			return {
				disabled: false,
				title: t("chat:task.share"),
				showPopover: true,
			}
		} else if (!sharingEnabled) {
			return {
				disabled: true,
				title: t("chat:task.sharingDisabledByOrganization"),
				showPopover: false,
			}
		} else {
			return {
				disabled: false,
				title: t("chat:task.share"),
				showPopover: true,
			}
		}
	}

	const shareButtonState = getShareButtonState()

	// Don't render if no item ID
	if (!item?.id) {
		return null
	}

	return shareButtonState.showPopover ? (
		<Popover open={shareDropdownOpen} onOpenChange={setShareDropdownOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					disabled={disabled || shareButtonState.disabled}
					className="h-7 w-7 p-1.5 hover:bg-vscode-toolbar-hoverBackground"
					title={shareButtonState.title}
					onClick={handleShareButtonClick}>
					<span className="codicon codicon-link"></span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-56 p-0" align="start">
				<Command>
					<CommandList>
						<CommandGroup>
							{cloudIsAuthenticated && sharingEnabled ? (
								<>
									{cloudUserInfo?.organizationName && (
										<CommandItem
											onSelect={() => handleShare("organization")}
											className="cursor-pointer">
											<div className="flex items-center gap-2">
												<span className="codicon codicon-organization text-sm"></span>
												<div className="flex flex-col">
													<span className="text-sm">
														{t("chat:task.shareWithOrganization")}
													</span>
													<span className="text-xs text-vscode-descriptionForeground">
														{t("chat:task.shareWithOrganizationDescription")}
													</span>
												</div>
											</div>
										</CommandItem>
									)}
									<CommandItem onSelect={() => handleShare("public")} className="cursor-pointer">
										<div className="flex items-center gap-2">
											<span className="codicon codicon-globe text-sm"></span>
											<div className="flex flex-col">
												<span className="text-sm">{t("chat:task.sharePublicly")}</span>
												<span className="text-xs text-vscode-descriptionForeground">
													{t("chat:task.sharePubliclyDescription")}
												</span>
											</div>
										</div>
									</CommandItem>
								</>
							) : (
								<CommandItem onSelect={handleConnectToCloud} className="cursor-pointer">
									<div className="flex items-center gap-2">
										<span className="codicon codicon-account text-sm"></span>
										<div className="flex flex-col">
											<span className="text-sm">{t("chat:task.connectToCloud")}</span>
											<span className="text-xs text-vscode-descriptionForeground">
												{t("chat:task.connectToCloudDescription")}
											</span>
										</div>
									</div>
								</CommandItem>
							)}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	) : (
		<Button
			variant="ghost"
			size="icon"
			disabled={disabled || shareButtonState.disabled}
			className="h-7 w-7 p-1.5 hover:bg-vscode-toolbar-hoverBackground"
			title={shareButtonState.title}>
			<span className="codicon codicon-link"></span>
		</Button>
	)
}
