# PostgreSQL Advisory Lock Registry

Advisory locks are application-global. To prevent collisions, register all
key pairs used in this codebase here.

| key1 | key2 | Owner | Purpose |
|------|------|-------|---------|
| 81   | 1    | `GecImportJob` | Serialize GEC voter list imports (full_list + changes_only) |

## Convention

- **key1** = subsystem ID (pick any unused integer)
- **key2** = operation discriminator within that subsystem

Before adding a new advisory lock, check this table and choose unused key values.
