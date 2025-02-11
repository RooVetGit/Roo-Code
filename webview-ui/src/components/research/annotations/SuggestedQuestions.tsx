import { SuggestedQuestionsData } from "../annotation"
import { ChatHandler } from "../types"

export function SuggestedQuestions({
	questions,
	append,
}: {
	questions: SuggestedQuestionsData
	append: ChatHandler["append"]
}) {
	const showQuestions = questions.length > 0
	return (
		showQuestions && (
			<div className="flex flex-col space-y-2">
				{questions.map((question, index) => (
					// eslint-disable-next-line jsx-a11y/anchor-is-valid
					<a
						key={index}
						onClick={() => {
							append({ role: "user", content: question })
						}}
						className="cursor-pointer text-sm italic hover:underline">
						{"->"} {question}
					</a>
				))}
			</div>
		)
	)
}
