import { useCallback, useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"
import { Trans } from "react-i18next"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getRequestyAuthUrl, getOpenRouterAuthUrl } from "@src/oauth/urls"
import RooHero from "./RooHero"
import knuthShuffle from "knuth-shuffle-seeded"

const WelcomeView = () => {
	const { apiConfiguration, currentApiConfigName, setApiConfiguration, uriScheme, machineId } = useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

	const handleSubmit = useCallback(() => {
		const error = apiConfiguration ? validateApiConfiguration(apiConfiguration) : undefined

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
	}, [apiConfiguration, currentApiConfigName])

	// Using a lazy initializer so it reads once at mount
	const [imagesBaseUri] = useState(() => {
		const w = window as any
		return w.IMAGES_BASE_URI || ""
	})

	return (
		<Tab>
			<TabContent className="flex flex-col gap-6">
				{/* Hero Section */}
				<div className="flex flex-col items-center">
					<RooHero />
					<h2 className="mx-auto mt-2 text-xl font-bold">{t("chat:greeting")}</h2>
				</div>

				{/* Bento Grid Layout */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{/* Introduction Card - Spans full width */}
					<div className="md:col-span-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-6 border border-blue-200/20 shadow-lg hover:shadow-xl transition-all duration-300">
						<h3 className="text-lg font-bold mb-2 text-blue-400">Welcome to Roo Code</h3>
						<Trans i18nKey="welcome:introduction" className="text-sm text-card-foreground" />
					</div>

					{/* Provider Cards */}
					{(() => {
						// Provider card configuration
						const providers = [
							{
								slug: "requesty",
								name: "Requesty",
								description: t("welcome:routers.requesty.description"),
								incentive: t("welcome:routers.requesty.incentive"),
								authUrl: getRequestyAuthUrl(uriScheme),
								color: "from-emerald-500/20 to-teal-500/20",
								borderColor: "border-emerald-200/30",
								iconBg: "bg-emerald-500/10",
								hoverBg: "hover:bg-emerald-500/5",
							},
							{
								slug: "openrouter",
								name: "OpenRouter",
								description: t("welcome:routers.openrouter.description"),
								authUrl: getOpenRouterAuthUrl(uriScheme),
								color: "from-amber-500/20 to-orange-500/20",
								borderColor: "border-amber-200/30",
								iconBg: "bg-amber-500/10",
								hoverBg: "hover:bg-amber-500/5",
							},
						]

						// Shuffle providers based on machine ID (will be consistent for the same machine)
						const orderedProviders = [...providers]
						knuthShuffle(orderedProviders, (machineId as any) || Date.now())

						// Render the provider cards
						return orderedProviders.map((provider, index) => (
							<a
								key={index}
								href={provider.authUrl}
								className={`bg-gradient-to-br ${provider.color} rounded-xl p-5 border ${provider.borderColor} shadow-lg ${provider.hoverBg} hover:shadow-xl transition-all duration-300 flex flex-col items-center cursor-pointer no-underline text-card-foreground transform hover:-translate-y-1`}
								target="_blank"
								rel="noopener noreferrer">
								<div className="text-lg font-bold mb-2">{provider.name}</div>
								<div
									className={`w-20 h-20 flex items-center justify-center rounded-full ${provider.iconBg} mb-3 overflow-hidden relative`}>
									<img
										src={`${imagesBaseUri}/${provider.slug}.png`}
										alt={provider.name}
										className="w-3/4 h-3/4 object-contain"
									/>
								</div>
								<div className="text-center">
									<div className="text-sm">{provider.description}</div>
									{provider.incentive && (
										<div className="text-sm font-bold mt-2 bg-white/10 rounded-full px-3 py-1 inline-block">
											{provider.incentive}
										</div>
									)}
								</div>
							</a>
						))
					})()}

					{/* Custom API Card - Spans full width */}
					<div className="md:col-span-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-6 border border-purple-200/20 shadow-lg">
						<h3 className="text-lg font-bold mb-4 text-purple-400">{t("welcome:startCustom")}</h3>
						<ApiOptions
							fromWelcomeView
							apiConfiguration={apiConfiguration || {}}
							uriScheme={uriScheme}
							setApiConfigurationField={(field, value) => setApiConfiguration({ [field]: value })}
							errorMessage={errorMessage}
							setErrorMessage={setErrorMessage}
						/>
					</div>
				</div>
			</TabContent>
			<div className="sticky bottom-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-t border-blue-200/20 shadow-md p-5">
				<div className="flex flex-col gap-2">
					<VSCodeButton
						onClick={handleSubmit}
						appearance="primary"
						className="transition-all duration-300 hover:opacity-90">
						{t("welcome:start")}
					</VSCodeButton>
					{errorMessage && (
						<div className="text-red-400 text-sm bg-red-500/10 p-2 rounded-md">{errorMessage}</div>
					)}
				</div>
			</div>
		</Tab>
	)
}

export default WelcomeView
