# Campaign Tracker — Phase 2 Features

**Prepared for:** Josh Tenorio & Tina Muña Barnes Campaign Team
**Date:** February 24, 2026
**Status:** Brainstorm / Planning

---

Phase 1 gave us a solid foundation — supporter tracking, quota management, events, election day operations, and a war room that actually works. Phase 2 is about turning Campaign Tracker from a great tool into the **operational nerve center** of the campaign. These features are what separate a campaign that *hopes* for the best from one that *engineers* a win.

---

## 1. Communication & Outreach

### WhatsApp Integration
Send blast messages, reminders, and personal outreach directly through WhatsApp — the messaging platform everyone on Guam actually uses daily. Supporters can reply, and conversations sync back into CT.

**Why it matters:** Email open rates are ~20%. WhatsApp open rates are ~98%. On Guam, WhatsApp *is* how people communicate. Meeting supporters where they already are is a massive force multiplier.

**Complexity:** Medium · **Priority:** Must-have

---

### Automated Follow-Up Reminders
CT flags supporters who haven't been contacted in a configurable number of days and automatically nudges the assigned block leader or volunteer to reach out. Optional auto-send of a "checking in" message to the supporter.

**Why it matters:** No supporter falls through the cracks. The difference between a "maybe" and a "committed voter" is often just one more touchpoint. This ensures consistent engagement without manual tracking.

**Complexity:** Low · **Priority:** Must-have

---

### SMS Conversation Threads (Two-Way Texting)
Turn one-way SMS blasts into actual conversations. Each supporter gets a thread view so staff can see the full history — what was sent, what the supporter replied, and any follow-up needed.

**Why it matters:** One-way blasts feel impersonal. Two-way texting builds real relationships and lets the campaign respond to questions, concerns, or enthusiasm in real time.

**Complexity:** Medium · **Priority:** Must-have

---

### Push Notifications (Mobile App)
Native push notifications for volunteers and staff — new task assignments, event reminders, quota milestones, election day alerts. Instant, reliable, and doesn't cost per-message like SMS.

**Why it matters:** Keeps the entire campaign team in sync without relying on people checking the app. Critical for election day when every minute counts.

**Complexity:** High (requires mobile app or PWA) · **Priority:** Nice-to-have

---

### Template Library for Common Messages
Pre-written, approved message templates for common scenarios: welcome messages, event invitations, GOTV reminders, thank-you notes, and follow-ups. Staff pick a template, personalize if needed, and send.

**Why it matters:** Keeps messaging on-brand and consistent across all volunteers. Saves time — a new volunteer can send a perfect outreach message on day one without crafting it from scratch.

**Complexity:** Low · **Priority:** Must-have

---

## 2. Field Operations

### Door-to-Door Canvassing Mode
A dedicated mobile view with a map showing target households. Volunteers tap a house, log the visit (home/not home/supportive/undecided/opposed), add notes, and move to the next one. Everything syncs back to CT in real time.

**Why it matters:** Canvassing is how campaigns are won on the ground, especially on Guam where personal connection matters. Right now this is done with paper lists and clipboards. Digitizing it means instant data, no lost sheets, and real-time visibility into field progress.

**Complexity:** High · **Priority:** Must-have

---

### GPS-Tagged Supporter Sign-Ups
When a supporter signs up via mobile (QR code scan, event check-in, or field entry), CT captures GPS coordinates. This places the supporter on a map and auto-suggests their village and precinct.

**Why it matters:** Eliminates manual village assignment errors and gives the campaign a real-time geographic picture of where support is growing — and where the gaps are.

**Complexity:** Low · **Priority:** Must-have

---

### Offline Mode
The mobile interface works without cell signal. Supporter sign-ups, canvassing logs, and event check-ins are stored locally and sync automatically when connectivity returns.

**Why it matters:** Parts of Guam have spotty coverage — especially in southern villages and during typhoon season. Field teams shouldn't lose data because of a dead zone.

**Complexity:** High · **Priority:** Must-have

---

### Enhanced OCR for Paper Forms
Improved photo capture with edge detection, auto-crop, and better handwriting recognition. Batch scanning mode for processing stacks of paper signup forms quickly.

**Why it matters:** Paper forms aren't going away — community events, church gatherings, and fiesta sign-ups still produce paper. Faster, more accurate digitization means less manual data entry and fewer errors.

**Complexity:** Medium · **Priority:** Nice-to-have

---

### Walk List Generation (Optimized Routes)
Generate printable or mobile walk lists for canvassers, organized by neighborhood with optimized walking routes. Filter by supporter status, contact history, or priority level.

