import React, { useRef, useCallback, useEffect } from "react"
import { mergeRefs } from "use-callback-ref"

import { cn } from "@/lib/utils"
import { Command, CommandList, CommandGroup, CommandItem, CommandEmpty } from "@/components/ui"

import type { Mentionable } from "./types"
import { useMention } from "./useMention"
import { getCursorOffset, getCursorPos, replaceMention } from "./contentEditable"

interface MentionProps extends React.ComponentProps<"div"> {
	suggestions: Mentionable[]
	onMention?: (value: Mentionable) => void
}

export const Mention = React.forwardRef<HTMLDivElement, MentionProps>(
	({ suggestions, onMention, className, ...props }, ref) => {
		const contentEditableRef = useRef<HTMLDivElement | null>(null)
		const combinedRef = mergeRefs([contentEditableRef, ref])
		const menuRef = useRef<HTMLDivElement | null>(null)

		const {
			triggerPos,
			setTriggerPos,
			selectedSuggestion,
			setSelectedSuggestion,
			openMenu,
			closeMenu,
			isOpen,
			isOpenRef,
		} = useMention(suggestions)

		const onInput = useCallback(
			(event: React.FormEvent<HTMLDivElement>) => {
				const content = event.currentTarget.textContent || ""

				if (!content) {
					closeMenu()
					return
				}

				const selection = window.getSelection()

				if (!selection?.rangeCount) {
					return
				}

				const range = selection.getRangeAt(0)
				const div = contentEditableRef.current
				const offset = getCursorOffset(div, range.endContainer, range.endOffset)
				const text = content.slice(0, offset)
				const char = text[offset - 1]

				if (char === "@") {
					const coords = getCursorPos(div, offset - 1)

					if (coords) {
						setTriggerPos(coords)
						openMenu()
						return
					}
				}

				if (isOpenRef.current) {
					if (/\s/.test(char) || char === "\n") {
						closeMenu()
					} else {
						// const atIndex = text.lastIndexOf("@")
						// const query = text.slice(atIndex + 1)
						// handleSearch(query)
					}
				}
			},
			[setTriggerPos, openMenu, closeMenu, isOpenRef],
		)

		const onKeyDown = (event: React.KeyboardEvent) => {
			if (!isOpen) {
				return
			}

			// Prevent default behavior for all these keys to avoid unwanted scrolling.
			if (["Escape", "ArrowDown", "ArrowUp", "Enter", "Tab"].includes(event.key)) {
				event.preventDefault()
			}

			switch (event.key) {
				case "Escape":
					closeMenu()
					setSelectedSuggestion(undefined)
					break
				case "ArrowDown":
					setSelectedSuggestion((current) => {
						console.log(`ArrowDown, current = ${current}`)
						if (!current) {
							return suggestions[0]?.name
						}
						const currentIndex = suggestions.findIndex((suggestion) => suggestion.name === current)
						console.log(`ArrowDown, currentIndex = ${currentIndex}`)
						const nextIndex = Math.min(currentIndex + 1, suggestions.length - 1)
						return suggestions[nextIndex]?.name
					})
					break
				case "ArrowUp":
					setSelectedSuggestion((current) => {
						if (!current) {
							return suggestions[suggestions.length - 1]?.name
						}
						const currentIndex = suggestions.findIndex((suggestion) => suggestion.name === current)
						const prevIndex = Math.max(currentIndex - 1, 0)
						return suggestions[prevIndex]?.name
					})
					break
				case "Enter":
				case "Tab":
					if (selectedSuggestion) {
						onMentionSelect(selectedSuggestion)
					}
					break
			}
		}

		const onMentionSelect = (name: string) => {
			replaceMention(contentEditableRef.current, name)
			const mentionable = suggestions.find((suggestion) => suggestion.name === name)

			if (mentionable) {
				onMention?.(mentionable)
			}

			closeMenu()
		}

		const onClickOutside = useCallback(
			(event: MouseEvent) => {
				if (!isOpen) {
					return
				}

				const target = event.target as Node
				const contentEditable = contentEditableRef.current
				const menu = menuRef.current

				if (contentEditable && menu && !contentEditable.contains(target) && !menu.contains(target)) {
					closeMenu()
				}
			},
			[isOpen, closeMenu],
		)

		useEffect(() => {
			document.addEventListener("mousedown", onClickOutside)
			return () => document.removeEventListener("mousedown", onClickOutside)
		}, [onClickOutside])

		const top = triggerPos ? triggerPos.top : 0
		const left = triggerPos ? triggerPos.left : 0

		return (
			<div className="relative">
				<div
					ref={combinedRef}
					contentEditable
					onInput={onInput}
					onKeyDown={onKeyDown}
					className={cn(
						"w-[300px] h-[100px] rounded-xs border border-gray-300 bg-gray-200 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 break-words whitespace-pre-wrap overflow-y-auto",
						className,
					)}
					{...props}
				/>
				{isOpen && triggerPos && (
					<div ref={menuRef} className="absolute w-[200px]" style={{ top: `${top}px`, left: `${left}px` }}>
						<Command value={selectedSuggestion} onValueChange={setSelectedSuggestion}>
							<CommandList>
								<CommandGroup>
									{suggestions.length > 0 ? (
										suggestions.map((suggestion) => (
											<CommandItem
												key={suggestion.id}
												tabIndex={0}
												onSelect={() => onMentionSelect(suggestion.name)}>
												{suggestion.name}
											</CommandItem>
										))
									) : (
										<CommandEmpty>No suggestions found</CommandEmpty>
									)}
								</CommandGroup>
							</CommandList>
						</Command>
					</div>
				)}
			</div>
		)
	},
)

Mention.displayName = "Mention"
