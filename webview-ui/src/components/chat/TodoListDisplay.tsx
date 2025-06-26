import { useState, useRef, useMemo, useEffect } from "react"

export function TodoListDisplay({ todos }: { todos: any[] }) {
	const [isCollapsed, setIsCollapsed] = useState(false)
	const ulRef = useRef<HTMLUListElement>(null)
	const itemRefs = useRef<(HTMLLIElement | null)[]>([])
	const scrollIndex = useMemo(() => {
		const inProgressIdx = todos.findIndex((todo: any) => todo.status === "in_progress")
		if (inProgressIdx !== -1) return inProgressIdx
		return todos.findIndex((todo: any) => todo.status !== "completed")
	}, [todos])
	useEffect(() => {
		if (isCollapsed) return
		if (!ulRef.current) return
		if (scrollIndex === -1) return
		const target = itemRefs.current[scrollIndex]
		if (target && ulRef.current) {
			const ul = ulRef.current
			const targetTop = target.offsetTop - ul.offsetTop
			const targetHeight = target.offsetHeight
			const ulHeight = ul.clientHeight
			const scrollTo = targetTop - (ulHeight / 2 - targetHeight / 2)
			ul.scrollTop = scrollTo
		}
	}, [todos, isCollapsed, scrollIndex])
	if (!Array.isArray(todos) || todos.length === 0) return null

	const totalCount = todos.length
	const completedCount = todos.filter((todo: any) => todo.status === "completed").length

	return (
		<div
			style={{
				margin: "6px 0 0 0",
				border: "1px dashed var(--vscode-panel-border)",
				borderRadius: 4,
				padding: "4px 6px",
				background: "var(--vscode-editor-background,transparent)",
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 4,
					marginBottom: isCollapsed ? 0 : 2,
					cursor: "pointer",
					userSelect: "none",
				}}
				onClick={() => setIsCollapsed((v) => !v)}>
				<span
					className="codicon codicon-checklist"
					style={{ color: "var(--vscode-foreground)", marginBottom: "-1.5px" }}
				/>
				<span style={{ fontWeight: "bold" }}>Todo List</span>
				<span
					style={{
						marginLeft: 6,
						color: "var(--vscode-descriptionForeground)",
						fontSize: isCollapsed ? 13 : 12,
						fontWeight: 500,
						opacity: isCollapsed ? 1 : 0.8,
					}}>
					{completedCount}/{totalCount}
				</span>
				<span
					className={`codicon codicon-chevron-${isCollapsed ? "down" : "up"}`}
					style={{ marginLeft: 3, fontSize: 12, opacity: 0.7 }}
				/>
			</div>
			{!isCollapsed && (
				<ul
					ref={ulRef}
					style={{
						margin: 0,
						paddingLeft: 0,
						listStyle: "none",
						maxHeight: 56,
						overflowY: todos.length > 2 ? "auto" : "visible",
						transition: "max-height 0.2s",
					}}>
					{todos.map((todo: any, idx: number) => {
						let icon
						if (todo.status === "completed") {
							icon = (
								<span
									style={{
										display: "inline-block",
										width: 14,
										height: 14,
										borderRadius: "50%",
										border: "2px solid var(--vscode-charts-green)",
										background: "var(--vscode-charts-green)",
										verticalAlign: "middle",
										marginRight: 6,
										position: "relative",
									}}>
									<svg
										width="10"
										height="10"
										viewBox="0 0 14 14"
										style={{
											position: "absolute",
											top: 1,
											left: 1,
										}}>
										<polyline
											points="2,7 6,11 12,3"
											style={{
												fill: "none",
												stroke: "#fff",
												strokeWidth: 2,
												strokeLinecap: "round",
												strokeLinejoin: "round",
											}}
										/>
									</svg>
								</span>
							)
						} else if (todo.status === "in_progress") {
							icon = (
								<span
									style={{
										display: "inline-block",
										width: 14,
										height: 14,
										borderRadius: "50%",
										border: "2px solid var(--vscode-charts-yellow)",
										background: "rgba(255, 221, 51, 0.15)",
										verticalAlign: "middle",
										marginRight: 6,
										position: "relative",
									}}>
									<svg
										width="10"
										height="10"
										viewBox="0 0 14 14"
										style={{
											position: "absolute",
											top: 1,
											left: 1,
										}}>
										<circle
											cx="7"
											cy="7"
											r="5"
											stroke="var(--vscode-charts-yellow)"
											strokeWidth="2"
											fill="none"
										/>
										<polyline
											points="3,7 6,10 11,4"
											style={{
												fill: "none",
												stroke: "var(--vscode-charts-yellow)",
												strokeWidth: 2,
												strokeLinecap: "round",
												strokeLinejoin: "round",
												opacity: 0.7,
											}}
										/>
									</svg>
								</span>
							)
						} else {
							icon = (
								<span
									style={{
										display: "inline-block",
										width: 14,
										height: 14,
										borderRadius: "50%",
										border: "2px solid #bbb",
										background: "transparent",
										verticalAlign: "middle",
										marginRight: 6,
									}}
								/>
							)
						}
						return (
							<li
								key={todo.id || todo.content}
								ref={(el) => (itemRefs.current[idx] = el)}
								style={{
									marginBottom: 2,
									display: "flex",
									alignItems: "center",
									minHeight: 20,
								}}>
								{icon}
								<span
									style={{
										fontWeight: 500,
										color:
											todo.status === "completed"
												? "var(--vscode-charts-green)"
												: todo.status === "in_progress"
													? "var(--vscode-charts-yellow)"
													: "var(--vscode-foreground)",
									}}>
									{todo.content}
								</span>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
