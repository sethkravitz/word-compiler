---
title: gh pr create defaults to upstream repo in forks
date: 2026-04-11
category: workflow-issues
module: git-workflow
problem_type: workflow_issue
component: tooling
severity: high
applies_when:
  - Working in a forked repository
  - Using gh CLI to create pull requests
  - origin points to your fork but upstream exists
tags: [gh-cli, fork, pull-request, upstream, git-remote]
---

# gh pr create defaults to upstream repo in forks

## Context

When a repository is forked, `gh pr create` defaults to creating the PR against the **upstream** (parent) repository, not the fork's origin. This happens even when `git remote set-url --push upstream no_push` is configured, because `gh` uses GitHub's fork relationship metadata, not git remote push URLs.

In this project, `origin` = `sethkravitz/word-compiler` (fork) and `upstream` = `2389-research/word-compiler` (parent). Running `gh pr create` without `--repo` created PR #60 on the upstream repo instead of the fork.

## Guidance

Apply three layers of protection to prevent accidental upstream PRs:

### Layer 1: Disable upstream push (already standard)
```bash
git remote set-url --push upstream no_push
```
Blocks `git push upstream` but does NOT affect `gh pr create`.

### Layer 2: Set gh CLI default repo
```bash
gh repo set-default sethkravitz/word-compiler
```
Creates `.gh-resolution` in the repo root. All `gh` commands (including `gh pr create`) now default to the fork. This is the layer that prevents the actual mistake.

### Layer 3: Pre-push hook
```bash
# .husky/pre-push
#!/bin/sh
remote="$1"
url="$2"
if echo "$url" | grep -q "2389-research"; then
  echo "BLOCKED: Push to upstream (2389-research) is not allowed."
  exit 1
fi
```
Belt-and-suspenders: blocks any push to URLs containing the upstream org name.

## Why This Matters

Creating PRs on the upstream repo is visible to the upstream maintainers, clutters their PR list, and may expose work-in-progress changes. The PR must be manually closed with an explanation, which is embarrassing and wastes time.

The root cause is a design decision in `gh` CLI: fork metadata from GitHub's API takes precedence over local git remote configuration. No amount of git-level blocking prevents `gh` from targeting upstream.

## When to Apply

- After cloning or forking any repository where you should NOT create upstream PRs
- When setting up a new development environment on a forked repo
- Run `gh repo set-default` immediately after the first `git clone` of a fork

## Examples

**Before (dangerous):**
```bash
gh pr create --title "my feature"
# Creates PR on 2389-research/word-compiler (upstream!)
```

**After (safe):**
```bash
gh repo set-default sethkravitz/word-compiler  # one-time setup
gh pr create --title "my feature"
# Creates PR on sethkravitz/word-compiler (fork) 
```

**Explicit override (always safe):**
```bash
gh pr create --repo sethkravitz/word-compiler --title "my feature"
```

## Related

- Memory: `feedback_fork_remote.md` — "Never push/PR to upstream; origin = sethkravitz/word-compiler"
- `.gh-resolution` file created by `gh repo set-default`
- `.husky/pre-push` hook for git-level blocking
