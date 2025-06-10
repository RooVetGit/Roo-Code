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
	const hasAnyAutoApprovedAction = useMemo(() => {
		return Object.values(toggles).some((value) => !!value)
	}, [toggles])

	// Update individual auto-approval setting
	const updateAutoApprovalState = useCallback(
		(key: AutoApproveSetting, value: boolean) => {
			// Send vscode message for individual setting
			vscode.postMessage({ type: key, bool: value })

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

				// Update main auto-approval setting after state update
				if (setters.setAutoApprovalEnabled) {
					// Calculate if any will be enabled after this update
					const updatedToggles = { ...toggles, [key]: value }
					const hasAnyEnabled = Object.values(updatedToggles).some((v) => !!v)
					setters.setAutoApprovalEnabled(hasAnyEnabled)
					vscode.postMessage({ type: "autoApprovalEnabled", bool: hasAnyEnabled })
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

			// Batch all updates to reduce re-renders
			if (setters) {
				// Update all individual settings in one batch
				setters.setAlwaysAllowReadOnly?.(newValue)
				setters.setAlwaysAllowWrite?.(newValue)
				setters.setAlwaysAllowExecute?.(newValue)
				setters.setAlwaysAllowBrowser?.(newValue)
				setters.setAlwaysAllowMcp?.(newValue)
				setters.setAlwaysAllowModeSwitch?.(newValue)
				setters.setAlwaysAllowSubtasks?.(newValue)
				setters.setAlwaysApproveResubmit?.(newValue)

				// Update main auto-approval setting
				if (setters.setAutoApprovalEnabled) {
					setters.setAutoApprovalEnabled(newValue)
				}
			} else if (setCachedStateField) {
				// Fallback to setCachedStateField for settings page
				Object.keys(autoApproveSettingsConfig).forEach((key) => {
					setCachedStateField(key as AutoApproveSetting, newValue)
				})
			}

			// Send all vscode messages in one batch
			Object.keys(autoApproveSettingsConfig).forEach((key) => {
				vscode.postMessage({ type: key as AutoApproveSetting, bool: newValue })
			})
			vscode.postMessage({ type: "autoApprovalEnabled", bool: newValue })
		},
		[hasAnyAutoApprovedAction, setters, setCachedStateField],
	)

	return {
		hasAnyAutoApprovedAction,
		updateAutoApprovalState,
		handleMasterToggle,
	}
}
