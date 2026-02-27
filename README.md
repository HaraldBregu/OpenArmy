# OpenArmy (oa)

A CLI tool manager for installing and running oa-compatible npm plugins.

## Installation

### Using npm (recommended)
```bash
npm install -g openarmy
```

### Using curl (Linux/macOS)
```bash
curl -fsSL https://raw.githubusercontent.com/openarmy/openarmy/main/scripts/install.sh | bash
```

### Using PowerShell (Windows)
```powershell
iex "& { $(iwr -useb https://raw.githubusercontent.com/openarmy/openarmy/main/scripts/install.ps1) }"
```

## Usage

### Initialize with default agents (recommended)
```bash
oa init
```

This installs default agents that come with OpenArmy:
- **oa-transform**: Transform text (uppercase, lowercase, capitalize, reverse, title case)
- **oa-count**: Count characters, words, and lines
- **oa-base64**: Encode/decode base64 text
- **oa-json**: Format, minify, or validate JSON

### List installed plugins
```bash
oa list
```

### Run a plugin/agent
```bash
oa run <package-name> --input="<value>"
```

Examples:
```bash
# Transform text
oa run oa-transform --input="hello world" --mode=upper

# Count metrics
oa run oa-count --input="Hello World" --metric=words

# Encode to base64
oa run oa-base64 --input="Hello" --mode=encode

# Format JSON
echo '{"name":"test"}' | oa run oa-json --mode=format
```

### Install a custom plugin
```bash
oa add <package-name>
```

Example:
```bash
oa add oa-translate
```

### Remove a plugin
```bash
oa remove <package-name>
```

## Default Agents

OpenArmy comes with 4 built-in agents installed via `oa init`:

### oa-transform
Text transformation utility with multiple modes:
- `uppercase` or `upper` - Convert to uppercase
- `lowercase` or `lower` - Convert to lowercase
- `capitalize` - Capitalize first letter
- `reverse` - Reverse the string
- `title` - Title case

```bash
oa run oa-transform --input="hello" --mode=upper
# Output: HELLO
```

### oa-count
Count text metrics:
- `chars` or `characters` - Character count
- `words` - Word count
- `lines` - Line count
- `all` or `json` - All metrics as JSON

```bash
oa run oa-count --input="Hello World" --metric=words
# Output: 2
```

### oa-base64
Base64 encoding and decoding:
- `encode` - Encode to base64 (default)
- `decode` - Decode from base64

```bash
oa run oa-base64 --input="Hello" --mode=encode
# Output: SGVsbG8=
```

### oa-json
JSON formatting and validation:
- `format` or `pretty` - Pretty-print JSON (default)
- `minify` or `compact` - Minify JSON
- `validate` - Validate JSON syntax

```bash
echo '{"name":"test","value":123}' | oa run oa-json --mode=minify
# Output: {"name":"test","value":123}
```

## Creating an oa Plugin

An oa plugin is a standard npm package with an `oa` field in its `package.json`:

```json
{
  "name": "oa-example",
  "version": "1.0.0",
  "bin": { "oa-example": "./bin/cli.js" },
  "oa": {
    "description": "A short description shown in oa list",
    "inputMapping": {
      "type": "flag",
      "flag": "--input"
    }
  }
}
```

### Input Mapping Types

#### Flag-based (type: "flag")
Input is passed as a CLI flag:
```json
"inputMapping": {
  "type": "flag",
  "flag": "--input"
}
```

Command: `oa run oa-example --input="hello"`
Executes: `oa-example --input=hello`

#### Positional (type: "positional")
Input is passed as a positional argument:
```json
"inputMapping": {
  "type": "positional",
  "position": 0
}
```

Command: `oa run oa-example --input="hello"`
Executes: `oa-example hello`

#### Stdin (type: "stdin")
Input is piped to stdin:
```json
"inputMapping": {
  "type": "stdin"
}
```

Command: `oa run oa-example --input="hello"`
Executes: `oa-example` with stdin: `hello`

## Project Structure

```
src/
├── index.ts              # CLI entrypoint
├── types.ts              # TypeScript types
├── constants.ts          # Constants (OA_HOME, etc.)
├── commands/             # CLI commands
├── core/                 # Core logic (registry, installer, runner)
└── utils/                # Utilities (fs, npm, logger)
```

## Development

### Install dependencies
```bash
npm install
```

### Build
```bash
npm run build
```

### Watch mode
```bash
npm run build:watch
```

### Run tests
```bash
npm test
```

### Run smoke tests
```bash
npm run test:smoke
```

### Type check
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

## Publishing

```bash
npm login
npm run build
npm publish --access public
```

## License

MIT
