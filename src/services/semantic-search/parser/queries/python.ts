export default `
  ; Simple imports (both regular and aliased)
  (import_statement
    [
      (dotted_name) @import-source  ; For: import numpy
      (aliased_import               ; For: import numpy as np
        (dotted_name) @import-source
        (identifier) @import-alias
      )
    ]
  ) @import

  ; From imports (both regular and aliased)
  (import_from_statement
    module_name: (dotted_name) @import-source
    (aliased_import
      (dotted_name) @named-import
      (identifier)? @import-alias
    )
  ) @import

  ; Class definitions
  (
    (comment)* @doc
    .
    (class_definition
      name: (identifier) @class-name
    ) @class
    (#strip! @doc "^[\\s#]+")
    (#select-adjacent! @doc @class)
  )

  ; Function definitions
  (
    (comment)* @doc
    .
    (function_definition
      name: (identifier) @method-name
      parameters: (parameters) @method-params
      body: (block) @method-body
    ) @function
    (#strip! @doc "^[\\s#]+")
    (#select-adjacent! @doc @function)
  )

  ; Variable assignments
  (
    (comment)* @doc
    .
    (assignment
      left: (identifier) @variable-name
      right: (_) @variable-value
    ) @variable
    (#strip! @doc "^[\\s#]+")
    (#select-adjacent! @doc @variable)
  )

  ; Docstrings
  (
    (comment)* @doc
    .
    (expression_statement
      (string) @docstring
    )
    (#select-adjacent! @doc @docstring)
  )
`
