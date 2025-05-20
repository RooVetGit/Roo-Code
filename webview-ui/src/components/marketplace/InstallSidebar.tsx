import React, { useState } from "react"
import { VSCodeButton, VSCodeTextField, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { MarketplaceItem } from "../../../../src/services/marketplace/types"
import { RocketConfig } from "config-rocket"

interface MarketplaceInstallSidebarProps {
	item: MarketplaceItem
	config: RocketConfig
	onClose?: () => void
	onSubmit?: (item: MarketplaceItem, parameters: Record<string, any>) => void
}

const InstallSidebar: React.FC<MarketplaceInstallSidebarProps> = ({ item, config, onClose, onSubmit }) => {
	const initialUserParameters = config.parameters!.reduce(
		(acc, param) => {
			if (param.resolver.operation === "prompt")
				acc[param.id] = param.resolver.initial ?? (param.resolver.type === "confirm" ? true : "")

			return acc
		},
		{} as Record<string, any>,
	)
	const [userParameters, setUserParameters] = useState<Record<string, any>>(initialUserParameters)

	const handleParameterChange = (name: string, value: any) => {
		setUserParameters({ ...userParameters, [name]: value })
	}

	const handleSubmit = () => {
		if (onSubmit && item) {
			onSubmit(item, userParameters)
		}
	}

	return (
		<div
			className="fixed inset-0 flex justify-end"
			onClick={onClose} // Close sidebar when clicking outside
		>
			<div
				className="flex flex-col p-4 bg-vscode-sideBar-background text-vscode-foreground h-full w-3/4 shadow-lg" // Adjust width and add shadow
				onClick={(e) => e.stopPropagation()}>
				<h2 className="text-xl font-bold mb-4">Install {item.name}</h2>
				<div className="flex-grow overflow-y-auto space-y-4">
					{config.parameters?.map((param) => {
						// Only render prompt parameters
						if (param.resolver.operation !== "prompt") return null

						return (
							<div key={param.id} className="flex flex-col">
								<label htmlFor={param.id} className="text-sm font-semibold mb-1">
									{param.resolver.label || param.id}{" "}
									{/* Use label from resolver if available, otherwise name */}
								</label>
								{/* Render input based on param.resolver.type */}
								{param.resolver.type === "text" && (
									<VSCodeTextField
										id={param.id}
										value={userParameters[param.id]}
										onChange={(e) =>
											handleParameterChange(param.id, (e.target as HTMLInputElement).value)
										}
										className="w-full"></VSCodeTextField>
								)}
								{param.resolver.type === "confirm" && (
									<VSCodeCheckbox
										id={param.id}
										checked={userParameters[param.id]}
										onChange={(e) =>
											handleParameterChange(param.id, (e.target as HTMLInputElement).checked)
										}></VSCodeCheckbox>
								)}
							</div>
						)
					})}
				</div>
				<div className="flex gap-2 mt-4">
					<VSCodeButton onClick={handleSubmit} className="flex-1">
						Install
					</VSCodeButton>
					<VSCodeButton appearance="secondary" onClick={onClose} className="flex-1">
						Cancel
					</VSCodeButton>
				</div>
			</div>
		</div>
	)
}

export default InstallSidebar
