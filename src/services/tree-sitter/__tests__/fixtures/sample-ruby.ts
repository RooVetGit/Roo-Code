export default String.raw`
# CLASS DEFINITION - testing class definitions
# This section tests the parser's ability to capture class definitions
# with inheritance, class variables, constants, and methods
class TestClassDefinition < ApplicationRecord
  # Class variable - testing class variables
  @@test_class_variable = 0
  
  # Constants - testing constant definitions
  TEST_CONSTANT_ONE = 'constant1'
  TEST_CONSTANT_TWO = 'constant2'
  
  # Class method - testing class methods
  def self.test_class_method
    @@test_class_variable
    puts "Class method called"
    return @@test_class_variable
  end
  
  # Instance variables and attribute accessors - testing attribute accessors
  attr_accessor :test_attr_accessor_prop
  attr_reader :test_attr_reader_prop
  attr_writer :test_attr_writer_prop
  
  # Constructor - testing instance methods and instance variables
  def initialize(name, email)
    @test_instance_var_name = name
    @test_instance_var_email = email
    @test_instance_var_created = Time.now
    @@test_class_variable += 1
  end
  
  # Instance method with string interpolation - testing string interpolation
  def test_string_interpolation
    puts "Name: #{@test_instance_var_name}, Email: #{@test_instance_var_email}"
    puts "Created at: #{@test_instance_var_created}"
    return "User info: #{@test_instance_var_name}"
  end
  
  # Method with keyword arguments - testing keyword arguments
  def test_keyword_args(name: nil, email: nil)
    @test_instance_var_name = name if name
    @test_instance_var_email = email if email
    puts "Updated user info"
    return true
  end
  
  # Private methods
  private
  
  def test_private_method
    SecureRandom.hex(10)
    puts "Generated token"
    return "token"
  end
end

# MODULE DEFINITION - testing module definitions
# This section tests the parser's ability to capture module definitions
# with constants, methods, and nested modules
module TestModule
  # Module constants
  TEST_MODULE_CONSTANT = '1.0.0'
  
  # Module method
  def self.test_module_method
    puts "Module method called"
    return true
  end
  
  # Nested module
  module TestNestedModule
    def self.test_nested_method(str, length = 10)
      str[0...length]
      puts "String truncated"
      return str[0...length]
    end
  end
end

# SINGLETON CLASS - testing singleton class
# This section tests the parser's ability to capture singleton classes
class TestSingletonClass
  # Singleton instance - testing class variables
  @@test_singleton_instance = nil
  
  # Private constructor
  private_class_method :new
  
  # Singleton accessor
  def self.instance
    @@test_singleton_instance ||= new
    return @@test_singleton_instance
  end
  
  # Instance method
  def test_singleton_method(message)
    puts "[LOG] #{message}"
    return true
  end
end

# MIXIN MODULE - testing mixins
# This section tests the parser's ability to capture mixins
module TestMixinModule
  def test_mixin_method(message)
    puts "[#{self.class}] #{message}"
    return true
  end
end

# INCLUDE MIXIN - testing include
# This section tests the parser's ability to capture include statements
class TestIncludeClass
  include TestMixinModule
  
  def initialize(name)
    @test_include_var = name
    test_mixin_method("Include test #{name}")
  end
end

# EXTEND MIXIN - testing extend
# This section tests the parser's ability to capture extend statements
class TestExtendClass
  extend TestMixinModule
  
  def self.test_extend_method
    test_mixin_method("Extend test")
    return true
  end
end

# PREPEND MIXIN - testing prepend
# This section tests the parser's ability to capture prepend statements
class TestPrependClass
  prepend TestMixinModule
  
  def test_mixin_method(message)
    puts "Original method: #{message}"
    return false
  end
end

# BLOCKS - testing blocks
# This section tests the parser's ability to capture blocks
def test_block_method(data)
  yield(data) if block_given?
  puts "Block executed"
  return data
end

# Lambda expression - testing lambda
test_lambda = ->(x, y) {
  result = x * y
  puts "Lambda result: #{result}"
  return result
}

# Proc object - testing proc
test_proc = Proc.new do |x|
  puts x
  puts "Proc executed"
  return x
end

# SPLAT OPERATOR - testing splat
# This section tests the parser's ability to capture splat operators
def test_splat_method(*numbers)
  sum = numbers.sum
  puts "Sum: #{sum}"
  return sum
end

# HASH SYNTAX - testing hash syntax
# This section tests the parser's ability to capture different hash syntaxes
test_hash = {
  test_symbol_key: '12345',
  'test_string_key' => 'api.example.com',
  :test_old_symbol_key => 443
}

# STRING INTERPOLATION - testing string interpolation
# This section tests the parser's ability to capture string interpolation
test_string_var = "world"
test_string_interpolation = "Hello, #{test_string_var}!"
puts test_string_interpolation
puts "Another #{test_string_var} example"

# REGULAR EXPRESSION - testing regex
# This section tests the parser's ability to capture regular expressions
test_regex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$/
test_email = "test@example.com"
if test_email =~ test_regex
  puts "Valid email"
end

# EXCEPTION HANDLING - testing begin/rescue/ensure
# This section tests the parser's ability to capture exception handling
begin
  # Some code that might raise an exception
  test_exception_result = 10 / 0
rescue ZeroDivisionError => e
  puts "Error: #{e.message}"
ensure
  puts "This always runs"
end

# ATTRIBUTE ACCESSORS - testing attribute accessors
# This section tests the parser's ability to capture attribute accessors
class TestAttributeAccessorsClass
  attr_reader :test_attr_reader
  attr_writer :test_attr_writer
  attr_accessor :test_attr_accessor
  
  def initialize(title, content)
    @test_attr_reader = title
    @test_attr_writer = content
    @test_attr_accessor = false
  end
end

# KEYWORD ARGUMENTS - testing keyword arguments
# This section tests the parser's ability to capture keyword arguments
def test_keyword_args_method(host:, port: 80, protocol: 'http')
  url = "#{protocol}://#{host}:#{port}"
  puts "URL: #{url}"
  return url
end

# CLASS MACROS - testing class macros
# This section tests the parser's ability to capture Rails-like class macros
class TestClassMacroClass < ApplicationRecord
  belongs_to :test_belongs_to
  has_many :test_has_many
  validates :test_validates, presence: true
  scope :test_scope, -> { where(active: true) }
end

# METAPROGRAMMING - testing metaprogramming
# This section tests the parser's ability to capture metaprogramming constructs
class TestMetaprogrammingClass
  [:test_meta_save, :test_meta_update, :test_meta_delete].each do |method_name|
    define_method(method_name) do |*args|
      puts "Called #{method_name} with #{args.inspect}"
      return true
    end
  end
  
  def method_missing(method_name, *args, &block)
    puts "Called undefined method #{method_name}"
    return nil
  end
end

# PATTERN MATCHING - testing pattern matching
# This section tests the parser's ability to capture Ruby 2.7+ pattern matching
test_pattern_data = {name: "TestPatternName", age: 25}
case test_pattern_data
in {name: "TestPatternName", age: age} if age > 18
  puts "Adult TestPatternName"
  result = "adult"
in {name: "TestPatternName2", age: age}
  puts "TestPatternName2 is #{age}"
  result = "other"
else
  puts "Unknown pattern"
  result = "unknown"
end

# ENDLESS METHOD - testing endless methods
# This section tests the parser's ability to capture Ruby 3.0+ endless methods
def test_endless_method(x) = x * x

# PIN OPERATOR - testing pin operator
# This section tests the parser's ability to capture Ruby 3.1+ pin operator
test_pin_pattern = 42
case test_pin_input
in ^test_pin_pattern
  puts "Matches 42"
  result = "match"
else
  puts "No match"
  result = "no_match"
end

# SHORTHAND HASH - testing shorthand hash
# This section tests the parser's ability to capture Ruby 3.1+ shorthand hash syntax
def test_shorthand_hash(user:)
  {user:}
end`
