export default `
(
  (comment)* @doc
  .
  (import_statement
    source: (string) @import-source
    (import_clause
      ((identifier) @default-import)?
      (named_imports
        (import_specifier
          name: (identifier) @named-import
          alias: (identifier)? @import-alias
        ))*
    )?
  ) @import
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @import)
)

(
  (comment)* @doc
  .
  (class_declaration
    name: (type_identifier) @class-name
    body: (class_body
      (method_definition) @method
    )
  ) @class
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @class)
)

(
  (comment)* @doc
  .
  (method_definition
    name: (property_identifier) @method-name
    parameters: (formal_parameters) @method-params
    body: (statement_block) @method-body
  ) @method
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @method)
)

(
  (comment)* @doc
  .
  (function_declaration
    name: (identifier) @function-name
    parameters: (formal_parameters) @function-params
    body: (statement_block) @function-body
  ) @function
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @function)
)

(
  (comment)* @doc
  .
  (variable_declaration
    (variable_declarator
      name: (identifier) @variable-name
      value: (_) @variable-value
    )
  ) @variable
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @variable)
)

(
  (comment)* @doc
  .
  (lexical_declaration
    (variable_declarator
      name: (identifier) @variable-name
      value: (_)? @variable-value
    )
  ) @variable
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @variable)
)
`
