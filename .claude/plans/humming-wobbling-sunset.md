# Plan: Fix Ghostty Tab Titles Not Auto-Naming

## Problem Summary

Ghostty terminal tabs all show "* Claude Code" instead of descriptive names (like directory or running command), making it difficult to manage 5+ tabs.

## Root Cause

1. **Line 5 of ~/.zshrc** has `DISABLE_AUTO_TITLE="true"` with comment "Let Claude Code manage terminal titles"
2. This disables Oh My Zsh's dynamic title-setting (which would show current directory/command)
3. Claude Code sets a static "Claude Code" title on startup and doesn't update it dynamically
4. **Result**: Static, useless tab titles

## Recommended Fix

**Re-enable Oh My Zsh's auto-title feature** by commenting out/removing the DISABLE_AUTO_TITLE setting.

### Why This Approach

- **Simplest fix**: One line change, immediate effect
- **Battle-tested**: Oh My Zsh's termsupport.zsh handles edge cases across many terminals
- **Instantly reversible**: If you don't like the result, uncomment the line
- **The original assumption is invalid**: You disabled auto-title expecting Claude Code to manage titles intelligently—it doesn't, it just sets a static string

## Implementation Steps

### 1. Edit ~/.zshrc

**File**: `/Users/karadaviduik/.zshrc`

**Change line 5 from**:
```bash
DISABLE_AUTO_TITLE="true"  # Let Claude Code manage terminal titles
```

**To**:
```bash
# DISABLE_AUTO_TITLE="true"  # Let Claude Code manage terminal titles
```

### 2. Apply the Change

Run in your terminal:
```bash
source ~/.zshrc
```

### 3. Implementation Review Gate (BLOCKING)

**INSTRUCTION FOR EXECUTING AGENT**: This is a BLOCKING gate. Before proceeding to verification, invoke the following agents for review using the Task tool. Do not proceed until all agents approve.

**Agents to Invoke**:

| Agent | Full Name (use this) | Approval Criteria | Status |
|-------|---------------------|-------------------|--------|
| Kara | `kara-product-strategist` | UX impact assessment, risk evaluation | [x] Approved |
| Gray | `gray-verification-guardian` | Verify the fix works as claimed | [x] Approved |

**Re-approval Rule**: If ANY agent requests changes, make the changes, then re-invoke ALL agents above. All must approve the SAME final version.

**Review Summary**:

| Agent | Verdict | Summary |
|-------|---------|---------|
| Kara | ✅ APPROVE | Minimal-risk fix, correct diagnosis, reversible, leverages mature Oh My Zsh infrastructure |
| Gray | ✅ VERIFIED/APPROVE | Root cause confirmed, fix mechanism validated, terminal pattern matching verified |

**Completion**: This step is complete when ALL agents show approved status above.

### 4. Verify the Fix

After applying the change:
1. Open a new Ghostty tab
2. Navigate to different directories - tab title should update
3. Run a command - tab title should show the command while running
4. Open Claude Code in the tab - observe what title is shown

## Expected Outcome

Tab titles will show dynamic information like:
- `~/src/myproject` (current directory)
- `vim file.ts` (running command)
- Or whatever Oh My Zsh's termsupport.zsh generates

## Optional Follow-up

Consider filing a GitHub issue at https://github.com/anthropics/claude-code/issues suggesting that Claude Code should set more descriptive terminal titles (like "Claude Code: projectname" or the current working directory) rather than a static "Claude Code" string. This would help users who prefer Claude Code to manage titles.

## Files Modified

- `/Users/karadaviduik/.zshrc` (line 5 - comment out DISABLE_AUTO_TITLE)

## Rollback

If you don't like the result, uncomment line 5 in ~/.zshrc and run `source ~/.zshrc`.
