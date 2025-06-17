import { memo } from "react"

import { useTaskSearch } from "./useTaskSearch"
import TaskItem from "./TaskItem"

const HistoryPreview = () => {
	const { tasks, loading } = useTaskSearch({ limit: 3 })

	return (
		<div className="flex flex-col gap-3">
			{!loading && tasks.length !== 0 && (
				<>
					{tasks.map((item) => (
						<TaskItem key={item.id} item={item} variant="compact" />
					))}
				</>
			)}
		</div>
	)
}

export default memo(HistoryPreview)
