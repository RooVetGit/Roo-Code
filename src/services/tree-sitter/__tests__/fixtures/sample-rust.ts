export default String.raw`
// Basic struct definition
struct Point {
    x: f64,
    y: f64,
}

// Struct with implementation (methods)
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    // Method definition
    fn area(&self) -> u32 {
        self.width * self.height
    }

    // Another method
    fn can_hold(&self, other: &Rectangle) -> bool {
        self.width > other.width && self.height > other.height
    }

    // Associated function (not a method, but still part of impl)
    fn square(size: u32) -> Rectangle {
        Rectangle {
            width: size,
            height: size,
        }
    }
}

// A standalone function
fn calculate_distance(p1: &Point, p2: &Point) -> f64 {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    (dx * dx + dy * dy).sqrt()
}

// A more complex struct
struct Vehicle {
    make: String,
    model: String,
    year: u32,
}

impl Vehicle {
    // Constructor-like method
    fn new(make: String, model: String, year: u32) -> Vehicle {
        Vehicle {
            make,
            model,
            year,
        }
    }

    // Regular method
    fn description(&self) -> String {
        format!("{} {} ({})", self.make, self.model, self.year)
    }
}

// Another standalone function
fn process_data(input: &str) -> String {
    format!("Processed: {}", input)
}

// More complex Rust structures for advanced testing
enum Status {
    Active,
    Inactive,
    Pending(String),
    Error { code: i32, message: String },
}

trait Drawable {
    fn draw(&self);
    fn get_dimensions(&self) -> (u32, u32);
}

impl Drawable for Rectangle {
    fn draw(&self) {
        println!("Drawing rectangle: {}x{}", self.width, self.height);
    }
    
    fn get_dimensions(&self) -> (u32, u32) {
        (self.width, self.height)
    }
}

// Generic struct with lifetime parameters
struct Container<'a, T> {
    data: &'a T,
    count: usize,
}

impl<'a, T> Container<'a, T> {
    fn new(data: &'a T) -> Container<'a, T> {
        Container {
            data,
            count: 1,
        }
    }
}

// Macro definition
macro_rules! say_hello {
    // Match a single name
    ($name:expr) => {
        println!("Hello, {}!", $name);
    };
    // Match multiple names
    ($($name:expr),*) => {
        $(
            println!("Hello, {}!", $name);
        )*
    };
}

// Module definition
mod math {
    // Constants
    pub const PI: f64 = 3.14159;
    
    // Static variables
    pub static VERSION: &str = "1.0.0";
    
    // Type alias
    pub type Number = f64;
    
    // Functions within modules
    pub fn add(a: Number, b: Number) -> Number {
        a + b
    }
    
    pub fn subtract(a: Number, b: Number) -> Number {
        a - b
    }
}

// Union type
union IntOrFloat {
    int_value: i32,
    float_value: f32,
}

// Trait with associated types
trait Iterator {
    // Associated type
    type Item;
    
    // Method using associated type
    fn next(&mut self) -> Option<Self::Item>;
    
    // Default implementation
    fn count(self) -> usize where Self: Sized {
        let mut count = 0;
        while let Some(_) = self.next() {
            count += 1;
        }
        count
    }
}

// Advanced Rust language features for testing

// 1. Closures: Multi-line anonymous functions with captured environments
fn use_closures() {
    let captured_value = 42;
    
    // Simple closure
    let simple_closure = || {
        println!("Captured value: {}", captured_value);
    };
    
    // Closure with parameters
    let add_closure = |a: i32, b: i32| -> i32 {
        let sum = a + b + captured_value;
        println!("Sum with captured value: {}", sum);
        sum
    };
    
    // Using closures
    simple_closure();
    let result = add_closure(10, 20);
}

// 2. Match Expressions: Complex pattern matching constructs
fn complex_matching(value: Option<Result<Vec<i32>, String>>) {
    match value {
        Some(Ok(vec)) if vec.len() > 5 => {
            println!("Got a vector with more than 5 elements");
            for item in vec {
                println!("Item: {}", item);
            }
        },
        Some(Ok(vec)) => {
            println!("Got a vector with {} elements", vec.len());
        },
        Some(Err(e)) => {
            println!("Got an error: {}", e);
        },
        None => {
            println!("Got nothing");
        }
    }
}

// 3. Where Clauses: Type constraints on generic parameters
fn print_sorted<T>(collection: &[T])
where
    T: std::fmt::Debug + Ord + Clone,
{
    let mut sorted = collection.to_vec();
    sorted.sort();
    println!("Sorted collection: {:?}", sorted);
}

// 4. Attribute Macros: Annotations that modify behavior
#[derive(Debug, Clone, PartialEq)]
struct AttributeExample {
    field1: String,
    field2: i32,
}

#[cfg(test)]
mod test_module {
    #[test]
    fn test_example() {
        assert_eq!(2 + 2, 4);
    }
}

// 5. Procedural Macros (simulated, as they require separate crates)
// This is a placeholder to represent a proc macro
// In real code, this would be in a separate crate with #[proc_macro]
fn custom_derive_macro() {
    // Implementation would generate code at compile time
}

// 6. Async Functions and Blocks: Asynchronous code constructs
async fn fetch_data(url: &str) -> Result<String, String> {
    // Simulated async operation
    println!("Fetching data from {}", url);
    
    // Async block
    let result = async {
        // Simulated async work
        Ok("Response data".to_string())
    }.await;
    
    result
}

// 7. Impl Blocks with Generic Parameters: Implementation with complex type parameters
struct GenericContainer<T, U> {
    first: T,
    second: U,
}

impl<T, U> GenericContainer<T, U>
where
    T: std::fmt::Display,
    U: std::fmt::Debug,
{
    fn new(first: T, second: U) -> Self {
        GenericContainer { first, second }
    }
    
    fn display(&self) {
        println!("First: {}, Second: {:?}", self.first, self.second);
    }
}

// 8. Complex Trait Bounds: Trait bounds using + operator or where clauses
trait Processor<T> {
    fn process(&self, item: T) -> T;
}

fn process_items<T, P>(processor: P, items: Vec<T>) -> Vec<T>
where
    P: Processor<T> + Clone,
    T: Clone + std::fmt::Debug + 'static,
{
    items.into_iter()
         .map(|item| processor.process(item))
         .collect()
}
`
