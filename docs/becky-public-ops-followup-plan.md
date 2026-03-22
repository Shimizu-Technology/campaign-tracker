# Becky Meeting Follow-Up Plan

**Status:** Proposed planning document  
**Date:** 2026-03-20  
**Primary source:** `docs/meeting-transcription/03-20-2026/meeting-with-becky.md`

## Purpose

This document captures what was learned from the public-ops meeting with Becky and turns it into a practical implementation plan for the next branch.

It is meant to answer:

- what Becky was actually asking for
- which requests are high priority versus later-phase work
- how those requests fit with the current product
- what we should implement next without mixing unrelated workflows together

## Related references

- `docs/meeting-transcription/03-20-2026/meeting-with-becky.md`
- `docs/public-signup-form-refresh-plan.md`
- `docs/poll-watcher-operations-spec.md`
- `docs/supporter-intake-phase-1-implementation-plan.md`

External references discussed in the meeting:

- [Current public website form](https://www.joshtina.info/)
- [Legacy Jotform supporter intake](https://form.jotform.com/myjotform671/Josh-Tina-Supporter)

## Executive Summary

The biggest takeaway from Becky’s meeting is that the campaign needs a cleaner separation between:

- `supporter intake`
- `general volunteer / join our team intake`
- `registrar / public follow-up operations`
- `election-day poll watcher workflow`

The current app is already stronger than the legacy Jotform in terms of structured data and workflow integration, but Becky highlighted several real operational gaps:

- supporter intake should not be confused with broad volunteer recruitment
- `No GEC Match` should trigger campaign follow-up, not just sit as a verification label
- the public form should capture election-related assistance needs
- households need a cleaner way to submit multiple supporters at once
- poll watchers need a village/precinct full-voter workflow, not only a supporter-only list

## What Becky Was Actually Asking For

### 1. Public supporter intake should be its own clean flow

Becky’s strongest concern was that the campaign’s public-facing forms are doing too many different jobs.

Current issue:

- the website `Join Our Team` form mixes broad volunteer interests with `Proud Supporter`
- the campaign also has a separate Jotform for supporters
- the app has a cleaner supporter signup flow, but public routing appears fragmented

Interpretation:

- supporter intake should become the canonical public supporter flow
- general volunteer recruitment should remain separate
- public pages and QR/links should point people into the correct destination on purpose

### 2. Supporter intake must drive quick follow-up, not only data collection

Becky repeatedly emphasized that once someone enters the system, the campaign cannot wait too long to act on them.

Examples she called out:

- people who are not found in the GEC
- people who need help registering
- people who need absentee or homebound support
- people who need an election-day ride

Interpretation:

- the system needs an operational routing layer, not just storage and later review

### 3. `No GEC Match` needs a dedicated campaign workflow

For Data Ops, `No GEC Match` is a verification outcome.  
For Becky, it is also an operational queue for outreach and registrar action.

Important implication:

- there should be a specific follow-up list, queue, or report for unmatched / registration-help cases
- that workflow may belong to a dedicated campaign role, not only to the data team

### 4. Household capture is operationally important

Becky clearly wants one person to be able to submit multiple household members without making each person fill out the form separately.

She also wants:

- each household member to become a separate supporter record
- shared address and contact information where appropriate
- the household members to stay linked together so the campaign can avoid repetitive outreach

Interpretation:

- household capture should not be ignored as a fringe request
- however, it should not be implemented as an unstructured free-text dump

### 5. Poll watcher tooling needs a fuller election-day model

Becky’s poll watcher expectations go beyond the current supporter-centric framing.

She described a workflow where:

- poll watchers work from the full precinct voter list
- they mark any voter as voted, regardless of campaign support
- the system then cross-references that against campaign supporters
- the campaign derives who still has not voted and should be called

She also mentioned:

- hour-based color/highlight workflow
- timing of vote tracking during the day
- war-room style follow-up after watchers mark activity

Interpretation:

- this is not just a small tweak to the current poll watcher page
- it is a larger election-day workflow track

## Specific Product Direction

## A. Public Forms and Routing

### Recommended direction

- Keep `supporter signup` separate from `join our team`
- Use the app’s supporter form as the long-term supporter-intake destination
- Treat the public website form as a volunteer/contact flow unless intentionally redesigned
- Audit public links, QR codes, and CTA buttons so they point to the correct flow

### Why

- `Proud Supporter` should not be buried inside a broad volunteer-interest form
- supporter intake should feed the supporter review workflow directly
- volunteer recruitment and supporter intake are related, but not identical

### Suggested follow-up

- identify who owns the public website CTA routing
- decide which public URL is the canonical supporter-signup URL
- ensure the website does not funnel supporter leads into the wrong intake bucket

## B. Public Signup Form Updates

### 1. Registered voter wording

Current app direction should change from a binary signal to a 3-state question:

- `Yes`
- `No`
- `Not sure`

Recommended follow-up field:

- `If yes, where do you vote if different from where you live?`

Why:

- this better reflects how people actually answer
- it matches the legacy Jotform expectation
- it gives the campaign more useful follow-up context

### 2. Yard sign wording

Becky’s concern here is legitimate.  
The wording should indicate interest, not guaranteed fulfillment.

Recommended wording options:

- `I would be interested in putting up a yard sign if signs are available`
- `I am interested in hosting a yard sign, if available`

Do not imply:

- automatic approval
- guaranteed delivery
- guaranteed inventory

### 3. Add `How can we help?` campaign-support options

These should be structured fields, not a single free-text note.

Recommended options:

- `I want to get involved in the campaign`
- `I need absentee ballot assistance`
- `I need homebound voting assistance`
- `I need help registering to vote`
- `I need a ride to the polls on Election Day`

Why:

- these are actionable campaign operations signals
- they are explicitly aligned with Becky’s workflow
- they create immediate follow-up value

### 4. Referral attribution fallback

The current product already has stronger structured referral-link attribution than the Jotform.

Recommended approach:

- keep referral links / leader codes as the primary attribution model
- optionally add a plain-text `Who referred you?` fallback only when no referral code is present

This matches Becky’s use case:

- many people will simply text a plain link
- campaign staff still want to know who brought the supporter in

## C. Unmatched / Registration Follow-Up Workflow

### Problem

Right now, someone who is not found in the GEC may be visible to the data team, but Becky does not want those records to wait there passively.

### Recommended direction

Create a dedicated follow-up workflow for supporters who:

- are not found in the GEC
- may need voter registration help
- may have indicated `No` or `Not sure` on voter registration

This can begin as one of:

- a dedicated filtered report
- a dedicated queue page
- a queue plus export/download option

### Recommended role design

Likely future roles or access patterns:

- `registrar_lead`
- `public_followup`
- or a narrowly scoped campaign ops role with access only to the necessary follow-up data

Goal:

- do not force Data Ops to own all campaign follow-up
- do not give broad admin access to people who only need registration-related visibility

### Recommended fields / filters to support

- `verification_reason = no_gec_match`
- `needs_voter_registration_help = true`
- `registered_voter_status in [no, not_sure]`
- village filter
- export/share path for registrar operations

## D. Household Capture Strategy

### Becky’s request

One household submission should be able to create multiple supporter records while avoiding repetitive re-entry of the same address and contact information.

### Recommended direction

Do **not** copy the Jotform’s free-text `Additional household supporters` box as-is.

Instead, build a structured repeatable household entry flow:

- one primary submitter
- optional `Add another household member`
- each added member captures at minimum:
  - first name
  - middle name if needed
  - last name
  - date of birth
- allow shared address / phone / email by default from the primary person
- optionally override phone/email for each household member
- create separate supporter records for each person

### Linking strategy

Recommended product direction:

- add a `household` or `household_group` concept later
- each created supporter record can belong to the same household group
- supporter detail can then show related household members

This enables:

- fewer duplicate calls to the same house
- better campaign visibility into multi-voter homes
- more realistic field operations

### Why not free text

Free text would be hard to:

- validate
- dedupe
- parse reliably
- audit later
- turn into a predictable review workflow

## E. Poll Watcher and Election-Day Workflow

### Becky’s clarified requirement

Poll watchers should not only see known supporters in their area.

They need to work from the full voter list for the relevant village / precinct and then:

- mark when any voter has voted
- use that data to determine which campaign supporters still have not voted
- support war-room call lists and election-day follow-up

### Important implication

The current poll watcher tooling should be treated as incomplete relative to Becky’s real workflow.

### Recommended direction

Create a dedicated election-day enhancement track that includes:

- full village/precinct voter list access for poll watcher workflows
- voter-marked-as-voted actions on that list
- supporter overlay / supporter match indicator
- derived list of supporters who still need outreach
- hour-based / time-stamped workflow review

### Recommendation on scope

Do not fold this into the basic public-signup branch.  
Plan it as a separate election-day workstream.

## What We Should Not Do

- Do not copy the legacy Jotform layout one-to-one
- Do not collapse supporter signup and general volunteer signup into a single overloaded form without explicit design
- Do not implement household capture as a plain text box
- Do not make yard sign wording sound like guaranteed fulfillment
- Do not rely on Data Ops alone to own all non-GEC follow-up operations

## Recommended Workstreams

## Workstream 1: Public Supporter Intake Refresh

### Goal

Make the app’s supporter signup the clean, campaign-appropriate intake flow.

### Includes

- stronger campaign branding / polish
- 3-state voter question
- conditional voting-location follow-up
- yard sign wording change
- structured `How can we help?` section
- optional plain-text referral fallback

### Excludes

- household linked-record implementation
- registrar role design
- poll watcher full-voter-list changes

## Workstream 2: Registrar / Public Follow-Up Workflow

### Goal

Turn `No GEC Match` and registration-related needs into a fast campaign action flow.

### Includes

- dedicated queue or report
- village filtering
- role/access design
- export/share pathway if needed
- visibility into registration-help-related supporters

## Workstream 3: Household Modeling

### Goal

Allow one household submission to create multiple linked supporter records cleanly.

### Includes

- structured repeatable household entry
- household linking strategy
- supporter detail related-household display
- review-flow impact assessment

## Workstream 4: Election-Day Poll Watcher Expansion

### Goal

Support Becky’s described real-world election-day workflow.

### Includes

- full registered-voter list visibility by assignment
- turnout marking for all voters
- supporter overlay
- derived supporter strike/call lists
- time-bucket / hour-based operator workflow

## Recommended Implementation Order

### Phase 1: Immediate next branch

- public supporter form wording updates
- 3-state voter status
- campaign help request checkboxes
- yard sign wording change
- document/confirm public routing ownership

### Phase 2: Fast operational follow-up

- unmatched / registration-help queue or report
- role/access design for registrar or public follow-up lead

### Phase 3: Structured household intake

- design schema
- design repeatable UI
- design linking behavior

### Phase 4: Poll watcher and election-day workflow

- expand poll watcher data model and UI around full voter-list operations

## Major Open Questions

These should be answered before implementation starts on the larger tracks:

- Who owns the public website CTA routing and which URL should be canonical for supporter signup?
- Should `How can we help?` live directly on `supporters` or in a separate support-needs structure?
- Who should own the unmatched / registrar follow-up workflow in practice?
- Does the campaign want one registrar lead in the system, or does Becky still manually route info to leads outside the app?
- Should household members always share address by default, or should each member confirm/edit it?
- Should shared phone/email be optional or the default?
- For poll watcher flows, should the UI be scoped by precinct, village, or both?
- What level of hour-based / color-coded tracking is required in v1 versus later?

## Suggested Acceptance Criteria for the Next Branch

If we start with the public intake refresh, the branch should be considered successful only if:

- the public supporter form clearly reads as supporter intake, not broad volunteer intake
- registered voter status supports `Yes / No / Not sure`
- the form can capture campaign support needs in structured form
- yard sign wording no longer implies guaranteed fulfillment
- supporter submissions still flow cleanly into the existing review pipeline
- data team and public-side operators can understand the new fields without ambiguity

## Final Recommendation

Treat Becky’s meeting as a real product-direction update, not just a list of nice-to-haves.

The public side of the campaign needs:

- clearer intake routing
- faster operational follow-up
- more realistic election-support data capture
- better household handling
- a more complete election-day workflow later

The best next move is to branch off Workstream 1 first, while keeping Workstream 2 close behind.
