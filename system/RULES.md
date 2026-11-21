# PoliGraph rule reference (full detail)

The short overview is in README.md. This file lists every rule, output field, trace field and the ontology.

**In one line:** OWL defines the vocabulary (`ontology/proof.owl`), a closed-world, Datalog-style rules engine (`run`) makes every decision, and each case is exported back as an OWL-typed knowledge graph (`<output>.kg.ttl`, with `--trace`).

```
system/run <institution_folder> <output.jsonl> [--trace]
```
This is Python 3 with the standard library only, so there's nothing to install. It reads only the folder you give it. It writes only `<output.jsonl>`, and with `--trace` it also writes `<output.jsonl>.trace.jsonl`. It runs 1,000 cases in about 2 seconds. There's no LLM, no network and no randomness.

## 0. Normalisation layer

Before any rule reads them, every evidence document goes through `normalise()`, and so does every free-text string in the jsonl inputs. Each step is a fixed, ordered table, so the result is deterministic. Text that is already canonical comes back unchanged, so verdicts on the supplied data are unchanged.

| Step | Variants accepted | Canonical form |
|---|---|---|
| Characters | Non-breaking and thin spaces, curly double quotes, en/em dashes, tabs | Space, `"`, `-` |
| Whitespace | Runs of spaces; lines broken mid-sentence | One space; the lines rejoined |
| Money | `GBP 9680.13`, `GBP9680.13`, `9,680.13 GBP`, `9680.13 pounds (sterling)`, `sterling 9,680.13`, `STG …`, `£ 9680.13`; European `9 680,13 GBP` / `£9.680,13`; multipliers `£12.5k`, `£1.2m`, `£3 million` | `£9,680.13` (numbers with broken thousands grouping such as `1,23,456` are not read as money) |
| Dates | `2026-09-14`, `14/09/2026`, `14-09-2026`, `14.09.2026` (UK day-first), `September 14, 2026`, `14th Sep 2026`, `14th of September 2026`; US `09/14/2026` only when unambiguous (second number > 12) | `14 September 2026` |
| Field labels | `Remit to`, `Payee`, `Balance due`, `Total due`, `Name(s) on account`, `Date of incorporation`, `DOB` … | `Pay to`, `Amount due`, `Account holder(s)`, `Incorporated`, `Date of birth` |
| Label and table-header abbreviations | `Acct`, `No.`, `Ref.`, `Dir.`, `Co.` | Account, number, reference, director, company |
| Company legal forms | `Limited`, `Ltd.`, `LIMITED`, `P.L.C.`, `Limited Liability Partnership` | `Ltd`, `plc`, `LLP` (and `norm()` treats limited = ltd) |
| Phrases | `in the name of`, `stepped down`, `ceased to be a director`, `10 per cent / percent` | `held by`, `resigned`, `resigned as director`, `10%` |

The parsers themselves also stay tolerant as a second line of defence:
- `MONEY_RE` accepts GBP prefixes and suffixes.
- `DATE_RE` and `pdate` accept every date form above.
- The dissolved-date and date-of-birth readers use the shared date grammar.
- `statement_holders` accepts `held by / in the name of / registered to / belongs to`.
- The mule-chat pattern accepts `keep/retain/take N % / per cent / percent / cut`; chat speaker labels are case-insensitive (`Customer`, `Client`, `Me`, `User`, `Account holder`).
- Tables: markdown tables, plus bullet or plain rows written `Key: value; Key: value`.
- Names are compared with a shared `name_key` (titles Mr/Mrs/Ms/Miss/Dr, initials, `(UK)` and legal forms dropped; `Surname, Forename` reordered; at least two words must remain). It is used for own-account holders, scam-report senders and date-of-birth lookups.

## 1. Ontology
Each case is loaded into a small graph:
- the **customer** (declared profile, employer, business activity)
- **alerts** (rule, `measured`, transactions)
- **transactions**
- **documents** (typed: statement, invoice, register, PSC, gift letter, chat, staff note, ...)
- **prior reviews**
- **internal-list entries**

Documents are parsed with regex into `**Field:** value` pairs, markdown tables, £ amounts, `d Month yyyy` dates, `Unit 4A`, `IBAN/account ending NNNN` and `Account holder(s)`. Every derived **fact** records the source IDs it came from.

