# 05 - Decision sitting: account direction + consolidation, together

**Status:** ready-for-human
**Type:** grilling
**Map:** ../map.md
Blocked by: 03, 04

## Question

HITL - this is Ed's ticket; an agent facilitates, never answers for him.
Invoke /grilling and /domain-modeling. With both options papers on the table
(tickets 03 and 04), Ed decides in one sitting:

- **Account layer:** which option, where the account UI lives, what the
  smallest first slice is, and whether the COPPA/GDPR-K flag gates the first
  slice or only later ones.
- **Infra:** status quo, full consolidation, or middle ground - chosen with
  the account-layer answer in hand, since a central identity/save service
  changes what the machines need to host.

The source tickets said it plainly: these pull on the same architecture and
must be decided together. Record both decisions here, echo them to
`.scratch/account-layer/issues/01` and `.scratch/infra-cost/issues/01`, and
graduate the map's fog (first-slice spec, migration plan, consolidation
execution plan) into fresh tickets as the decisions allow.
