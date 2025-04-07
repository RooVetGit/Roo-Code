import { ToolArgs } from "./types"

export function getNotebookEditToolDescription(args: ToolArgs): string {
	return `## notebook_edit
Description: Edit the active notebook. This tool allows you to insert new cells, append cells to the end, or replace existing cells. Note that new/modified code cells will be executed immediately by default, unless the noexec parameter is true.
Parameters:
- action: (required) The action to perform. Valid values are:
  - "insert_cells": Insert new cells into the notebook (or append to the end if insert_at_index is omitted)
  - "modify_cell_content": Modify the content of existing cells in the notebook (note: this will clear any existing outputs)
  - "replace_cells": Replace a range of cells with new cells (note: this will clear any existing outputs)
  - "delete_cells": Delete a range of cells from the notebook
- cells: (required for insert_cells, modify_cell_content, replace_cells) Contains cell definitions using markdown code blocks:
  - For insert_cells: A series of code blocks representing the cells to insert
  - For modify_cell_content: Code blocks with @cell#N tag before each block (where N is the 0-based index)
  - For replace_cells: Series of code blocks to replace the specified range of cells
- insert_at_index: (optional, only for insert_cells action) The position to insert cells at (0-based, defaults to end of notebook)
- start_index: (required for replace_cells and delete_cells) The starting index of the range (0-based, inclusive)
- end_index: (required for replace_cells and delete_cells) The ending index of the range (0-based, exclusive)
- noexec: (optional) Boolean value to prevent automatic execution of new/modified code cells.

The language of each cell is determined by the code block header (e.g., \`\`\`python).
Cells with \`\`\`markdown header are treated as markdown cells, all others are code cells.

Usage:
<notebook_edit>
<action>action name here</action>
<cells>
(markdown code blocks for cell content here)
</cells>
<insert_at_index>index value here (if required)</insert_at_index>
<start_index>start index (for replace/delete actions)</start_index>
<end_index>end index (for replace/delete actions)</end_index>
<noexec>true</noexec>
</notebook_edit>

Example 1: Insert multiple cells at index 0
<notebook_edit>
<action>insert_cells</action>
<insert_at_index>0</insert_at_index>
<cells>
\`\`\`markdown
# Data Analysis
This notebook contains the analysis of our dataset.
\`\`\`

\`\`\`python
import pandas as pd
import numpy as np
df = pd.read_csv('data.csv')
df.head()
\`\`\`
</cells>
</notebook_edit>

Example 2: Append a new markdown cell (no insert_at_index specified)
<notebook_edit>
<action>insert_cells</action>
<cells>
\`\`\`markdown
# Data Analysis
This notebook contains the analysis of our dataset with the following steps:
1. Data loading and cleaning
2. Exploratory data analysis
3. Statistical testing
4. Visualization
\`\`\`
</cells>
</notebook_edit>

Example 3: Modify multiple existing cells without execution
<notebook_edit>
<action>modify_cell_content</action>
<cells>
@cell#2
\`\`\`python
import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.plot(df['x'], df['y'])
plt.title('Data Visualization')
plt.xlabel('X Axis')
plt.ylabel('Y Axis')
plt.show()
\`\`\`

@cell#3
\`\`\`markdown
# Statistical Analysis
Let's analyze the correlation between variables.
\`\`\`
</cells>
<noexec>true</noexec>
</notebook_edit>

Example 4: Replace a range of cells with new cells
<notebook_edit>
<action>replace_cells</action>
<start_index>2</start_index>
<end_index>4</end_index>
<cells>
\`\`\`python
import matplotlib.pyplot as plt
import seaborn as sns

plt.figure(figsize=(10, 6))
sns.scatterplot(x='x', y='y', data=df)
plt.title('Scatter Plot')
plt.show()
\`\`\`

\`\`\`markdown
## Observations
The scatter plot shows a positive correlation between x and y variables.
\`\`\`
</cells>
</notebook_edit>

Example 5: Delete a range of cells
<notebook_edit>
<action>delete_cells</action>
<start_index>2</start_index>
<end_index>4</end_index>
<cells>
</cells>
</notebook_edit>

Notes:
- The user must have opened a notebook file in VSCode to have an active notebook in the workspace
- If no active notebook is found, an error message will be returned
- Cell indices are 0-based (the first cell is at index 0)
- For modify_cell_content, each code block must have a @cell#N tag to identify which cell to modify`
}
