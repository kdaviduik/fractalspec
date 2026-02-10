# sc - Spec Management CLI

CLI tool for managing hierarchical specifications with EARS (Easy Approach to Requirements Syntax) requirements.

`sc` enables recursive spec decomposition where large features break down into smaller, manageable specs. Each spec can have child specs (tree hierarchy) and dependencies (blocking relationships).

## Quick Start

```bash
# Install dependencies
bun install

# Build the CLI
bun run build

# Link for global usage
bun link

# Create your first spec
sc create -t "My First Spec"

# Create spec with specific status (optional)
sc create -s blocked -t "Future Feature"

# View all specs
sc list

# Find work to do
sc list --ready

# Set up shell integration (auto-cd on claim)
eval "$(sc init bash)"  # or zsh/fish

# Claim and start working (sets status to in_progress)
sc claim <spec-id>
```

## Key Features

- **Hierarchical specs** - Parent/child relationships for decomposition
- **Dependency tracking** - Specs can block other specs
- **EARS validation** - Structured requirement syntax ensures testable, unambiguous requirements
- **Git-integrated workflow** - Status-only by default, branch/worktree opt-in
- **Status tracking** - Multiple status states including ready, in_progress, closed, and more (see CLAUDE.md)

## Documentation

See [CLAUDE.md](./CLAUDE.md) for comprehensive documentation including:
- Complete command reference
- EARS pattern templates and validation
- Agent workflow guidance
- Development standards

## Development

```bash
# Run tests
bun run test

# Lint
bun run lint

# Type check
bun run typecheck
```

## Help

```bash
# Get help on any command
sc <command> --help

# View EARS pattern reference
sc ears

# Check repository health
sc doctor
```
