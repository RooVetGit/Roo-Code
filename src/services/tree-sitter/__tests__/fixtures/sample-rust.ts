export default String.raw`
// Testing basic struct with fields
struct TestBasicStruct {
    test_field_x: f64,
    test_field_y: f64,
}

// Testing struct with implementation methods
struct TestMethodStruct {
    test_width: u32,
    test_height: u32,
}

impl TestMethodStruct {
    // Testing method definition
    fn test_area_method(&self) -> u32 {
        self.test_width * self.test_height
    }

    // Testing method with parameters
    fn test_comparison_method(&self, other: &TestMethodStruct) -> bool {
        self.test_width > other.test_width && self.test_height > other.test_height
    }

    // Testing associated function
    fn test_factory_method(size: u32) -> TestMethodStruct {
        TestMethodStruct {
            test_width: size,
            test_height: size,
        }
    }
}

// Testing standalone function
fn test_calculation_function(p1: &TestBasicStruct, p2: &TestBasicStruct) -> f64 {
    let dx = p2.test_field_x - p1.test_field_x;
    let dy = p2.test_field_y - p1.test_field_y;
    (dx * dx + dy * dy).sqrt()
}

// Testing complex struct with multiple fields
struct TestComplexStruct {
    test_string_field1: String,
    test_string_field2: String,
    test_number_field: u32,
}

impl TestComplexStruct {
    // Testing constructor method
    fn test_new_method(field1: String, field2: String, number: u32) -> TestComplexStruct {
        TestComplexStruct {
            test_string_field1: field1,
            test_string_field2: field2,
            test_number_field: number,
        }
    }

    // Testing string formatting method
    fn test_format_method(&self) -> String {
        format!("{} {} ({})", self.test_string_field1, self.test_string_field2, self.test_number_field)
    }
}

// Testing string processing function
fn test_string_processing(input: &str) -> String {
    format!("Test processed: {}", input)
}

// Testing enum with variants
enum TestEnum {
    TestVariant1,
    TestVariant2,
    TestVariant3(String),
    TestVariant4 { test_code: i32, test_message: String },
}

// Testing trait definition
trait TestTrait {
    fn test_trait_method(&self);
    fn test_trait_dimensions(&self) -> (u32, u32);
}

// Testing trait implementation
impl TestTrait for TestMethodStruct {
    fn test_trait_method(&self) {
        println!("Testing trait method: {}x{}", self.test_width, self.test_height);
    }
    
    fn test_trait_dimensions(&self) -> (u32, u32) {
        (self.test_width, self.test_height)
    }
}

// Testing generic struct with lifetime
struct TestGenericStruct<'a, T> {
    test_data: &'a T,
    test_count: usize,
}

impl<'a, T> TestGenericStruct<'a, T> {
    fn test_generic_method(data: &'a T) -> TestGenericStruct<'a, T> {
        TestGenericStruct {
            test_data: data,
            test_count: 1,
        }
    }
}

// Testing macro definition
macro_rules! test_macro {
    ($test_param:expr) => {
        println!("Test macro output: {}", $test_param);
    };
    ($test_param:expr, $($test_args:tt)*) => {
        println!("Test macro with args: {}", $test_param);
        test_macro!($($test_args)*);
    };
}

// Testing module definition
mod test_module {
    // Testing constants
    pub const TEST_CONSTANT: f64 = 3.14159;
    
    // Testing static variables
    pub static TEST_STATIC: &str = "1.0.0";
    
    // Testing type alias
    pub type TestType = f64;
    
    // Testing module functions
    pub fn test_add(a: TestType, b: TestType) -> TestType {
        a + b
    }
    
    pub fn test_subtract(a: TestType, b: TestType) -> TestType {
        a - b
    }
}

// Testing union type
union TestUnion {
    test_int: i32,
    test_float: f32,
}

// Testing trait with associated type
trait TestIterator {
    type TestItem;
    
    fn test_next(&mut self) -> Option<Self::TestItem>;
    
    fn test_count(self) -> usize where Self: Sized {
        let mut count = 0;
        while let Some(_) = self.test_next() {
            count += 1;
        }
        count
    }
}

// Testing closure definitions
fn test_closures() {
    let test_capture = 42;
    
    let test_basic_closure = || {
        println!("Test captured value: {}", test_capture);
    };
    
    let test_param_closure = |a: i32, b: i32| -> i32 {
        let sum = a + b + test_capture;
        println!("Test closure sum: {}", sum);
        sum
    };
    
    test_basic_closure();
    let result = test_param_closure(10, 20);
}

// Testing pattern matching
fn test_pattern_matching(value: Option<Result<Vec<i32>, String>>) {
    match value {
        Some(Ok(vec)) if vec.len() > 5 => {
            println!("Test vector > 5 elements");
            for item in vec {
                println!("Test item: {}", item);
            }
        },
        Some(Ok(vec)) => {
            println!("Test vector length: {}", vec.len());
        },
        Some(Err(e)) => {
            println!("Test error: {}", e);
        },
        None => {
            println!("Test none case");
        }
    }
}

// Testing where clause constraints
fn test_where_clause<T>(collection: &[T])
where
    T: std::fmt::Debug + Ord + Clone,
{
    let mut sorted = collection.to_vec();
    sorted.sort();
    println!("Test sorted: {:?}", sorted);
}

// Testing attribute macros
#[derive(Debug, Clone, PartialEq)]
struct TestAttributeStruct {
    test_field1: String,
    test_field2: i32,
}

#[cfg(test)]
mod test_attribute_module {
    #[test]
    fn test_attribute_function() {
        assert_eq!(2 + 2, 4);
    }
}

// Testing async function
async fn test_async_function(url: &str) -> Result<String, String> {
    println!("Test async request: {}", url);
    
    let result = async {
        Ok("Test response".to_string())
    }.await;
    
    result
}

// Testing generic implementation
struct TestGenericImpl<T, U> {
    test_first: T,
    test_second: U,
}

impl<T, U> TestGenericImpl<T, U>
where
    T: std::fmt::Display,
    U: std::fmt::Debug,
{
    fn test_generic_new(first: T, second: U) -> Self {
        TestGenericImpl { test_first: first, test_second: second }
    }
    
    fn test_generic_display(&self) {
        println!("Test first: {}, Test second: {:?}", self.test_first, self.test_second);
    }
}

// Testing trait bounds
trait TestProcessor<T> {
    fn test_process(&self, item: T) -> T;
}

fn test_process_items<T, P>(processor: P, items: Vec<T>) -> Vec<T>
where
    P: TestProcessor<T> + Clone,
    T: Clone + std::fmt::Debug + 'static,
{
    items.into_iter()
         .map(|item| processor.test_process(item))
         .collect()
}
`
