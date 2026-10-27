.PHONY: audit bench build bundle-size check ci clean coverage edge-import examples format-check lint lint-biome loc-check mutation node-smoke release test type-coverage typecheck

check: format-check lint typecheck type-coverage coverage mutation audit loc-check bundle-size examples edge-import node-smoke

ci: check build bench

install:
	bun install --frozen-lockfile

typecheck:
	bun run typecheck

type-coverage:
	bun run type-coverage

coverage:
	bun run test:coverage

test:
	bun test

build:
	bun run build

lint-biome:
	npx --yes @biomejs/biome@2.3.8 ci .

lint: lint-biome
	bun run typecheck
	find usr/bin -type f -perm -111 | while read file; do \
		if head -1 "$$file" | grep -Fq bash; then bash -n "$$file"; fi; \
		if head -1 "$$file" | grep -Fq ruby; then ruby -c "$$file" >/dev/null; fi; \
	done

format-check:
	./usr/bin/check-text

mutation:
	./usr/bin/mutation

audit:
	./usr/bin/audit-dependencies

loc-check:
	./usr/bin/check-loc

bundle-size:
	./usr/bin/check-bundle-size

bench:
	./usr/bin/bench

examples:
	./usr/bin/check-example

edge-import:
	./usr/bin/check-edge-import

node-smoke:
	./usr/bin/check-node-smoke

release:
	./usr/bin/release "$(VERSION)" $(if $(DRY_RUN),--dry-run)

clean:
	rm -rf dist coverage tmp build .turbo .cache
	rm -f /tmp/json-logging-bun-example.out
