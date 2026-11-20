# Gongzuo catalog for Headless extensions

## Decision and scope

Gongzuo remains the interface and source of truth for native team creation, roles, members, group administrators, Goals and tasks. An optional Headless extension may read a narrow catalog to bind its own workflow records to those native identities. It does not create another team, Goal or task database and does not receive a general Bot channel proxy through this method.

This change adds `dsBot.gongzuoCatalog(request, signal)` as an independently registered Typert Remote method. It uses the existing Gateway authentication and service lifecycle. It does not add a public HTTP route or a new frontend. The method never calls `channelCall`, `load`, `refresh`, bootstrap, Session creation or `save`; ordinary `dsBot.call` behavior is unchanged.

## Deployment identity

The service captures two operator-provided values when it is constructed:

- `GONGZUO_SOURCE_INSTANCE_ID`: a stable, unique identity for this Profile. It is 8–128 ASCII letters, numbers, dots, underscores, colons or hyphens and starts with a letter or number. A cloned test Profile must use a distinct value.
- `GONGZUO_FORK_SOURCE_SHA`: the 40-character lowercase hexadecimal commit of the installed Fork artifact. Release tooling must bind this value to the actual packed artifact. This method validates the format; it does not independently attest the operator's value.

The read path never invents or persists either value. Missing or invalid values return `catalog/not-configured`. No current runtime metadata with the same stable Profile and artifact identity contract is assumed.

## Protocol version 1

Call `dsBot.gongzuoCatalog({ protocol: 'gongzuo-catalog', version: 1 }, signal)`. Omitted or null requests and an empty object are accepted as a version 1 probe; an explicit incompatible protocol/version or malformed request is refused. The result has the existing envelope shape, `{ ok: true, value }` or `{ ok: false, error: { code, message, details: {} } }`.

The successful value contains:

| Field | Meaning |
| --- | --- |
| `protocol`, `version`, `source` | `gongzuo-catalog`, `1`, `gongzuo-fork` |
| `sourceInstanceId`, `sourceCommit` | Captured deployment identity |
| `revision` | Native `state.revision`, a nonnegative safe integer |
| `readOnlyReason` | `null` only when current authority is verified; otherwise a generic, non-sensitive explanation |
| `canDispatchWorkflows` | A strict boolean for the observed snapshot; never inferred from a missing reason |
| `teams` | Detached, whitelisted native team projections |

Each team contains `teamId`, `roomId`, `name`, `blueprint`, `memberIds`, `adminId`, `goal` and `roomTasks`: Entity IDs are at most 128 ASCII characters so every projected identity can be represented by a workflow binding.

- Both `teamId` and `roomId` are `room.id`, not `room.sessionId`, display name, template operation ID or a Bridge-created identity. A conversation part changing does not change the team identity.
- `blueprint` is the native string (`software`, `research` or `content`). `memberIds` comes from current `room.members`, not the creation-time `room.team.members` list. `adminId` is `room.admin` and must name a current member; it grants no Main Bot role or extra permission.
- `goal` is `null` when no Goal exists. Otherwise it contains native `id`, bounded `title`, native `status`, native integer `revision`, and `stages: [{ id, tasks: [{ id, botId, title, status }] }]`. Goal task title comes from `task.task`; Goal task IDs are scoped to that Goal. `updatedAt` is never substituted for `revision`.
- `roomTasks` projects the separate `room.tasks` dictionary to `[{ id, botId, title, status }]`; its title comes from `task.goal`. These tasks have no invented Goal ownership. Consumers must keep Goal task and Room task identities separate.

Only visible, complete native team rooms with at least two distinct current members, a current administrator and existing non-private members are candidates. A hidden/private/incomplete room, missing or private member, malformed blueprint, duplicate ID, malformed Goal revision or task owner, or inconsistent Room task key makes the entire team ineligible. No missing identity or relationship is repaired by a catalog read. Unknown root state shapes/revisions produce `catalog/invalid-state`.

The projection does not expose instructions, permissions, work directories, Session IDs, model routes, credentials, raw state, logs, request records or transcript text. Names and task summaries are bounded and control characters removed. Native terminal statuses are preserved rather than reported as launchable work.

## Authority observation and read effects

`store.observeCatalogAccess()` is a read-only observation. It requires an already loaded, non-stopped store, no cached read-only or broken-lock state, no adoption or pending save, a successfully persisted matching revision and serialized in-memory content digest, ownership of the current lock token, and an unchanged persisted file stamp and SHA-256 content digest. Ownership and the file stamp are checked again around the content read. The digest catches same-size external edits whose timestamps appear unchanged. Failed writes leave workflow dispatch disabled until a later successful save. No lock is acquired, renewed, reclaimed or released by this observer; it never adopts or repairs a file.

An unloaded or stopped store returns `catalog/not-ready` without calling initialization. A loaded but uncertain/read-only snapshot may still be inspected, but the successful response has `canDispatchWorkflows: false`. Detailed local file paths or store errors are not copied into the DTO. An aborted request returns `catalog/cancelled`.

This is a point-in-time observation, not a lease, an authorization to run arbitrary commands, or an atomic transaction spanning two systems. The extension must pin the expected source instance/commit, re-read immediately before each workflow mutation, require a compatible protocol and `canDispatchWorkflows === true`, and revalidate native team/Goal/task identity and Goal revision. It must independently enforce its own command, workspace and authorization rules. No successful read itself dispatches work or changes native Goal status.

## Verification and release boundary

Focused tests cover the pure DTO, no calls into mutable runtime paths, missing source identity, protocol refusals, detached output, hidden/incomplete/ambiguous candidates, real Gateway registration/disposal, missing/lost/replaced locks, unchanged metadata with changed file content, pending writes, unsaved in-memory changes at the same revision, and failed-save recovery. Existing Store and Remote regression tests run alongside them. Use the repository's pinned DSH harness; `DSH_HARNESS` may point at an already installed harness for read-only dependency resolution.

From `ds-bot/`:

```sh
node --import ./test/harness-resolve.mjs --test --test-timeout=120000 --test-force-exit test/gongzuo-catalog.test.js test/store.test.js test/remote.test.js
npm run build
npm test
node scripts/build-client.mjs --check
node scripts/build-link.mjs --check
npm run lint
```

A packed-artifact Host smoke and Bridge integration must use a fresh `.dsh-test-*` Profile, distinct loopback ports and source identity, synthetic data, and the mock model. No production Profile is needed for these gates. A new DSH/Fork/Bridge/Dagu version combination requires its own evidence; historical official DS-Bot or DSH rc.5 results do not establish this Fork's rc.1 compatibility.

This protocol adds no Bridge UI, no workflow execution endpoint, no production migration and no automatic startup against copied production data. Production release remains gated on the actual artifact identity and isolated integration evidence.