**Why it matters:** A canvasser with a smart route hits 40 doors in the time it takes an unorganized one to hit 25. Multiply that across the whole campaign and it's thousands of extra voter contacts.

**Complexity:** Medium · **Priority:** Must-have

---

## 3. Analytics & Intelligence

### Predictive Turnout Modeling
Use historical voting data, supporter engagement levels, and contact history to predict which supporters are likely to vote — and which need extra encouragement.

**Why it matters:** Not all supporters are equal on election day. Knowing who's a "sure vote" vs. who needs a ride to the polls lets the campaign allocate resources where they'll have the most impact.

**Complexity:** High · **Priority:** Nice-to-have

---

### Supporter Sentiment Tracking
Log and track supporter sentiment over time (enthusiastic → supportive → lukewarm → at-risk). Automated alerts when a supporter's engagement drops or sentiment shifts negative.

**Why it matters:** Catching a wavering supporter early — before they drift to the other side — is worth ten new sign-ups. This gives district coordinators early warning to intervene.

**Complexity:** Medium · **Priority:** Nice-to-have

---

### Geographic Heat Maps
Interactive maps showing supporter density, canvassing coverage, event attendance, and voter turnout by village, precinct, and block. Overlay multiple data layers to spot patterns.

**Why it matters:** A picture is worth a thousand spreadsheet rows. Heat maps instantly show where the campaign is strong, where it's weak, and where the opportunities are. Perfect for strategy meetings.

**Complexity:** Medium · **Priority:** Must-have

---

### Conversion Funnel
Visualize the full supporter journey: **Signed Up → Contacted → Committed → Voted**. Track conversion rates at each stage and identify where supporters are dropping off.

**Why it matters:** If 500 people signed up but only 200 were ever contacted, that's a problem you can fix. The funnel makes invisible leaks visible and gives the campaign clear action items.

**Complexity:** Medium · **Priority:** Must-have

---

### Comparative Analysis
Compare performance across time periods, villages, or even previous election cycles. Track whether the campaign is ahead or behind pace compared to historical benchmarks.

**Why it matters:** "Are we doing better than last time?" is the question every campaign asks. This answers it with data, not gut feelings.

**Complexity:** Medium · **Priority:** Future

---

### Real-Time Dashboard TV Mode
A beautiful, auto-refreshing dashboard designed for a large TV on the wall at campaign HQ. Shows live supporter counts, village progress bars, leaderboard, and countdown to election day.

**Why it matters:** Energy and morale matter. A live dashboard showing the numbers ticking up keeps the team motivated and creates a sense of momentum. It's also impressive when visitors walk through HQ.

**Complexity:** Low · **Priority:** Nice-to-have

---

## 4. Volunteer Management

### Shift Scheduling
A calendar-based system for scheduling volunteer shifts — phone banking, canvassing, event staffing, election day roles. Volunteers can sign up for open slots and get reminders.

**Why it matters:** Right now shift coordination happens through group chats and spreadsheets. A proper scheduling system means fewer no-shows and better coverage across all campaign activities.

**Complexity:** Medium · **Priority:** Nice-to-have

---

### Task Assignment & Tracking
Assign specific tasks to volunteers (call these 20 supporters, deliver signs to these 5 houses, follow up with this village chief) with due dates, status tracking, and completion confirmation.

**Why it matters:** Accountability. When tasks are assigned and tracked, things actually get done. When they live in someone's memory or a text message, they get forgotten.

**Complexity:** Medium · **Priority:** Nice-to-have

---

### Training Modules / Onboarding Flow
Step-by-step onboarding for new volunteers: how to use CT, canvassing best practices, talking points, dos and don'ts. Trackable so coordinators know who's been trained.

**Why it matters:** A well-trained volunteer is ten times more effective than one who's winging it. This ensures quality and consistency as the volunteer base scales up.

**Complexity:** Medium · **Priority:** Future

---

### Volunteer Hours Tracking
Log volunteer hours automatically (shift check-in/out) or manually. Generate reports for recognition, and provide volunteers with a record of their service.

**Why it matters:** Volunteers who feel appreciated come back. Hours tracking enables recognition programs and gives the campaign data on its most dedicated people.

**Complexity:** Low · **Priority:** Nice-to-have

---

### Recognition & Gamification
Badges, streaks, and achievements for volunteers: "First 100 Contacts," "7-Day Streak," "Village Champion." Ties into the existing leaderboard system with new reward tiers.

**Why it matters:** Gamification works. Friendly competition and visible recognition keep volunteers engaged and motivated, especially younger team members.

**Complexity:** Low · **Priority:** Nice-to-have

