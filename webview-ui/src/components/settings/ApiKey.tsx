import { useState, ReactNode } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { t } from "i18next"

type ApiKeyProps = {
    apiKey: string
    apiKeyEnvVar: string
    setApiKey: (value: string) => void
    setApiKeyUseEnvVar: (value: boolean) => void
    apiKeyLabel: string
    apiKeyUseEnvVar: boolean
    getApiKeyUrl?: string
    getApiKeyLabel?: string
    disabled?: boolean
    balanceDisplay?: ReactNode
}

export const ApiKey = ({
    apiKey,
    apiKeyEnvVar,
    setApiKey,
    setApiKeyUseEnvVar,
    apiKeyLabel,
    apiKeyUseEnvVar,
    getApiKeyUrl,
    getApiKeyLabel,
    disabled = false,
    balanceDisplay,
}: ApiKeyProps) => {

    const env = (window as any).PROCESS_ENV || {}
    const apiKeyEnvVarExists = !!env[apiKeyEnvVar]
    const [useEnvVar, setUseEnvVar] = useState(apiKeyUseEnvVar && apiKeyEnvVarExists)

    const handleUseEnvVarChange = (checked: boolean) => {
        setUseEnvVar(checked)
        setApiKeyUseEnvVar(checked)
    }

    return (
        <>
            <VSCodeTextField
                value={apiKey || ""}
                type="password"
                onInput={e => setApiKey((e.target as HTMLInputElement).value)}
                placeholder={t("settings:placeholders.apiKey")}
                className="w-full"
                disabled={useEnvVar || disabled}>
                <div className="flex justify-between items-center mb-1">
                    <label className="block font-medium">{apiKeyLabel}</label>
                    {apiKey && balanceDisplay && balanceDisplay}
                </div>
            </VSCodeTextField>
            <div className="text-sm text-vscode-descriptionForeground -mt-2">
                {t("settings:providers.apiKeyStorageNotice")}
            </div>
            <Checkbox
                checked={useEnvVar}
                onChange={handleUseEnvVarChange}
                className="mb-2"
                disabled={!apiKeyEnvVarExists}>
                {t("settings:providers.apiKeyUseEnvVar", { name: apiKeyEnvVar })}
            </Checkbox>
            {!(apiKey || useEnvVar) && getApiKeyUrl && getApiKeyLabel && (
                <VSCodeButtonLink href={getApiKeyUrl} appearance="secondary">
                    {getApiKeyLabel}
                </VSCodeButtonLink>
            )}
        </>
    )
}