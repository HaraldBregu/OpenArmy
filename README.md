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

### Install a plugin
```bash
oa add <package-name>
```

Example:
```bash
oa add oa-translate
```

### List installed plugins
```bash
oa list
```

### Run a plugin
```bash
oa run <package-name> --input="<value>"
```

Example:
```bash
oa run oa-translate --input="Hello"
```

### Remove a plugin
```bash
oa remove <package-name>
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
