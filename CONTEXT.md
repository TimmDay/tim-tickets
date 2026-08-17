# tim-tickets

Personal issue tracker (Jira/Trello-style kanban board). Single-user, password-gated, deployed to Vercel with a Firestore backend.

## Language

**Manual order**:
The user-controlled sequence a Ticket or Jog holds in a list, set by dragging it in the UI — independent of creation time, title, or any other sortable attribute. Applies to the Backlog list's default sort and to a kanban column's card order.
_Avoid_: position, sort order, index (these describe the storage technique, not the concept — the domain concept is "the order the user put it in," however it's stored).
