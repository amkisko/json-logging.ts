# RFCs

Numbering and process for `@amkisko/json-logging`.

## Process

RFC-0001 defines how this tree claims ids, statuses, and isolation.

## Numbering bands

- `0001` through `0099`: process and package contract
- `0100` through `0199`: reserved for future product bands

Claim `rfcs/ids/NNNN` before writing `rfcs/NNNN-slug.md`. Keep existing numbers.

## Isolation

Off. RFCs MAY name repository paths a reviewer can open. Prefer another RFC for design cross-references.

## Index

| Id | Slug | Status | Title |
| --- | --- | --- | --- |
| 0001 | rfc-process | Stable | RFC process for this package |
| 0002 | hot-path-performance | Experimental | Hot-path performance, redact paths, serializers, benchmarks |
| 0003 | http-adapters | Experimental | Shared HTTP request context and framework subpath adapters |
| 0004 | context-provider-and-request-completion | Experimental | Context provider, request completion line, header allowlist |
| 0005 | redact-censor-and-context-storage | Experimental | Redact keys and censor modes, injectable ALS |
