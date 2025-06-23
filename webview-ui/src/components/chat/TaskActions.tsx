import { useState, useEffect, useRef } from "react"
import prettyBytes from "pretty-bytes"
import { useTranslation } from "react-i18next"

import type { HistoryItem } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
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

import { DeleteTaskDialog } from "../history/DeleteTaskDialog"
import { IconButton } from "./IconButton"

interface TaskActionsProps {
	item?: HistoryItem
	buttonsDisabled: boolean
}

export const TaskActions = ({ item, buttonsDisabled }: TaskActionsProps) => {
	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
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
		vscode.postMessage({
			type: "shareCurrentTask",
			visibility,
		})
		setShareDropdownOpen(false)
	}

	const handleConnectToCloud = () => {
		vscode.postMessage({ type: "rooCloudSignIn" })
		setShareDropdownOpen(false)
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

	return (
		<div className="flex flex-row gap-1">
			{item?.id &&
				(shareButtonState.showPopover ? (
					<Popover open={shareDropdownOpen} onOpenChange={setShareDropdownOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								disabled={buttonsDisabled || shareButtonState.disabled}
								className="h-6 w-6 p-0 hover:bg-vscode-toolbar-hoverBackground"
								title={shareButtonState.title}>
								<span className="codicon codicon-link text-xs"></span>
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
												<CommandItem
													onSelect={() => handleShare("public")}
													className="cursor-pointer">
													<div className="flex items-center gap-2">
														<span className="codicon codicon-globe text-sm"></span>
														<div className="flex flex-col">
															<span className="text-sm">
																{t("chat:task.sharePublicly")}
															</span>
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
						disabled={buttonsDisabled || shareButtonState.disabled}
						className="h-6 w-6 p-0 hover:bg-vscode-toolbar-hoverBackground"
						title={shareButtonState.title}>
						<span className="codicon codicon-link text-xs"></span>
					</Button>
				))}
			<IconButton
				iconClass="codicon-desktop-download"
				title={t("chat:task.export")}
				disabled={buttonsDisabled}
				onClick={() => vscode.postMessage({ type: "exportCurrentTask" })}
			/>
			{!!item?.size && item.size > 0 && (
				<>
					<div className="flex items-center">
						<IconButton
							iconClass="codicon-trash"
							title={t("chat:task.delete")}
							disabled={buttonsDisabled}
							onClick={(e) => {
								e.stopPropagation()

								if (e.shiftKey) {
									vscode.postMessage({ type: "deleteTaskWithId", text: item.id })
								} else {
									setDeleteTaskId(item.id)
								}
							}}
						/>
						<span className="ml-1 text-xs text-vscode-foreground opacity-85">{prettyBytes(item.size)}</span>
					</div>
					{deleteTaskId && (
						<DeleteTaskDialog
							taskId={deleteTaskId}
							onOpenChange={(open) => !open && setDeleteTaskId(null)}
							open
						/>
					)}
				</>
			)}
		</div>
	)
}
