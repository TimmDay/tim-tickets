---
status: accepted
---

# Defer screenshot storage migration to GCS

Ticket screenshots are stored as bytes in a Firestore document (`ticketScreenshots/{ticketId}`), client-compressed to under 900KB specifically to stay clear of Firestore's 1 MiB document limit. Deleting a screenshot is batched or transacted together with the ticket (or epic, when archiving cascades to its tickets) status write that triggers it, across two files — `tickets.ts` and `epics.ts`, 7 call sites total — so the metadata and bytes can never drift out of sync.

We're staying on Firestore for now. There's no active pain: this is a hygiene question ("does Firestore feel like the right place for blob bytes?"), not a functional one, and the current feature — one optional image per ticket — is well served by the compression pipeline as it stands. We'll revisit only when tim-tickets grows multi-file or non-image attachments, which is likely but not scheduled. PDFs are the probable trigger, since they can't be shrunk the way images are and will hit the 1 MiB ceiling directly rather than just aesthetically. When that happens, treat it as one migration, not two: generalize the domain model (a single optional `Screenshot` field → a collection of typed `Attachment`s) and move the storage backend to GCS together, rather than adding multi-image support on Firestore first and swapping backends separately later.

## Considered options

- **Migrate to GCS now, pre-emptively.** Rejected — no current need, and it would mean re-engineering the atomic-delete-with-status-change guarantee (which GCS can't join a Firestore transaction for) for a benefit that doesn't exist yet.
- **Stay on Firestore, but proactively decouple the cascade-delete logic now to ease a future swap.** Rejected — that trades away a real, currently-free correctness guarantee for a migration that isn't scheduled. The cascade logic will most likely be rewritten from scratch anyway once the backend actually changes.
- **Add multi-image support on Firestore now, defer only the backend swap.** Rejected — would mean redesigning the domain model twice instead of once.

## Consequences

- The 1 MiB Firestore document limit is the concrete trigger to revisit this: it's a style preference for images today, but becomes a hard functional blocker the moment a non-compressible attachment type (a PDF) is added.
- Screenshot storage isn't confined to one module. `tickets.ts` and `epics.ts` both write to the `ticketScreenshots` collection directly, because a cascade delete has to share a Firestore batch/transaction with the write that triggers it. A future migration touches both files, not one.
- OCR text extraction for PDFs was considered and explicitly deferred, not merely overlooked. Claude already reads PDFs natively (the same way it already reads ticket screenshots today, via the agent's Read tool, with zero pre-processing anywhere in the pipeline) — OCR only becomes relevant if tim-tickets itself ever wants attachment content searchable or previewable from its own UI, independent of an agent run. No such feature exists or is planned; if it ever is, it's its own decision, not something to pre-scope into the attachments migration.
