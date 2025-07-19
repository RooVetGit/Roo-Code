import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { CheckpointMenu } from "./CheckpointMenu"
import { checkpointSchema } from "./schema"

type CheckpointSavedProps = {
	ts: number
	commitHash: string
	currentHash?: string
	checkpoint?: Record<string, unknown>
}

export const CheckpointSaved = ({ checkpoint, ...props }: CheckpointSavedProps) => {
	const { t } = useTranslation()
	const isCurrent = props.currentHash === props.commitHash

	const metadata = useMemo(() => {
		if (!checkpoint) {
			console.warn("[CheckpointSaved] No checkpoint metadata provided", { ts: props.ts, commitHash: props.commitHash })
			return undefined
		}

		const result = checkpointSchema.safeParse(checkpoint)

		if (!result.success) {
			console.warn("[CheckpointSaved] Invalid checkpoint metadata", {
				checkpoint,
				errors: result.error.errors,
				ts: props.ts,
				commitHash: props.commitHash
			})
			return undefined
		}

		return result.data
	}, [checkpoint, props.ts, props.commitHash])

	// Always show the checkpoint, even if metadata is invalid
	// This ensures users can see that checkpoints are being created
	const fallbackMetadata = useMemo(() => {
		if (metadata) {
			return metadata
		}
		
		// Create fallback metadata when the original is invalid
		return {
			isFirst: false, // Default to regular checkpoint
			from: "", // Empty string as fallback
			to: props.commitHash, // Use the commit hash we have
		}
	}, [metadata, props.commitHash])

	return (
		<div className="flex items-center justify-between">
			<div className="flex gap-2">
				<span className="codicon codicon-git-commit text-blue-400" />
				<span className="font-bold">
					{fallbackMetadata.isFirst ? t("chat:checkpoint.initial") : t("chat:checkpoint.regular")}
				</span>
				{isCurrent && <span className="text-muted text-sm">{t("chat:checkpoint.current")}</span>}
				{!metadata && (
					<span className="text-muted text-xs italic">
						{t("chat:checkpoint.metadataUnavailable", "metadata unavailable")}
					</span>
				)}
			</div>
			<CheckpointMenu {...props} checkpoint={fallbackMetadata} />
		</div>
	)
}
