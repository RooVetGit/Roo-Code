import * as vscode from "vscode"

import type { ExperimentId } from "@roo-code/types"

import { EXPERIMENT_IDS, experiments as Experiments } from "../../../shared/experiments"
import { formatLanguage } from "../../../shared/language"
import { defaultModeSlug, getFullModeDetails } from "../../../shared/modes"
import { getApiMetrics } from "../../../shared/getApiMetrics"
import type { Task } from "../../task/Task"

export async function getMetadataContext(cline: Task) {
	const state = await cline.providerRef.deref()?.getState()
	const {
		mode,
		customModes,
		customModePrompts,
		experiments = {} as Record<ExperimentId, boolean>,
		customInstructions: globalCustomInstructions,
		language,
	} = state ?? {}

	// High-Frequency Metadata
	const now = new Date()
	const timeZoneOffset = -now.getTimezoneOffset()
	const offsetHours = Math.floor(Math.abs(timeZoneOffset) / 60)
	const offsetMinutes = Math.abs(timeZoneOffset) % 60
	const offsetSign = timeZoneOffset >= 0 ? "+" : "-"
	const offsetString = `${offsetSign}${offsetHours
		.toString()
		.padStart(2, "0")}:${offsetMinutes.toString().padStart(2, "0")}`
	const isoDateWithOffset = now.toISOString().replace(/Z$/, offsetString)
	const time = {
		"@I": isoDateWithOffset,
	}

	const { totalCost } = getApiMetrics(cline.clineMessages)
	const cost = {
		"@t": totalCost !== null ? totalCost.toFixed(2) : "0.00",
		"@c": "USD",
		"#text": "Must form responses to minimize cost growth",
	}

	// Low-Frequency Metadata
	const currentMode = mode ?? defaultModeSlug
	const modeDetails = await getFullModeDetails(currentMode, customModes, customModePrompts, {
		cwd: cline.cwd,
		globalCustomInstructions,
		language: language ?? formatLanguage(vscode.env.language),
	})

	const { id: modelId } = cline.api.getModel()
	const modeInfo = {
		"@slug": currentMode,
		"@name": modeDetails.name,
		"@model": modelId,
		...(Experiments.isEnabled(experiments ?? {}, EXPERIMENT_IDS.POWER_STEERING) && {
			"@role": modeDetails.roleDefinition,
			...(modeDetails.customInstructions && {
				"@customInstructions": modeDetails.customInstructions,
			}),
		}),
	}

	return { time, cost, mode: modeInfo }
}
