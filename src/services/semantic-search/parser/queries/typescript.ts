export default `
  ; Import statements
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

  ; Class declarations
  (class_declaration
    name: (type_identifier) @class-name
    body: (class_body
      (method_definition
        name: (property_identifier) @method-name
        parameters: (formal_parameters) @method-params
        body: (statement_block) @method-body
      )+
    )
  ) @class

  ; Function declarations
  (function_declaration
    name: (identifier) @function-name
    parameters: (formal_parameters) @function-params
    body: (statement_block) @function-body
  ) @function

  ; Variable declarations
  (lexical_declaration
    (variable_declarator
      name: (identifier) @variable-name
      value: (expression)? @variable-value
    )+
  ) @variable

  (variable_declaration
    (variable_declarator
      name: (identifier) @variable-name
      value: (expression)? @variable-value
    )+
  ) @variable
`
