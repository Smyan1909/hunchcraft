# Engineering practices and sources

Researched on 2026-10-11. Prefer current primary documentation and installed package
types over remembered APIs. The decisions below tailor those sources to Hunchcraft.

| Source                                                                                                                                                  | Applied practice                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [TypeScript library compiler guidance](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html#im-writing-a-library) | Strict Node-compatible ESM, `.js` relative specifiers, declaration output, separate `dist/`, and source/declaration maps with shipped source |
| [typescript-eslint typed linting](https://typescript-eslint.io/getting-started/typed-linting/)                                                          | Recommended type-aware rules using project service, plus explicit handling of promises                                                       |
| [npm package manifest](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)                                                                     | Explicit exports and files allowlist; runtime/dev dependencies separated; host peers chosen only when adapters exist                         |
| [Dependency-cruiser rules](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)                                             | Automated layer isolation, dependency direction, unresolved import and cycle detection                                                       |
| [Vitest configuration](https://vitest.dev/config/)                                                                                                      | Explicit Node test environment and test discovery; meaningful offline tests before adding live integrations                                  |
| [OpenCode plugins](https://opencode.ai/docs/plugins/)                                                                                                   | Thin typed hooks, explicit startup/lifecycle, host-specific code isolated in adapters                                                        |
| [Agent Skills specification](https://agentskills.io/specification)                                                                                      | Focused skills with descriptive triggers, matching lowercase names, and on-demand documentation                                              |
| [TypeSafe skill](../.agents/skills/typesafe-ai/SKILL.md) and [coding-agent guidance](https://docs.typesafe.ai/introduction/coding-agents.md)            | Jev supplies typed decisions; application code owns the workflow                                                                             |
| [TypeSafe speculative fan-out](https://docs.typesafe.ai/patterns/fan-out.md)                                                                            | Batch independent and explicitly speculative questions, consume applicable branches, measure actual cost and latency                         |
| [TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript.md)                                                                                   | Keep SDK-specific contracts at the provider boundary; consult the live SDK reference before implementing                                     |

## Tool compatibility

At setup, npm reports TypeScript 7.0.2 as latest, while typescript-eslint 8.71.1
declares TypeScript `>=4.8.4 <6.1.0`. Hunchcraft therefore pins TypeScript 6.0.3.
Vitest 5.0.3 requires Node 22.12+, 24+, or 26+; dependency-cruiser 18.5.0 supports
the 22/24/26 release lines. Locked ESLint and the `watskeburt` dependency require
22.13.0 on the Node 22 line. Development therefore uses Node 22.13+ on 22.x or
Node 24.x; Node 26+ is permitted by the tooling's declared engines but is not a CI
target. The package's separate runtime floor remains 22.12.0. CI targets the latest
Node 22 and 24 releases on Linux and Windows, not the exact development minimum.
Review these constraints together when upgrading rather than upgrading one tool
in isolation. Exact dev versions and the npm lockfile make installs reproducible.

## Keeping this sustainable

Start with one package and real use-case boundaries. Keep third-party adapters
independent and inject them at explicit composition points. Document layer intent
where code lives, retain a short root `AGENTS.md`, and use skills for deeper workflows.
Add interfaces, dependencies, release machinery, and abstraction only when a
concrete capability needs them. Keep research claims and measured outcomes distinct.
