/*
C# Tree-Sitter Query Patterns
This file contains query patterns for parsing C# source code definitions.
Each pattern captures a specific language construct and is mapped to corresponding tests.

The patterns are organized by language construct type:
1. Namespace-level declarations (namespaces)
2. Type declarations (classes, interfaces, structs, enums, records)
3. Member declarations (methods, properties)

Each pattern has been tested and verified with the corresponding test file.
*/
export default `
;-------------------------------------------------
; NAMESPACE DECLARATIONS
;-------------------------------------------------
; Captures namespace names including standard and file-scoped namespaces
(namespace_declaration
  name: (identifier) @name.definition.namespace) @definition.namespace

;-------------------------------------------------
; TYPE DECLARATIONS
;-------------------------------------------------
; Class declarations
; Captures class names for standard, static, generic, and nested classes
(class_declaration
  name: (identifier) @name.definition.class) @definition.class

; Interface declarations
; Captures interface names
(interface_declaration
  name: (identifier) @name.definition.interface) @definition.interface

; Struct declarations
; Captures struct names
(struct_declaration
  name: (identifier) @name.definition.struct) @definition.struct

; Enum declarations
; Captures enum names
(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

; Record declarations
; Captures record names (C# 9.0+)
(record_declaration
  name: (identifier) @name.definition.record) @definition.record

;-------------------------------------------------
; MEMBER DECLARATIONS
;-------------------------------------------------
; Method declarations
; Captures method names including:
; - Standard methods with block bodies
; - Methods with expression bodies (=>)
; - Static, async, and generic methods
; - Extension methods
; - Abstract and override methods
(method_declaration
  name: (identifier) @name.definition.method) @definition.method

; Property declarations
; Captures property names with various accessor patterns:
; - Standard properties with get/set
; - Auto-implemented properties
; - Properties with custom accessors
; - Properties with init accessor (C# 9.0+)
; - Required properties (C# 11.0+)
(property_declaration
  name: (identifier) @name.definition.property) @definition.property
`
