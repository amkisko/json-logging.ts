# RFC 0001: RFC process for this package

- Type: Procedural
- Status: Stable
- Created: 2026-10-26
- Author: maintainers

## Summary

This package uses the house RFC shape: claim `rfcs/ids/NNNN`, write `rfcs/NNNN-slug.md` from the template, omit empty sections, and cite `RFC-NNNN` from implementation changes.

## Motivation

User-facing contracts (logger API, sinks, adapters, bench budgets) need a numbered design record before code grows past the thin-layer goal.

## Guide-level explanation

1. Read this README and claim a free id under `rfcs/ids/`.
2. Copy `rfcs/0000-template.md`, fill required headers and sections, omit unused ones.
3. Open a branch named `plan/...` or `feature/...` with title `rfc: NNNN short title`.
4. Mark Draft while authoring. Move to Experimental or Proposed when review starts. Stable when accepted. Implementation PRs cite `RFC-NNNN`.

## Reference-level explanation

- Types: Standards Track, Informational, Historical, Procedural.
- Statuses: Draft, Experimental, Proposed, Stable, Final, Deferred, Rejected, Superseded, Obsolete.
- Required headers: Type, Status, Created, Author. Title is the H1.
- Required sections: Summary, Motivation, Guide-level explanation, Unresolved questions.
- Product Standards Track RFCs also fill Reference-level explanation, Drawbacks, Rationale and alternatives, and Prior art.
- Prefer under 150 lines. Split when one file holds two concerns.
- Isolation is off for this tree (see `rfcs/README.md`).
- Version numbers belong in changelogs, not RFC titles.

## Unresolved questions

None for the process itself. Product bands beyond `0099` stay reserved until a later procedural RFC.
