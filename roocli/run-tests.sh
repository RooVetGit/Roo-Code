#!/bin/bash

# RooCLI Test Script
# This script executes basic tests for the updated roocli interface

echo "===== RooCLI Test Script ====="
echo "This script will test the updated roocli interface"
echo "Make sure the RooCode extension is running with the WebSocket server enabled"
echo "Press Enter to continue or Ctrl+C to cancel"
read

npm run build

# Function to display section headers
section() {
  echo -e "\n\033[1;36m===== $1 =====\033[0m"
}

# Function to display test case headers
test_case() {
  echo -e "\n\033[1;33m--- Test Case: $1 ---\033[0m"
}

# Function to display commands being executed
run_command() {
  echo -e "\033[1;32m$ $1\033[0m"
  eval "$1"
  echo -e "\033[1;32mCommand completed with exit code: $?\033[0m"
}

# section "1. Testing the 'set' Command with --json Flag"

# test_case "1.1: Set Configuration with Valid JSON"
# run_command 'roo set config --json '"'"'{"apiProvider": "openai", "openAiModelId": "gpt-4", "openAiApiKey": "sk-test-key"}'"'"''

# test_case "1.2: Set Configuration with Invalid JSON (Expected to fail)"
# run_command 'roo set config --json '"'"'{"apiProvider": "openai", "openAiModelId": "gpt-4", openAiApiKey: "sk-test-key"}'"'"''

# test_case "1.3: Set Configuration with Missing Required Option (Expected to fail)"
# run_command 'roo set config'

# section "2. Testing the Improved 'roo list configs' Display"

# test_case "2.1: List Configurations in Concise View"
# run_command 'roo list configs'

# test_case "2.2: List Configurations in Verbose View"
# run_command 'roo list configs --verbose'

# echo -e "\nTest Case 2.3: List Configurations in Expandable View"
# echo "This test requires user interaction. Do you want to run it? (y/n)"
# read response
# if [[ "$response" == "y" ]]; then
#   run_command 'roo list configs --expandable'
# else
#   echo "Skipping expandable view test"
# fi

section "3. Testing the Fixed Profile Commands"

test_case "3.1: Create Profile with Name and Config"
run_command 'npm start -- create profile --name "TestProfile" --config "default"'

test_case "3.2: Create Profile with Missing Required Option (Expected to fail)"
run_command 'npm start -- create profile --config "default"'

test_case "3.3: List All Profiles"
run_command 'npm start -- list profiles'

test_case "3.4: List Active Profile"
run_command 'npm start -- list profiles --active'

test_case "3.5: Set Profile as Active"
run_command 'npm start -- update profile --name "TestProfile" --active'

test_case "3.6: Update Profile Configuration"
run_command 'npm start -- update profile --name "TestProfile" --config "new-config"'

test_case "3.7: Delete Profile with Force Option"
run_command 'npm start -- delete profile --name "TestProfile" --force'

section "Test Execution Summary"
echo "All tests have been executed. Please review the output to verify the expected behavior."
echo "For detailed expected behavior, refer to the test-plan.md file."