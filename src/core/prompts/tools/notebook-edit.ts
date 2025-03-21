import { ToolArgs } from "./types"

export function getNotebookEditToolDescription(args: ToolArgs): string {
	return `## notebook_edit
Description: Edit the active notebook in the editor. This tool allows you to insert new cells or replace existing cells. Note that new/modified code cells will be executed immediately, by default, unless the <noexec/> parameter presents.
Parameters:
- action: (required) The action to perform. Valid values are:
  - "insert_cells": Insert a new cell into the notebook
  - "modify_cell_content": Modify the content of an existing cell in the notebook (note: this will clear any existing outputs)
  - "replace_cells": Replace a range of cells with a new cell (note: this will clear any existing outputs)
- cell_index: (required for modify_cell_content, optional for insert_cells) The index of the cell to modify (0-based), or for insert_cells the position to insert at (defaults to end of notebook)
- start_index: (required for replace_cells) The starting index of the range to replace (0-based, inclusive)
- end_index: (required for replace_cells) The ending index of the range to replace (0-based, exclusive)
- cell_type: (optional for insert_cells and replace_cells) The type of cell, either "code" or "markdown"
- language_id: (optional for insert_cells and replace_cells) The language of the cell (e.g., "python", "javascript")
- cell_content: (required for all actions) The content of the cell
- noexec: (optional) Can be used as a flag <noexec/> or with explicit value <noexec>true</noexec> to prevent automatic execution of new/modified code cells.
Usage:
<notebook_edit>
<action>action name here</action>
<cell_index>index value here (if required)</cell_index>
<start_index>start index here (if required)</start_index>
<end_index>end index here (if required)</end_index>
<cell_type>cell type here (if required)</cell_type>
<language_id>language here (if required)</language_id>
<cell_content>cell content here</cell_content>
<noexec/>
</notebook_edit>

Example 1: Insert a new Python code cell
<notebook_edit>
<action>insert_cells</action>
<cell_index>0</cell_index>
<cell_type>code</cell_type>
<language_id>python</language_id>
<cell_content>import pandas as pd
import numpy as np
df = pd.read_csv('data.csv')
df.head()</cell_content>
</notebook_edit>

Example 2: Insert a new markdown cell
<notebook_edit>
<action>insert_cells</action>
<cell_type>markdown</cell_type>
<cell_content># Data Analysis
This notebook contains the analysis of our dataset with the following steps:
1. Data loading and cleaning
2. Exploratory data analysis
3. Statistical testing
4. Visualization</cell_content>
</notebook_edit>

Example 3: Modify an existing cell without execution
<notebook_edit>
<action>modify_cell_content</action>
<cell_index>2</cell_index>
<noexec/>
<cell_content>import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.plot(df['x'], df['y'])
plt.title('Data Visualization')
plt.xlabel('X Axis')
plt.ylabel('Y Axis')
plt.show()</cell_content>
</notebook_edit>

Example 4: Replace a range of cells with a new cell
<notebook_edit>
<action>replace_cells</action>
<start_index>2</start_index>
<end_index>4</end_index>
<cell_type>code</cell_type>
<language_id>python</language_id>
<cell_content>import matplotlib.pyplot as plt
import seaborn as sns

plt.figure(figsize=(10, 6))
sns.scatterplot(x='x', y='y', data=df)
plt.title('Scatter Plot')
plt.show()</cell_content>
</notebook_edit>

IMPORTANT: For insert_cells and replace_cells, each cell_content tag creates a new cell. The cell_type and language_id tags must come BEFORE the cell_content tag they apply to. The last cell_type before a cell_content will be used as that cell's type, and the last language_id before a cell_content will be used as that cell's language.`
}
