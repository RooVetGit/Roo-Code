import { useCallback, useState, useEffect } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField, VSCodeRadio, VSCodeRadioGroup } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, type ModelInfo, BEDROCK_REGIONS } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StandardTooltip } from "@src/components/ui"

import { inputEventTransform, noTransform } from "../transforms"

type BedrockProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	selectedModelInfo?: ModelInfo
}

export const Bedrock = ({ apiConfiguration, setApiConfigurationField, selectedModelInfo }: BedrockProps) => {
	const { t } = useAppTranslation()
	const [awsEndpointSelected, setAwsEndpointSelected] = useState(!!apiConfiguration?.awsBedrockEndpointEnabled)
	const [isCustomRegion, setIsCustomRegion] = useState(
		apiConfiguration?.awsRegion && !BEDROCK_REGIONS.some((region) => region.value === apiConfiguration.awsRegion),
	)

	// Update the endpoint enabled state when the configuration changes
	useEffect(() => {
		setAwsEndpointSelected(!!apiConfiguration?.awsBedrockEndpointEnabled)
	}, [apiConfiguration?.awsBedrockEndpointEnabled])

	// Initialize custom region state on component mount
	useEffect(() => {
		if (apiConfiguration?.awsRegion) {
			const isStandardRegion = BEDROCK_REGIONS.some(
				(region: { value: string; label: string }) =>
					region.value === apiConfiguration.awsRegion && region.value !== "custom",
			)
			setIsCustomRegion(!isStandardRegion)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Only run on mount - deliberately ignoring apiConfiguration dependency to avoid conflicts

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeRadioGroup
				value={apiConfiguration?.awsUseProfile ? "profile" : "credentials"}
				onChange={handleInputChange(
					"awsUseProfile",
					(e) => (e.target as HTMLInputElement).value === "profile",
				)}>
				<VSCodeRadio value="credentials">{t("settings:providers.awsCredentials")}</VSCodeRadio>
				<VSCodeRadio value="profile">{t("settings:providers.awsProfile")}</VSCodeRadio>
			</VSCodeRadioGroup>
			<div className="text-sm text-vscode-descriptionForeground -mt-3">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{apiConfiguration?.awsUseProfile ? (
				<VSCodeTextField
					value={apiConfiguration?.awsProfile || ""}
					onInput={handleInputChange("awsProfile")}
					placeholder={t("settings:placeholders.profileName")}
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.awsProfileName")}</label>
				</VSCodeTextField>
			) : (
				<>
					<VSCodeTextField
						value={apiConfiguration?.awsAccessKey || ""}
						type="password"
						onInput={handleInputChange("awsAccessKey")}
						placeholder={t("settings:placeholders.accessKey")}
						className="w-full">
						<label className="block font-medium mb-1">{t("settings:providers.awsAccessKey")}</label>
					</VSCodeTextField>
					<VSCodeTextField
						value={apiConfiguration?.awsSecretKey || ""}
						type="password"
						onInput={handleInputChange("awsSecretKey")}
						placeholder={t("settings:placeholders.secretKey")}
						className="w-full">
						<label className="block font-medium mb-1">{t("settings:providers.awsSecretKey")}</label>
					</VSCodeTextField>
					<VSCodeTextField
						value={apiConfiguration?.awsSessionToken || ""}
						type="password"
						onInput={handleInputChange("awsSessionToken")}
						placeholder={t("settings:placeholders.sessionToken")}
						className="w-full">
						<label className="block font-medium mb-1">{t("settings:providers.awsSessionToken")}</label>
					</VSCodeTextField>
				</>
			)}
			<div>
				<label className="block font-medium mb-1">{t("settings:providers.awsRegion")}</label>
				<Select
					value={isCustomRegion ? "custom" : apiConfiguration?.awsRegion || ""}
					onValueChange={(value) => {
						if (value === "custom") {
							setIsCustomRegion(true)
							setApiConfigurationField("awsRegion", "")
						} else {
							setIsCustomRegion(false)
							setApiConfigurationField("awsRegion", value)
						}
					}}>
					<SelectTrigger className="w-full">
						<SelectValue placeholder={t("settings:common.select")} />
					</SelectTrigger>
					<SelectContent>
						{BEDROCK_REGIONS.map(({ value, label }) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{isCustomRegion && (
					<div className="mt-2">
						<VSCodeTextField
							value={apiConfiguration?.awsRegion || ""}
							onInput={handleInputChange("awsRegion")}
							placeholder="Enter custom region (e.g., us-west-3)"
							className="w-full">
							<label className="block font-medium mb-1">Custom Region</label>
						</VSCodeTextField>
					</div>
				)}
			</div>
			<Checkbox
				checked={apiConfiguration?.awsUseCrossRegionInference || false}
				onChange={handleInputChange("awsUseCrossRegionInference", noTransform)}>
				{t("settings:providers.awsCrossRegion")}
			</Checkbox>
			{selectedModelInfo?.supportsPromptCache && (
				<>
					<Checkbox
						checked={apiConfiguration?.awsUsePromptCache || false}
						onChange={handleInputChange("awsUsePromptCache", noTransform)}>
						<div className="flex items-center gap-1">
							<span>{t("settings:providers.enablePromptCaching")}</span>
							<StandardTooltip content={t("settings:providers.enablePromptCachingTitle")}>
								<i
									className="codicon codicon-info text-vscode-descriptionForeground"
									style={{ fontSize: "12px" }}
								/>
							</StandardTooltip>
						</div>
					</Checkbox>
					<div className="text-sm text-vscode-descriptionForeground ml-6 mt-1">
						{t("settings:providers.cacheUsageNote")}
					</div>
				</>
			)}
			<Checkbox
				checked={awsEndpointSelected}
				onChange={(isChecked) => {
					setAwsEndpointSelected(isChecked)
					setApiConfigurationField("awsBedrockEndpointEnabled", isChecked)
				}}>
				{t("settings:providers.awsBedrockVpc.useCustomVpcEndpoint")}
			</Checkbox>
			{awsEndpointSelected && (
				<>
					<VSCodeTextField
						value={apiConfiguration?.awsBedrockEndpoint || ""}
						style={{ width: "100%", marginTop: 3, marginBottom: 5 }}
						type="url"
						onInput={handleInputChange("awsBedrockEndpoint")}
						placeholder={t("settings:providers.awsBedrockVpc.vpcEndpointUrlPlaceholder")}
						data-testid="vpc-endpoint-input"
					/>
					<div className="text-sm text-vscode-descriptionForeground ml-6 mt-1 mb-3">
						{t("settings:providers.awsBedrockVpc.examples")}
						<div className="ml-2">• https://vpce-xxx.bedrock.region.vpce.amazonaws.com/</div>
						<div className="ml-2">• https://gateway.my-company.com/route/app/bedrock</div>
					</div>
				</>
			)}
		</>
	)
}
