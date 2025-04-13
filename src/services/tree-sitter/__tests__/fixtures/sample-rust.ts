export default String.raw`
// Function definitions - capturing standard, async, and const functions
fn standard_function_definition(
    param1: i32,
    param2: &str,
    param3: Option<String>
) -> Result<i32, String> {
    println!("Standard function with parameters");
    let result = param1 + param3.map_or(0, |s| s.len() as i32);
    Ok(result)
}

async fn async_function_definition(
    url: &str,
    timeout: std::time::Duration,
    retry_count: u32
) -> Result<String, Box<dyn std::error::Error>> {
    println!("Async function with parameters");
    println!("URL: {}, timeout: {:?}, retries: {}", url, timeout, retry_count);
    Ok(String::from("Async response"))
}

const fn const_function_definition<T: Copy>(
    value: T,
    multiplier: usize
) -> [T; 4] {
    println!("Const function for compile-time evaluation");
    [value; 4]
}

// Struct definitions - capturing standard, tuple, and unit structs
struct standard_struct_definition {
    field1: String,
    field2: i32,
    field3: Option<Vec<f64>>,
    field4: std::collections::HashMap<String, i32>,
}

struct tuple_struct_definition(
    String,
    i32,
    Option<Vec<f64>>,
    std::collections::HashMap<String, i32>
);

struct unit_struct_definition;

// Enum definitions - capturing variants with and without data
enum enum_definition {
    UnitVariant,
    TupleVariant(String, i32, f64),
    StructVariant {
        name: String,
        value: i32,
        data: Option<Vec<f64>>,
    },
    MultipleVariants(
        String,
        i32,
        f64,
        Option<Box<enum_definition>>
    ),
}

// Trait definitions - capturing default and required methods
trait trait_definition {
    // Required methods without implementation
    fn required_trait_method(&self, param: i32) -> bool;
    fn required_trait_method_with_generics<T: Clone>(&self, param: T) -> Option<T>;
    
    // Default methods with implementation
    fn default_trait_method(&self) -> String {
        String::from("Default implementation in trait")
    }
    
    fn another_default_trait_method(&self, prefix: &str) -> String {
        format!("{}: {}", prefix, self.default_trait_method())
    }
}

// Impl blocks - capturing trait and inherent implementations
impl standard_struct_definition {
    // Inherent implementation
    fn inherent_implementation_method(
        &self,
        multiplier: i32
    ) -> i32 {
        self.field2 * multiplier
    }
    
    fn inherent_static_method(
        name: String,
        value: i32
    ) -> Self {
        Self {
            field1: name,
            field2: value,
            field3: None,
            field4: std::collections::HashMap::new(),
        }
    }
}

impl trait_definition for standard_struct_definition {
    // Trait implementation
    fn required_trait_method(
        &self,
        param: i32
    ) -> bool {
        self.field2 > param
    }
    
    fn required_trait_method_with_generics<T: Clone>(
        &self,
        param: T
    ) -> Option<T> {
        if self.field2 > 0 {
            Some(param)
        } else {
            None
        }
    }
}

// Module definitions - capturing mod and use declarations
mod module_definition {
    use std::collections::HashMap;
    use std::io::{self, Read, Write};
    use super::{
        standard_struct_definition,
        trait_definition,
        enum_definition
    };
    
    pub fn module_function(
        param: &standard_struct_definition
    ) -> io::Result<String> {
        Ok(format!("Module function: {}", param.field1))
    }
}

// Macro definitions - capturing declarative and procedural macros
macro_rules! declarative_macro_definition {
    // Simple pattern
    ($expr:expr) => {
        println!("Macro expanded: {}", $expr);
    };
    
    // Multiple patterns with different formats
    ($expr:expr, $($arg:expr),*) => {
        {
            print!("Macro expanded: {}", $expr);
            $(
                print!(", {}", $arg);
            )*
            println!("");
        }
    };
}

// Procedural macros would typically be defined in a separate crate with #[proc_macro]
// This is a stand-in example showing what would be the usage in code
#[derive(
    procedural_macro_definition,
    Debug,
    Clone,
    PartialEq
)]
struct struct_with_procedural_macros {
    field1: String,
    field2: i32,
}

// Type aliases - capturing basic and generic types
type type_alias_definition = fn(i32, &str) -> Result<String, std::io::Error>;

type generic_type_alias_definition<T, E> = Result<
    std::collections::HashMap<String, T>,
    Box<dyn std::error::Error + Send + Sync + 'static>
>;

// Const/Static items - capturing both forms
const constant_item_definition: f64 = 3.14159265358979323846;

static static_item_definition: &str =
    "This is a static string that lives for the entire program duration";

// Lifetime parameters - capturing annotations and bounds
struct lifetime_parameters_definition<'a, 'b: 'a> {
    reference1: &'a str,
    reference2: &'b str,
    reference3: &'a [&'b str],
    reference4: std::collections::HashMap<&'a str, &'b str>,
}

impl<'shorter, 'longer: 'shorter> lifetime_parameters_definition<'shorter, 'longer> {
    fn lifetime_method_definition<'a, 'b>(
        &'a self,
        param: &'b str
    ) -> &'shorter str
    where
        'b: 'a,
    {
        self.reference1
    }
}
`