---

## 5. Election Day Enhancements

### Live Voter Turnout Map
A real-time map showing voter turnout percentage by precinct, updated as poll watchers report check-ins. Color-coded to instantly show which precincts are running hot or cold.

**Why it matters:** This is the war room's most powerful weapon. If a friendly precinct is showing low turnout at noon, the campaign can surge GOTV resources there before it's too late.

**Complexity:** Medium · **Priority:** Must-have

---

### Automated "Go Vote" Reminders
Supporters who haven't been marked as voted by 2 PM automatically receive a reminder via SMS/WhatsApp. Configurable time triggers and escalating urgency ("Polls close at 7 PM — have you voted yet?").

**Why it matters:** Every campaign has supporters who intend to vote but just... don't get around to it. An automated nudge at 2 PM (with enough time left to act) can move the needle by hundreds of votes.

**Complexity:** Low · **Priority:** Must-have

---

### Transportation Coordination
Supporters can request a ride to the polls. Volunteer drivers see a queue of ride requests with pickup locations and preferred times. Real-time status tracking (requested → assigned → picked up → voted).

**Why it matters:** On Guam, not everyone has reliable transportation — especially elderly supporters. Removing the logistics barrier turns a "supporter" into an actual vote.

**Complexity:** Medium · **Priority:** Must-have

---

### Issue Reporting
Poll watchers can report issues — long lines, machine malfunctions, accessibility problems, or irregularities — directly through CT with photo/video attachments. War room sees issues in real time and can dispatch help.

**Why it matters:** Problems at polling places cost votes. Fast reporting and response means the campaign can get lawyers, media attention, or extra resources where they're needed before the damage is done.

**Complexity:** Low · **Priority:** Must-have

---

### Real-Time Poll Watcher ↔ War Room Chat
Dedicated, secure messaging between poll watchers and the war room. Group channels by precinct and direct messaging for sensitive issues. Faster and more organized than a WhatsApp group.

**Why it matters:** Election day communication is currently ad-hoc — phone calls, texts, group chats. A purpose-built channel keeps everything organized, logged, and actionable.

**Complexity:** Medium · **Priority:** Nice-to-have

---

## 6. Post-Election & Multi-Campaign

### Results Tracking & Analysis
Import official election results and overlay them with campaign data — supporter locations, contact history, turnout. See exactly where the campaign won and lost, and why.

**Why it matters:** Win or lose, understanding what happened is how you build a better campaign next time. This turns election night from an emotional experience into a learning one.

**Complexity:** Medium · **Priority:** Future

---

### Supporter Database Carry-Forward
Seamlessly migrate the supporter database between election cycles. Maintain contact history, engagement scores, and relationships so the next campaign doesn't start from zero.

**Why it matters:** A campaign's supporter database is its most valuable asset. Carrying it forward means the next race starts with a warm list of thousands instead of a cold start.

**Complexity:** Low · **Priority:** Future

---

### Historical Comparison
Compare current campaign metrics against previous cycles: signup pace, volunteer engagement, geographic coverage, turnout predictions. Benchmark progress in real time.

**Why it matters:** Context turns data into strategy. Knowing you're 15% ahead of last cycle's pace in Dededo — but 10% behind in Yigo — tells you exactly where to focus.

**Complexity:** Medium · **Priority:** Future

---

### Multi-Campaign Management
Run multiple campaigns simultaneously within one CT instance — gubernatorial, senatorial, mayoral. Shared supporter database with campaign-specific tracking, permissions, and dashboards.

**Why it matters:** Guam elections happen across multiple races. A party or political organization that can coordinate across campaigns — sharing data, avoiding duplicate outreach — has a structural advantage.

**Complexity:** High · **Priority:** Future

---

## Priority Summary

| Priority | Features |
|----------|----------|
| **Must-have** | WhatsApp integration, Automated follow-ups, SMS threads, Templates, Canvassing mode, GPS sign-ups, Offline mode, Walk lists, Heat maps, Conversion funnel, Live turnout map, Go Vote reminders, Transportation coordination, Issue reporting |
| **Nice-to-have** | Push notifications, Enhanced OCR, Predictive modeling, Sentiment tracking, TV dashboard, Shift scheduling, Task tracking, Hours tracking, Gamification, Poll watcher chat |
| **Future** | Comparative analysis, Training modules, Results tracking, DB carry-forward, Historical comparison, Multi-campaign |

---

*Campaign Tracker is built by Shimizu Technology for the Tenorio-Barnes campaign. Phase 2 development timing and scope to be determined based on campaign priorities and timeline.*
