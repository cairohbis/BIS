# BIS-main

> **BIS-main** is an independent, student-built university helper and community platform for students. It is not an official university administration system.

[![GitHub](https://img.shields.io/badge/source-GitHub-black?logo=github)](https://github.com/cairohbis/BIS)
[![Firebase](https://img.shields.io/badge/backend-Firebase-orange?logo=firebase)](https://firebase.google.com/)
[![GitHub Pages](https://img.shields.io/badge/deployment-GitHub%20Pages-222?logo=github)](https://pages.github.com/)

## Overview

BIS-main brings common student utilities and community features into one web application. The project combines a responsive Arabic/RTL interface with Firebase-backed authentication and data services.

The application is designed around a **world isolation** model: academic data can be separated by department and year while personal data remains tied to the individual account and selected global features remain available across worlds.

### Important disclaimer

BIS-main is an **independent student project**. It is not operated by, affiliated with, or an official representative of the university administration.

Information published through the application may be user-generated and should not be treated as an official university announcement unless independently verified through an official source.

The attendance feature is a **personal calendar/planning tool** and is not an official attendance record.

---

## Features

### Academic & student tools

- News and announcements
- Lectures and course materials
- Exams
- Sections
- Study schedule
- Study-schedule reminders
- Grades
- Annual tuition information
- Personal expenses
- Military-material resources

### Community features

- Public chat
- Private/direct messaging
- Chat rooms
- Lost & Found
- Reports
- Notifications
- User profiles

### Account & platform features

- Firebase Authentication
- Role-based administration
- World/department-year isolation
- Personal attendance planning
- PWA-oriented web experience
- Arabic RTL interface
- Responsive mobile-friendly UI
- Cloudinary-backed media/file uploads

---

## World isolation

The project uses 16 academic worlds:

| Department | Years |
| --- | --- |
| Information Systems | `is_1` – `is_4` |
| Languages & Translation | `lt_1` – `lt_4` |
| Tourism & Hotels | `th_1` – `th_4` |
| Business / Administration | `ba_1` – `ba_4` |

World-scoped features are intended to expose only the data belonging to the active user's world.

Examples include:

- News
- Lectures
- Exams
- Sections
- Attendance schedule/structure
- Study schedule
- Military materials
- Annual tuition fees
- World-scoped administrative queues

Some features intentionally remain global, while others are personal to the signed-in user. The distinction is part of the application's data-isolation design and should be preserved when adding new features.

---

## Architecture

BIS-main is a browser-based application with a modular JavaScript structure.

### Frontend

- HTML
- CSS
- Vanilla JavaScript
- Font Awesome
- Cairo font
- RTL Arabic layout
- Responsive UI

### Backend / services

- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Messaging
- Cloudinary for media/file storage
- GitHub Pages for deployment

### Repository structure

The exact structure evolves with development, but major areas include:

```text
/
├── index.html
├── style.css
├── firestore.rules
├── world-model.js
├── js/
│   ├── chat-core.js
│   ├── chat-listener.js
│   ├── chat-select.js
│   ├── chat-send.js
│   ├── dms-page.js
│   ├── dm-extras.js
│   ├── library.js
│   ├── report.js
│   ├── quick-notifications.js
│   ├── poll.js
│   └── ...
├── grades/
├── lost-found/
└── ...
```

Because this is a large student-maintained application, not every feature is represented by a single isolated module.

---

## Data model principles

The application follows three broad data-scope categories.

### World-scoped data

Academic/shared data that must be isolated between worlds.

Examples:

- News
- Lectures
- Exams
- Sections
- Attendance schedules
- Study schedules
- Military materials
- Tuition information

### User-scoped data

Personal information that belongs to an individual account.

Examples:

- Grades
- Personal expenses
- Personal attendance records

### Global data

Information intentionally shared across worlds.

Examples:

- Published Lost & Found content
- General instructions
- General platform information
- “Why are you here”
- Installation/share information

When implementing a new feature, its data scope should be decided before adding Firestore queries or rules.

---

## Security

Firestore Security Rules are a critical part of the application's architecture.

The project uses authenticated users and role-aware access controls, including owner/admin distinctions.

### Security principles

- Do not expose Firebase credentials or private configuration in source control.
- Do not rely on client-side filtering as the only security boundary.
- World isolation should be enforced by both application logic and Firestore Rules where applicable.
- Personal data should not become globally readable because of a UI change.
- New Firestore collections/subcollections should receive the minimum permissions required.
- Existing rules should be preserved unless a clearly documented conflict requires a change.

### Rules changes

Before changing `firestore.rules`:

1. Inspect the current rules.
2. Identify the exact collection/path requiring access.
3. Add only the minimum required permission.
4. Avoid rewriting or reordering unrelated rules.
5. Test the affected feature after the change.

---

## Authentication & roles

The application distinguishes between ordinary users and administrative roles.

The owner account has special platform-level capabilities and can select an active world for administrative work.

Ordinary accounts are associated with a world such as `is_2`.

Role and world checks should always be performed using the application's existing helpers rather than introducing duplicate authorization logic.

---

## Private messaging

Private chats use a deterministic chat ID derived from the two participant UIDs.

A private-chat parent document is expected to exist before messages are written to its `messages` subcollection.

The application therefore separates:

1. Opening/selecting a chat.
2. Creating the private-chat parent when a message is actually sent.
3. Reading and listening to messages.
4. Updating previews/unread state.

This distinction is important because simply opening a user's profile or direct-chat screen should not create an empty conversation.

---

## Attendance

Attendance is intentionally a hybrid feature.

- The **schedule/structure** is world-scoped.
- The **individual attendance records** are personal to the user.

The feature is intended as a personal planning/calendar aid and must not be presented as an official university attendance record.

---

## Media and files

The application uses **Cloudinary** for image/file uploads rather than Firebase Storage.

When adding upload functionality:

- Reuse the existing upload flow where possible.
- Do not expose private credentials.
- Preserve existing returned data contracts.
- Do not introduce Firebase Storage merely for convenience unless the architecture is intentionally changed.

---

## Development principles

This repository contains a large, actively evolving codebase. Changes should be conservative.

### Preferred change strategy

- Audit before modifying.
- Make the smallest change that fixes the documented issue.
- Preserve existing IDs, globals, function names, and interfaces.
- Avoid unrelated refactoring.
- Avoid visual redesign when the task is functional.
- Do not rewrite large files when a small targeted change is sufficient.
- Keep Firestore Rules changes minimal.
- Validate syntax after JavaScript changes.
- Test both authenticated and unauthenticated behavior where relevant.
- Test world boundaries when a feature is world-scoped.

### Before changing a large file

Identify:

- The exact function involved.
- Existing callers.
- Existing globals/state.
- Firestore reads and writes.
- Related security rules.
- Any other module that owns the same feature.

This reduces the risk of fixing one path while leaving another live path unchanged.

---

## Local development

BIS-main is a static web application and can be served with any local HTTP server suitable for static sites.

For example:

```bash
git clone https://github.com/cairohbis/BIS.git
cd BIS
```

Then serve the directory with your preferred local development server.

Do not open the application directly with `file://` when testing Firebase-dependent functionality; use an HTTP(S) origin.

### Configuration

Firebase and Cloudinary configuration should follow the project's existing configuration approach.

Do not commit:

- service-account private keys
- private API secrets
- passwords
- user credentials
- authentication tokens
- other sensitive secrets

---

## Testing checklist

Before merging a functional change, verify the affected feature in a real browser.

### General

- [ ] No new console errors
- [ ] Existing UI remains intact
- [ ] Authentication still works
- [ ] Logout/login without a full reload behaves correctly
- [ ] No stale state from the previous account remains

### World isolation

For a world-scoped feature:

- [ ] User from world A sees world A data
- [ ] User from world B does not see world A data
- [ ] Creating data assigns the correct world
- [ ] Editing/deleting data respects the world boundary
- [ ] Admin/owner behavior is tested separately
- [ ] Firestore Rules enforce the intended boundary

### Private chat

- [ ] Opening a user does not create an empty private chat
- [ ] Sending the first message creates the required chat parent
- [ ] Existing conversations remain visible
- [ ] Messages remain readable by the correct participants
- [ ] Unread state does not reference nonexistent/inaccessible chat parents
- [ ] Switching accounts without reload does not leak previous DM state

---

## Data migration principles

Historical data migrations must be conservative.

The project uses explicit migration decisions for legacy records rather than guessing a world from incomplete data.

General principles:

- Do not delete existing user data.
- Do not change document IDs unnecessarily.
- Do not alter message IDs or timestamps without a documented reason.
- Preserve references between documents.
- Backfill only when the target value is known from the migration rules.
- Treat intentionally global records as global.
- Keep a clear record of migrated collections and counts.

Historical data that was explicitly designated as belonging to `is_2` should not be reassigned to another world based on inference.

---

## Administration

Administrative functionality is intended to operate within the selected world where the underlying feature is world-scoped.

The owner can select an active world for administrative work.

Administrative code should not silently bypass world boundaries merely because the current account has elevated privileges unless that behavior is explicitly part of the feature's design.

---

## Contributing

This project is primarily maintained as a student project.

Before submitting a change:

1. Understand the existing implementation.
2. Search for all callers of the function or collection being changed.
3. Check Firestore Rules if Firestore access changes.
4. Keep the diff focused.
5. Test the affected feature in a browser.
6. Document migrations or data-shape changes.
7. Avoid unrelated formatting/refactoring.

### Pull request guidance

A useful pull request should explain:

- **What changed**
- **Why it changed**
- **Files changed**
- **Firestore collections/rules affected**
- **Whether data migration is required**
- **How the change was tested**
- **Any known limitations**

---

## Issue reporting

When reporting a bug, include:

- What you expected
- What actually happened
- Steps to reproduce
- Account role/world used for the test
- Browser/device if relevant
- Console error text
- Affected page/feature
- Whether the issue survives a full reload

Do not post passwords, authentication tokens, private user data, or other secrets in issues.

---

## Project status

BIS-main is an actively developed project. Features, architecture, data models, and internal module boundaries may change over time.

The README documents the intended architecture and development conventions; individual implementation details should always be verified against the current source code before making changes.

---

## License

No open-source license is declared in this README at this time.

Unless a license is added to the repository, third parties should not assume that the source code is freely licensed for redistribution or modification.

---

## Links

- **Repository:** https://github.com/cairohbis/BIS
- **GitHub Pages:** see the repository's Pages configuration for the current deployed URL.

---

## Disclaimer

BIS-main is an independent student-built project and is not an official university administration platform.

The project is provided for student assistance, organization, and community use. Users should verify important academic, administrative, financial, examination, and attendance information through the appropriate official university channels.