## 2. Rules, in ladder order
1. **Suspicion rules mean ESCALATE.** Any single one decides the case, and it overrides any documents that would otherwise explain the activity:
   - a scam report ties to an inbound payment (by sender name, by amount and date within 2 days, or by amount into the customer's `account ending NNNN`), or a chat describes a mule role → `ESC_MULE_ACTIVITY`. A scam report that ties to no payment blocks CLOSE (`RFI_SOURCE_OF_FUNDS`)
   - a staff note talks about staying under a threshold → `ESC_STRUCTURING`
   - the payer company was dissolved before it paid → `ESC_UNEXPLAINED_FUNDS`
   - money is paid on to the director's newly formed companies beyond the documented fee → `ESC_PASS_THROUGH`
   - a chat says the money belongs to friends or cousins → `ESC_THIRD_PARTY_FUNDING` / `ESC_EARLY_REDEMPTION`
   - payment-file payees share UK addresses → `ESC_MULE_ACTIVITY`
   - one device is used by several customer IDs → `ESC_ACCOUNT_MISUSE`
   - two chats give contradictory stories → `ESC_UNEXPLAINED_FUNDS`
   - an undeclared high-risk corridor goes to unrelated people, or the client can't explain the routing → `ESC_HIGH_RISK_CORRIDOR`
   - invoiced goods don't fit the business → `ESC_INVOICE_MISMATCH`
   - **contradicting document:** a later document (e.g. an insurance schedule) still shows the customer with the same vehicle registration a sale receipt says was sold → `ESC_UNEXPLAINED_FUNDS`
   - **document in another person's name:** a sale receipt matching the alerted credit names a seller who is not the (individual) customer → `ESC_UNEXPLAINED_FUNDS`
   - **unverified group claim:** a group chart says a paying company shares the customer's owner, but that company's own register lists other officers/controllers → `ESC_THIRD_PARTY_FUNDING`
   - **source document contradicts payment:** a gift letter / completion statement names neither the payer nor the amount, and the alerted credit is larger than anything it documents → `ESC_THIRD_PARTY_FUNDING`
   - corridor rule also reads contact notes (client "would rather not" / "would not" explain the routing); the unreconciled-activity keyword list includes "refused/refusal"
2. **Internal list (TM22).** Each match is resolved as confirmed, cleared or unsettled:
   - **Officer match:** the PSC "Ceased" date is compared with the payment date. Control on the payment date means confirmed (ESC), even if the person resigned as a director earlier.
     Also applies to "person with significant control" matches and to PSC tables inside register extracts (a listed person still shown as controller, incl. exactly 50%, is confirmed).
     **Proxy handover:** if the listed person's control/office ended within 30 days before the payment and passed (within 7 days) to someone with the same surname or described as a relative, control is treated as staying with the listed party → confirmed (ESC).
   - **Address match:** the list entry's unit is compared with the payee's unit. A different unit means cleared.
   - **Name match:** the DOB in a gift letter or register is compared with the list DOB. The same DOB means confirmed; a different DOB means cleared.
   - Anything else stays unsettled and becomes `RFI_COUNTERPARTY_DETAILS`.
3. **Explanation rules.** Each one links documents to the transactions they explain:
   - a document's amount (invoice, contract, payment file, letter or receipt) matches the transaction **exactly to the penny** (both rounded to pence first, so float noise cannot matter; `DOC_AMOUNT_TOL = 0`), and it names the counterparty (name words or account digits; the payment reference is not used). For a payment **out** against an invoice (`INVOICE_MATCHES`), the invoice's own payee (`Pay to` / `Supplier` / heading, not the index title) must name the counterparty; an account-number match counts only when the invoice names no payee. An invoice with the right amount but a different payee does not explain the payment, so the alert stays open → RFI naming the mismatch. (RFI rather than `ESC_INVOICE_MISMATCH`: that code is kept for affirmative red flags such as goods that do not fit the trade; a payee mismatch can be innocent, and RFI is the cheaper error if it is.)
   - own-account statement: the customer is a named holder and the account's last 4 digits match
   - a booking lists every payer as a traveller
   - a group structure gives both companies the same owner
   - re-deposited cash: a chat, an earlier withdrawal of the same amount and a prior review
   - redundancy letter plus a sell email
   - factoring agreement plus remittance advice
   - profile items: salary from the declared employer, card settlements, small own top-ups, payments_fx client self-funding
4. **Reconciliation per alert, against the threshold that made it fire.** An alert is cleared only when the unexplained part falls back under its rule's limit:
   - TM01: received minus explained ≤ multiple × baseline (payments_fx also credits the client's onward own-account or invoiced outflows)
   - TM02: unexplained inflow < £2k
   - TM04: uncovered counterparties ≤ the limit
   - TM06/TM07: uncovered < £5k
   - TM03/TM05/TM08: every transaction covered
   - TM22: cleared by the list resolution
5. **Verdict:**
   - Any open alert means RFI. The ask is specific to that alert's rule and names the unexplained transactions.
   - Exceptions to that RFI:
     - suspicion keywords in the documents → ESC
     - split cash deposits with no records at all → ESC_STRUCTURING
   - A payments_fx held payment of ≥ £10k to a non-client with no invoice → RFI.
   - Own-account explanation at ≥ 5x the profile → `RFI_UPDATED_PROFILE`.
   - Dormant reactivation (TM07) that would close only on the declared profile, with no re-verification record → `RFI_SOURCE_OF_FUNDS` (source of the reactivation funds must be evidenced).
   - Otherwise **CLOSE**, but only when every alert reconciles. The close code is the most specific explanation used (see `CLOSE_PRIORITY`).
6. **Safety.** Each case runs inside try/except. If something fails, the fallback is ESC when suspicion keywords appear and RFI otherwise, never CLOSE.
   - Incomplete data never closes: an alert or alerted transaction that is not on file, an alert with no transactions, a zero/negative/non-numeric alerted amount, a missing customer record or review window, or an unreadable transaction record for the customer → `RFI_SOURCE_OF_FUNDS` (suspicion rules still run first and can escalate).
   - Malformed jsonl lines are skipped, counted and reported on stderr; a missing file just means no records.
   - Evidence file paths are confined to the institution folder (resolved with `realpath`); anything pointing outside falls back to `evidence/<doc_id>.md`.
   - The institution type comes from `cases.jsonl`, else the folder name, else the first heading of `POLICY.md` ("Payments and FX firm", "E-money firm", "Investment firm", "Bank").

## 3. Output
- **Fields:** `case_id, alert_ids, verdict, reason_code, reason, evidence`, always in that order.
- **reason:** 2–4 templated sentences (enforced by `clamp_reason`, whose sentence splitter ignores abbreviations such as "Sp. z o.o.", quoted text and parentheses) with this case's names, amounts, dates and document IDs. For an RFI it is the exact ask.
- **evidence:** sorted and deduplicated, and filtered to IDs that exist in this case's files. It always includes the deciding documents, every ID the reason names, and, for payments_fx, the held payment.

## 4. Trace (`--trace`)
One JSON line per case:
- `nodes`: customer, alerts, transactions, documents, list entries, fired rules, verdict
- `edges`: `fired_on`, `supports`, `contradicts`, `matches`, `explains`
- `facts` with their source IDs
- `firings`: rule, outcome, the facts used, plus docs and transactions
- `reconciliation` per alert: alerted £, explained £, profile £, unexplained £, uncovered transactions, the documents that explained it, and whether it cleared
- `list_resolution` for TM22

## 5. Ontology and knowledge-graph export
- `ontology/proof.owl` (Turtle) defines the vocabulary:
  - classes: Case, Party → Customer / Counterparty, Account, Transaction, Alert, ListEntry, Fact, Reconciliation, Verdict, ReasonCode, and Rule → MonitoringRule / ReasoningRule (→ Suspicion, ListResolution, Explanation, Reconciliation and Decision rules)
  - Document subtypes: Invoice, AccountProof, EventDoc, ThirdPartyDoc, BusinessRecord, RegistryRecord (→ CompanyRegister, ControlRegister, GroupStructure), PriorReview, ScamReport, Correspondence, StaffNote, IdentityRecord, DeviceRecord
  - object properties: firedOn, holdsAccount, explains, supports, contradicts, matchesListEntry, citedAs, decidedBy, hasVerdict, ...
  - data properties: amount, date, sourceId, ...
  - every verdict and reason code is a named individual
- Each trace node carries its OWL `class` and each edge its `property`.
- With `--trace` the engine also writes `<output>.kg.ttl`. It holds the asserted facts (customer, accounts, transactions, counterparties, documents, list entries) and the engine's derived conclusions (facts with `hasSource`, fired rules with `usesFact`, explains/supports/contradicts, reconciliation, the verdict with `decidedBy`/`hasReasonCode`/`citedAs`). One triple per line, sorted, so it's byte-stable.
- The engine reasons closed-world, in Python, not with an OWL reasoner. OWL is the shared schema for export and the viewer, so there's no runtime dependency.
- When a suspicion rule or a confirmed list match decides first, the trace still books the alerted pounds against the evidence. Those firings are marked `advisory` and never change the verdict, so the viewer can show "books balance · escalation overrides".
- `tests/check_ontology.py` checks that every node type, edge type, class, property and individual the engine emits in traces and RDF is defined in `proof.owl`. It exits 1 loudly otherwise, and it isn't part of the scored path. Run it with `python3 system/tests/check_ontology.py output/`.

## 6. Determinism
Inputs are read in file order; documents are sorted by ID and transactions by time and ID. There's no set iteration in the output paths, and keys are in a fixed order. Five repeated runs give byte-identical output. Policy constants live at the top of `run` (`POLICY`, `OWN_ACCOUNT_RFI_MULTIPLE`, `CLOSE_PRIORITY`, `EXPLAIN_TYPES`). Nothing from the dev set (case IDs, names, amounts) is hard-coded.

## Approved policy overrides (optional)
`system/run <folder> <out.jsonl> --policy=policy-overrides.json` applies an approved change from the viewer's Import page
(`{"schema": "poligraph.policy-overrides/1", "institution": "bank", "overrides": {...}}`). Keys: `tm02_min`,
`invoice_required_gbp`, `own_account_rfi_multiple`, `tm01_limit_multiple_individual`, `tm01_limit_multiple_business`
(null = use the alert's own limit). Unknown keys, booleans and negative numbers are rejected; a bad or unreadable policy file exits with code 2 and a one-line message, no traceback. Without the flag the defaults from POLICY.md apply and
outputs are byte-identical to the official run.
