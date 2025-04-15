import { useState } from "react"
import {
	Section,
	SectionHeader,
	Card,
	TextInput,
	Dropdown,
	Toggle,
	SearchableDropdown,
	DropdownOption,
	SearchableDropdownOption,
} from "../shared"

const languageOptions: DropdownOption[] = [
	{ key: "en", text: "English" },
	{ key: "fr", text: "French" },
	{ key: "de", text: "German" },
	{ key: "es", text: "Spanish" },
	{ key: "it", text: "Italian" },
	{ key: "ja", text: "Japanese" },
	{ key: "ko", text: "Korean" },
	{ key: "pt", text: "Portuguese" },
	{ key: "ru", text: "Russian" },
	{ key: "zh", text: "Chinese" },
]

const modelOptions: SearchableDropdownOption[] = [
	{ key: "gpt-4", text: "GPT-4" },
	{ key: "gpt-4-turbo", text: "GPT-4 Turbo" },
	{ key: "gpt-3.5-turbo", text: "GPT-3.5 Turbo" },
	{ key: "claude-3-opus", text: "Claude 3 Opus" },
	{ key: "claude-3-sonnet", text: "Claude 3 Sonnet" },
	{ key: "claude-3-haiku", text: "Claude 3 Haiku" },
	{ key: "gemini-pro", text: "Gemini Pro" },
	{ key: "gemini-ultra", text: "Gemini Ultra" },
]

const GeneralSettings = () => {
	// State for form values
	const [openAIKey, setOpenAIKey] = useState("")
	const [anthropicKey, setAnthropicKey] = useState("")
	const [googleKey, setGoogleKey] = useState("")
	const [selectedLanguage, setSelectedLanguage] = useState("en")
	const [selectedModel, setSelectedModel] = useState("gpt-4")
	const [autoSave, setAutoSave] = useState(true)

	return (
		<div className="flex flex-col gap-4">
			<Section>
				<SectionHeader description="Configure your API settings for different providers">
					API Configuration
				</SectionHeader>

				<Card title="OpenAI">
					<TextInput
						id="openai-key"
						label="API Key"
						description="Your OpenAI API key"
						value={openAIKey}
						onChange={setOpenAIKey}
						placeholder="sk-..."
						type="password"
					/>

					<SearchableDropdown
						id="openai-model"
						label="Default Model"
						description="Select the default model to use"
						options={modelOptions}
						selectedKey={selectedModel}
						onChange={setSelectedModel}
					/>
				</Card>

				<Card title="Anthropic">
					<TextInput
						id="anthropic-key"
						label="API Key"
						description="Your Anthropic API key"
						value={anthropicKey}
						onChange={setAnthropicKey}
						placeholder="sk-ant-..."
						type="password"
					/>
				</Card>

				<Card title="Google">
					<TextInput
						id="google-key"
						label="API Key"
						description="Your Google API key"
						value={googleKey}
						onChange={setGoogleKey}
						placeholder="AIza..."
						type="password"
					/>
				</Card>
			</Section>

			<Section>
				<SectionHeader description="Configure language preferences for the extension">
					Language Settings
				</SectionHeader>

				<Card>
					<Dropdown
						id="language"
						label="Interface Language"
						description="Select the language for the user interface"
						options={languageOptions}
						selectedKey={selectedLanguage}
						onChange={setSelectedLanguage}
					/>

					<Toggle
						id="auto-save"
						label="Auto-save Settings"
						description="Automatically save settings when changed"
						checked={autoSave}
						onChange={setAutoSave}
					/>
				</Card>
			</Section>
		</div>
	)
}

export default GeneralSettings
