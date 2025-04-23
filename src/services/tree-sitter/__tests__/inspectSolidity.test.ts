import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { solidityQuery } from "../queries"

const sampleSolidity = `
contract ExampleToken is ERC20, Ownable {
    string public constant name = "Example";
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    function transferWithCallback(
        address recipient,
        uint256 amount,
        bytes calldata data
    ) public payable returns (bool success) {
        require(recipient != address(0), "Invalid recipient");
        require(amount <= balanceOf(msg.sender), "Insufficient balance");
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    event TokenTransfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes data,
        uint256 timestamp
    );

    modifier onlyValidAmount(uint256 amount) {
        require(
            amount > 0 && amount <= _totalSupply,
            "Invalid amount specified"
        );
        require(
            _balances[msg.sender] >= amount,
            "Insufficient balance"
        );
        _;
    }

    struct TokenMetadata {
        string name;
        string symbol;
        uint8 decimals;
        address owner;
        bool isPaused;
        uint256 creationTime;
    }
}

library TokenUtils {
    function validateTransfer(
        address from,
        address to,
        uint256 amount
    ) internal pure returns (bool) {
        require(from != address(0), "Invalid sender");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        return true;
    }
}`

describe("inspectSolidity", () => {
	const testOptions = {
		language: "solidity",
		wasmFile: "tree-sitter-solidity.wasm",
		queryString: solidityQuery,
		extKey: "sol",
	}

	it("should inspect Solidity tree structure", async () => {
		await inspectTreeStructure(sampleSolidity, "solidity")
	})

	it("should parse Solidity definitions", async () => {
		await testParseSourceCodeDefinitions("test.sol", sampleSolidity, testOptions)
	})
})
