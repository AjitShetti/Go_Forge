# Design canvas (P5)

`/canvas` lists your saved designs. `/canvas/new` opens an empty canvas. `/canvas/<key>` opens the latest version, and `?v=N` opens an older one. `/canvas/<key>/diff?from=A&to=B` compares two versions.

Scenarios and grading shipped in P6; see [grading.md](grading.md). The LLM critique comes in P8.

## Building a design

- **Add** a component by dragging it from the palette onto the canvas, or by clicking it. Clicking drops it in the middle of the view, which is how you add things on a phone.
- **Connect** two components by dragging from the small square on any side of one to any side of the other. New connections use the kind picked under "New connections" (shown when nothing is selected). A connection from a node to itself is refused, and so is an exact duplicate (same source, target and kind). Two connections of different kinds between the same pair are allowed, and they are drawn side by side.
- **Edit** by selecting. A component's inspector shows only the fields that kind has. A connection's inspector changes its kind and label, reverses it, or deletes it. Delete or Backspace removes whatever is selected. Deleting a component also deletes its connections.
- **Save** with the button or Ctrl+S.

## Vocabulary

15 node kinds and 5 edge kinds are listed in `src/lib/canvas/catalog.ts`. The P6 grader will read the same config, so each field has one meaning:

| Field | Meaning | Unit |
|---|---|---|
| `replicas` | identical instances behind the node | count, 1–1000 |
| `qpsIn` | requests (or messages, or jobs) **one replica** can accept | rps |
| `qpsOut` | requests the node sends downstream at its expected load | rps |
| `p99Ms` | 99th percentile latency the node adds | ms |
| `storageGb` | data held | GB |
| `consistency` | `strong` or `eventual` | |
| `persistence` | the data survives a process restart | bool |
| `role` | SQL DB only: `primary` or `replica` | |
| `region` | one of 8 fixed regions, or `global` | |

A node's capacity is `replicas × qpsIn`. The inspector shows this arithmetic.

The five edge kinds are sync request, async event, replication, cache read-through and batch/ETL. Each one differs from the others in dash pattern, stroke weight and colour, and its short name is printed on the line. That keeps them readable in greyscale.

## Storage and versions

- Every save inserts a new, immutable row in `designs`. Older versions are never overwritten. RLS has no update policy.
- **Conflicts.** The editor remembers which version it built on. If a newer version exists (another tab saved), the save is refused and says which version got in first. You then choose "Save mine anyway", which creates the next version, or open the newer one. Opening an old version with `?v=` and saving builds a new latest version from it. A banner says so.
- **Validation.** `parseGraph` is the only way into and out of storage. It checks imports, server action input, and every row read back. It rejects wrong types, unknown kinds, fields a kind doesn't have, dangling or duplicate edges, and anything over 200 nodes or 600 edges. Missing config fields are filled with the kind's defaults. A stored row that fails validation shows its errors instead of a half-drawn canvas.
- **Database backstops** (migration `20260915000300_design_versions.sql`): the graph must be a JSON object under 1 MiB, and the name must be 1–120 characters.
- **Schema fix.** The init migration made `(design_key, version)` unique across all users. Anyone could insert their own row under someone else's design key, and that person's next save would then fail on a row RLS hides from them. Uniqueness is now `(user_id, design_key, version)`. `tests/db/designs.test.ts` covers this case.

## Export and import

Export downloads `go-forge/design-export@1` JSON: name, version (null when there are unsaved changes), export time, and the canonical graph. Import accepts that format or a bare graph. A bad file lists its problems and leaves the canvas untouched. An imported design replaces what's on the canvas. On a saved design, the next save turns it into a new version.

## Diff

A diff matches nodes and edges by id and lists:

- components and connections added or removed
- field changes, with before → after
- connection kind and label changes

A connection pointed at a different node counts as removed plus added. A component that only moved is counted on its own line, because moving doesn't change the architecture. The canvas draws version B and marks each item as added (green), changed (amber) or moved. Items removed since A are drawn as dashed red ghosts where they used to be.

## Verification

```
npx tsc --noEmit && npm test && npm run build
# run supabase/e2e-reset.sql first (it now also clears the e2e user's designs)
npm run verify:p5
```

`verify:p5` runs 65 checks in headless Edge against `next start`:

- **Signed out:** click-add, drag-and-drop, mouse-drawn connections, duplicate refusal, edge and node inspectors, invalid-value handling, the SQL role toggle, keyboard delete, export → re-import round trip, bad-import refusal, and all 15 node kinds and 5 edge looks rendering.
- **Signed in against live Supabase:**
  - save v1 and check the stored row
  - reload and get an identical graph
  - edit and Ctrl+S to save v2
  - history, and the diff in both directions, including edge ghosts
  - a two-tab conflict refused, then forced to v4, with all versions kept
  - anon can't read designs, and the database refuses a non-object graph
  - 404s for bad keys and versions
  - list and delete
  - no sideways scroll at 390 px

Screenshots: `docs/evidence/screens/p5-*.png`.

## Known limits

- **Edges are straight lines between node centres.** A connection between two nodes that has a third node in line between them passes underneath it, and two connections along the same line overlap. You can still select a hidden connection by moving a node. There is no edge routing.
- **Unsaved-work warning is browser-level only.** The browser asks before a reload, tab close or typed URL. In-app links, such as the header nav, leave without asking.
- **No undo/redo.**
- **Design names are per version.** Renaming is a change like any other and is saved as a new version.
