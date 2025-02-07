import React, { memo, useState } from "react"
import { VSCodeButton, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import type { CustomProviderConfig, ApiConfiguration } from "../../shared/types"
import { vscode } from "../../utils/vscode"
import { Dropdown } from "vscrui"
import type { DropdownOption } from "vscrui"

interface CustomProvidersSectionProps {
	apiConfiguration: ApiConfiguration
	providers: Record<string, CustomProviderConfig>
	activeProvider?: string
	onAddProvider: (provider: CustomProviderConfig) => void
	onDeleteProvider: (name: string) => void
	onSelectProvider: (name: string) => void
	handleInputChange: (field: keyof ApiConfiguration) => (event: { target: { value: any } }) => void
	isDescriptionExpanded: boolean
	setIsDescriptionExpanded: (expanded: boolean) => void
	modelIdErrorMessage?: string
	apiErrorMessage?: string
}

interface NewProviderForm {
	name: string
	url: string
	apiKey: string
}

export const defaultProviderConfig = {
	maxTokens: -1,
	contextWindow: 128000,
	supportsImages: false,
	supportsComputerUse: false,
	inputPrice: 0,
	outputPrice: 0,
	usagePaths: {
		promptTokens: "usage.prompt_tokens",
		outputTokens: "usage.completion_tokens",
		totalTokens: "usage.total_tokens",
	},
	request: {
		url: "http://localhost:1234/v1/chat/completions",
		method: "POST" as const,
		headers: {
			"Content-Type": "application/json",
		},
	},
	format: {
		method: "POST" as const,
		messages: "array" as const,
		data: '{"temperature":0.7,"stream":true, "model":"gpt-4o"}',
	},
	responsePath: "choices[0].message.content",
} satisfies Partial<CustomProviderConfig>

const emptyProvider: NewProviderForm = {
	name: "",
	url: "",
	apiKey: "",
}

const CustomProvidersSection: React.FC<CustomProvidersSectionProps> = memo(
	({
		apiConfiguration,
		providers,
		activeProvider,
		onAddProvider,
		onDeleteProvider,
		onSelectProvider,
		handleInputChange,
	}) => {
		const [newProvider, setNewProvider] = useState<NewProviderForm>(emptyProvider)
		const [errors, setErrors] = useState<{ name?: string; url?: string }>({})
		const [editingProvider, setEditingProvider] = useState<string | null>(null)
		const [editApiKey, setEditApiKey] = useState("")
		const [isAddProviderVisible, setIsAddProviderVisible] = useState(false)
		const [isUpdatingKey, setIsUpdatingKey] = useState<string | null>(null)

		const validateProvider = () => {
			const newErrors: { name?: string; url?: string } = {}

			if (!newProvider.name.trim()) {
				newErrors.name = "Provider name is required"
			} else if (providers[newProvider.name]) {
				newErrors.name = "Provider with this name already exists"
			}

			if (!newProvider.url.trim()) {
				newErrors.url = "API URL is required"
			} else {
				try {
					new URL(newProvider.url)
				} catch {
					newErrors.url = "Please enter a valid URL"
				}
			}

			setErrors(newErrors)
			return Object.keys(newErrors).length === 0
		}

		const handleAddProvider = () => {
			if (!validateProvider()) return

			const provider: CustomProviderConfig = {
				...defaultProviderConfig,
				id: Date.now().toString(),
				name: newProvider.name.trim(),
				request: {
					...defaultProviderConfig.request,
					url: newProvider.url.trim(),
					headers: {
						"Content-Type": "application/json",
						Authorization: `\${API_KEY}`,
					},
				},
				format: defaultProviderConfig.format,
				responsePath: defaultProviderConfig.responsePath,
				description: `Custom provider for ${newProvider.name.trim()}`,
				apiKey: newProvider.apiKey,
			}

			vscode.postMessage({
				type: "addCustomProvider",
				values: provider,
			})
			onAddProvider(provider)

			handleInputChange("activeCustomProvider")({ target: { value: provider.name } })
			handleInputChange("customProvider")({ target: { value: provider } })

			setNewProvider(emptyProvider)
			setErrors({})
			setIsAddProviderVisible(false)
		}

		const handleDeleteProvider = async (name: string, e: React.MouseEvent) => {
			e.stopPropagation()

			if (name === apiConfiguration?.activeCustomProvider) {
				handleInputChange("activeCustomProvider")({ target: { value: "" } })
				handleInputChange("customProvider")({ target: { value: undefined } })
			}

			vscode.postMessage({ type: "deleteCustomProvider", text: name })
			onDeleteProvider(name)
		}

		const handleStartEditing = (name: string, e: React.MouseEvent) => {
			e.stopPropagation()
			setEditingProvider(name)
			setEditApiKey(providers[name]?.apiKey || "")
		}

		const handleUpdateApiKey = async (providerName: string) => {
			if (!editApiKey.trim()) return

			const provider = providers[providerName]
			if (!provider) return

			try {
				setIsUpdatingKey(providerName)

				const updatedProvider: CustomProviderConfig = {
					...provider,
					apiKey: editApiKey,
				}

				await vscode.postMessage({
					type: "updateCustomProvider",
					values: updatedProvider,
				})

				handleInputChange("customProviders")({
					target: {
						value: {
							...apiConfiguration?.customProviders,
							[providerName]: updatedProvider,
						},
					},
				})

				setEditingProvider(null)
				setEditApiKey("")
			} catch (error) {
				console.error("Failed to update API key:", error)
			} finally {
				setIsUpdatingKey(null)
			}
		}

		return (
			<div style={{ marginBottom: 40 }}>
				<h3 style={{ color: "var(--vscode-foreground)", margin: "0 0 15px 0" }}>Custom Providers</h3>

				<div style={{ marginBottom: 25 }}>
					<label style={{ fontWeight: 500, display: "block", marginBottom: 5 }}>Active Provider</label>
					<div style={{ marginBottom: 4 }}>
						<Dropdown
							value={apiConfiguration?.activeCustomProvider || ""}
							onChange={(value: unknown) => {
								const providerName = (value as DropdownOption).value
								handleInputChange("activeCustomProvider")({ target: { value: providerName } })
								if (providerName && providers[providerName]) {
									handleInputChange("customProvider")({
										target: { value: providers[providerName] },
									})
								}
							}}
							style={{ width: "100%" }}
							options={[
								{ value: "", label: "Select a provider..." },
								...Object.entries(providers || {}).map(([name]) => ({
									value: name,
									label: name,
								})),
							]}
						/>
					</div>
					<p style={{ fontSize: "12px", marginTop: "5px", color: "var(--vscode-descriptionForeground)" }}>
						Select a custom provider to use its API endpoint and configuration.
					</p>
				</div>

				{!isAddProviderVisible ? (
					<VSCodeButton onClick={() => setIsAddProviderVisible(true)}>Add Provider</VSCodeButton>
				) : (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "1rem",
							margin: "1rem 0",
							padding: "1rem",
							background: "var(--vscode-editor-background)",
							border: "1px solid var(--vscode-widget-border)",
							borderRadius: "4px",
						}}>
						<div style={{ marginBottom: 12 }}>
							<VSCodeTextField
								value={newProvider.name}
								placeholder="Enter provider name"
								onChange={(e) => {
									const target = e.target as HTMLInputElement
									setNewProvider({ ...newProvider, name: target.value })
								}}>
								Provider Name
								{errors.name && (
									<span
										style={{
											color: "var(--vscode-errorForeground)",
											fontSize: 12,
											display: "block",
											marginTop: 4,
										}}>
										{errors.name}
									</span>
								)}
							</VSCodeTextField>
						</div>

						<div style={{ marginBottom: 12 }}>
							<VSCodeTextField
								value={newProvider.url}
								placeholder="Enter API endpoint URL"
								onChange={(e) => {
									const target = e.target as HTMLInputElement
									setNewProvider({ ...newProvider, url: target.value })
								}}>
								API URL
								{errors.url && (
									<span
										style={{
											color: "var(--vscode-errorForeground)",
											fontSize: 12,
											display: "block",
											marginTop: 4,
										}}>
										{errors.url}
									</span>
								)}
							</VSCodeTextField>
						</div>

						<div style={{ marginBottom: 12 }}>
							<VSCodeTextField
								type="password"
								value={newProvider.apiKey}
								placeholder="Enter API key"
								onChange={(e) => {
									const target = e.target as HTMLInputElement
									setNewProvider({ ...newProvider, apiKey: target.value })
								}}>
								API Key
							</VSCodeTextField>
						</div>

						<div style={{ display: "flex", gap: "8px" }}>
							<VSCodeButton onClick={handleAddProvider}>Add Provider</VSCodeButton>
							<VSCodeButton
								appearance="secondary"
								onClick={() => {
									setIsAddProviderVisible(false)
									setNewProvider(emptyProvider)
									setErrors({})
								}}>
								Cancel
							</VSCodeButton>
						</div>
					</div>
				)}

				{Object.keys(providers).length > 0 && (
					<div style={{ marginTop: "20px" }}>
						<h4 style={{ margin: "0 0 10px 0" }}>Configured Providers</h4>
						{Object.entries(providers || {}).map(([name, provider]) => {
							if (!provider || typeof provider !== "object") return null
							const typedProvider = provider as CustomProviderConfig
							return (
								<div
									key={name}
									style={{
										padding: "12px",
										background: "var(--vscode-editor-background)",
										border: `1px solid ${activeProvider === name ? "var(--vscode-focusBorder)" : "var(--vscode-widget-border)"}`,
										borderRadius: "4px",
										cursor: "pointer",
										marginBottom: "8px",
										transition: "background-color 0.2s",
									}}
									onClick={() => onSelectProvider(name)}>
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: "12px",
											width: "100%",
										}}>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "flex-start",
												width: "100%",
											}}>
											<div
												style={{
													display: "flex",
													flexDirection: "column",
													gap: "4px",
													flex: 1,
												}}>
												<div style={{ display: "flex", alignItems: "center" }}>
													<span style={{ fontWeight: 500, marginRight: "8px" }}>
														{typedProvider.name || "Unnamed Provider"}
													</span>
													<div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
														{typedProvider.supportsImages && (
															<span
																className="codicon codicon-symbol-file-media"
																style={{
																	color: "var(--vscode-inputOption-activeForeground)",
																}}
																title="Supports Images"
															/>
														)}
														{typedProvider.supportsComputerUse && (
															<span
																className="codicon codicon-terminal"
																style={{
																	color: "var(--vscode-inputOption-activeForeground)",
																}}
																title="Supports Computer Use"
															/>
														)}
													</div>
												</div>
												<span
													style={{
														fontSize: "0.9em",
														color: "var(--vscode-descriptionForeground)",
													}}>
													{typedProvider.request?.url}
												</span>
												{typedProvider.model && (
													<span
														style={{
															fontSize: "0.9em",
															color: "var(--vscode-textLink-foreground)",
														}}>
														{typedProvider.model}
													</span>
												)}
											</div>

											<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
												<VSCodeButton
													appearance="icon"
													title="Edit in Config File"
													onClick={(e: React.MouseEvent) => {
														e.stopPropagation()
														vscode.postMessage({ type: "openCustomProvidersSettings" })
													}}>
													<span className="codicon codicon-settings-gear" />
												</VSCodeButton>
												<VSCodeButton
													appearance="icon"
													title="Remove Provider"
													onClick={(e) => handleDeleteProvider(name, e)}>
													<span className="codicon codicon-trash" />
												</VSCodeButton>
											</div>
										</div>

										<div
											style={{
												borderTop: "1px solid var(--vscode-widget-border)",
												paddingTop: "12px",
												marginTop: "4px",
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
											}}>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: "8px",
													fontSize: "12px",
													color: "var(--vscode-descriptionForeground)",
												}}>
												<span
													className={`codicon ${provider.apiKey ? "codicon-key" : "codicon-key-disabled"}`}
													style={{
														color: provider.apiKey
															? "var(--vscode-gitDecoration-addedResourceForeground)"
															: "inherit",
													}}
												/>
												<span>{provider.apiKey ? "API Key Set" : "No API Key"}</span>
											</div>
											{!editingProvider && (
												<VSCodeButton
													appearance="icon"
													title={provider.apiKey ? "Update API Key" : "Set API Key"}
													onClick={(e) => {
														e.stopPropagation()
														handleStartEditing(name, e)
													}}>
													<span className="codicon codicon-edit" />
												</VSCodeButton>
											)}
										</div>

										{editingProvider === name && (
											<div
												style={{
													background: "var(--vscode-editorWidget-background)",
													border: "1px solid var(--vscode-input-border)",
													borderRadius: "4px",
													padding: "12px",
													marginTop: "8px",
												}}
												onClick={(e) => e.stopPropagation()}>
												<p
													style={{
														fontSize: "12px",
														color: "var(--vscode-descriptionForeground)",
														margin: "0 0 12px 0",
														lineHeight: 1.4,
													}}>
													Enter your API key for {typedProvider.name}. The key will be stored
													securely.
												</p>
												<div
													style={{
														display: "flex",
														gap: "8px",
														alignItems: "center",
														width: "100%",
													}}>
													<VSCodeTextField
														type="password"
														value={editApiKey}
														placeholder="Enter new API key"
														onKeyDown={(e) => {
															if (e.key === "Enter") {
																e.preventDefault()
																handleUpdateApiKey(name)
															}
															if (e.key === "Escape") {
																e.preventDefault()
																setEditingProvider(null)
																setEditApiKey("")
															}
														}}
														onChange={(e) =>
															setEditApiKey((e.target as HTMLInputElement).value)
														}
														style={{ flex: 1 }}>
														API Key
														<br />
														<span
															style={{
																fontSize: "12px",
																color: "var(--vscode-descriptionForeground)",
															}}>
															Press Enter to save, Escape to cancel
														</span>
													</VSCodeTextField>
												</div>
												<div
													style={{
														display: "flex",
														gap: "8px",
														marginTop: "12px",
														justifyContent: "flex-start",
														alignItems: "center",
													}}>
													<VSCodeButton
														appearance="primary"
														onClick={() => handleUpdateApiKey(name)}>
														{isUpdatingKey === name ? (
															<span className="codicon codicon-loading codicon-modifier-spin" />
														) : (
															"Save"
														)}
													</VSCodeButton>
													<VSCodeButton
														appearance="icon"
														title="Cancel"
														onClick={() => {
															setEditingProvider(null)
															setEditApiKey("")
														}}>
														<span className="codicon codicon-close" />
													</VSCodeButton>
												</div>
											</div>
										)}
									</div>
								</div>
							)
						})}
					</div>
				)}

				<div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
					<VSCodeButton
						appearance="secondary"
						onClick={() => vscode.postMessage({ type: "openCustomProvidersSettings" })}>
						Open Config File
					</VSCodeButton>
				</div>
			</div>
		)
	},
)

export default CustomProvidersSection
