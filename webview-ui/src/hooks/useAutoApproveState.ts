import { useCallback, useMemo } from "react"
import { vscode } from "@/utils/vscode"
import { AutoApproveSetting, autoApproveSettingsConfig } from "@/components/settings/AutoApproveToggle"

type AutoApproveToggles = {
	alwaysAllowReadOnly?: boolean
	alwaysAllowWrite?: boolean
	alwaysAllowBrowser?: boolean
	alwaysApproveResubmit?: boolean
	alwaysAllowMcp?: boolean
	alwaysAllowModeSwitch?: boolean
	alwaysAllowSubtasks?: boolean
	alwaysAllowExecute?: boolean
}

type AutoApproveStateSetters = {
	setAlwaysAllowReadOnly?: (value: boolean) => void
	setAlwaysAllowWrite?: (value: boolean) => void
	setAlwaysAllowBrowser?: (value: boolean) => void
	setAlwaysApproveResubmit?: (value: boolean) => void
	setAlwaysAllowMcp?: (value: boolean) => void
	setAlwaysAllowModeSwitch?: (value: boolean) => void
	setAlwaysAllowSubtasks?: (value: boolean) => void
	setAlwaysAllowExecute?: (value: boolean) => void
	setAutoApprovalEnabled?: (value: boolean) => void
}

type SetCachedStateFieldFunction = (key: any, value: any) => void

interface UseAutoApproveStateProps {
	toggles: AutoApproveToggles
	setters?: AutoApproveStateSetters
	setCachedStateField?: SetCachedStateFieldFunction
}

export const useAutoApproveState = ({ toggles, setters, setCachedStateField }: UseAutoApproveStateProps) => {
	// Calculate if any auto-approve action is enabled
	const hasAnyAutoApprovedAction = useMemo(() => Object.values(toggles).some((value) => !!value), [toggles])

	// Update individual auto-approval setting
	const updateAutoApprovalState = useCallback(
		(key: AutoApproveSetting, value: boolean) => {
			// Calculate updated toggles state
			const updatedToggles = { ...toggles, [key]: value }
			const hasAnyEnabled = Object.values(updatedToggles).some((v) => !!v)

			// Send vscode message for individual setting
			vscode.postMessage({ type: key, bool: value })

			// Update main auto-approval setting based on new state if setter available
			if (setters?.setAutoApprovalEnabled) {
				const shouldEnableAutoApproval = hasAnyEnabled
				setters.setAutoApprovalEnabled(shouldEnableAutoApproval)
				vscode.postMessage({ type: "autoApprovalEnabled", bool: shouldEnableAutoApproval })
			}

			// Update the specific setting state using appropriate setter
			if (setters) {
				switch (key) {
					case "alwaysAllowReadOnly":
						setters.setAlwaysAllowReadOnly?.(value)
						break
					case "alwaysAllowWrite":
						setters.setAlwaysAllowWrite?.(value)
						break
					case "alwaysAllowExecute":
						setters.setAlwaysAllowExecute?.(value)
						break
					case "alwaysAllowBrowser":
						setters.setAlwaysAllowBrowser?.(value)
						break
					case "alwaysAllowMcp":
						setters.setAlwaysAllowMcp?.(value)
						break
					case "alwaysAllowModeSwitch":
						setters.setAlwaysAllowModeSwitch?.(value)
						break
					case "alwaysAllowSubtasks":
						setters.setAlwaysAllowSubtasks?.(value)
						break
					case "alwaysApproveResubmit":
						setters.setAlwaysApproveResubmit?.(value)
						break
				}
			} else if (setCachedStateField) {
				// Fallback to setCachedStateField for settings page
				setCachedStateField(key, value)
			}
		},
		[toggles, setters, setCachedStateField],
	)

	// Handler for master checkbox toggle - toggles ALL individual settings
	const handleMasterToggle = useCallback(
		(enabled?: boolean) => {
			const newValue = enabled !== undefined ? enabled : !hasAnyAutoApprovedAction

			// Set all individual toggles to the new value
			Object.keys(autoApproveSettingsConfig).forEach((key) => {
				const settingKey = key as AutoApproveSetting
				// Send vscode message for individual setting
				vscode.postMessage({ type: settingKey, bool: newValue })

				// Update individual setting state using appropriate setter
				if (setters) {
					switch (settingKey) {
						case "alwaysAllowReadOnly":
							setters.setAlwaysAllowReadOnly?.(newValue)
							break
						case "alwaysAllowWrite":
							setters.setAlwaysAllowWrite?.(newValue)
							break
						case "alwaysAllowExecute":
							setters.setAlwaysAllowExecute?.(newValue)
							break
						case "alwaysAllowBrowser":
							setters.setAlwaysAllowBrowser?.(newValue)
							break
						case "alwaysAllowMcp":
							setters.setAlwaysAllowMcp?.(newValue)
							break
						case "alwaysAllowModeSwitch":
							setters.setAlwaysAllowModeSwitch?.(newValue)
							break
						case "alwaysAllowSubtasks":
							setters.setAlwaysAllowSubtasks?.(newValue)
							break
						case "alwaysApproveResubmit":
							setters.setAlwaysApproveResubmit?.(newValue)
							break
					}
				} else if (setCachedStateField) {
					// Fallback to setCachedStateField for settings page
					setCachedStateField(settingKey, newValue)
				}
			})

			// Update main auto-approval setting once at the end
			if (setters?.setAutoApprovalEnabled) {
				setters.setAutoApprovalEnabled(newValue)
				vscode.postMessage({ type: "autoApprovalEnabled", bool: newValue })
			}
		},
		[hasAnyAutoApprovedAction, setters, setCachedStateField],
	)

	return {
		hasAnyAutoApprovedAction,
		updateAutoApprovalState,
		handleMasterToggle,
	}
}
