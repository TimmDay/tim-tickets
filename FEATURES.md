# FEATURES.md

Working spec for tim-tickets, a personal issue tracker. This is where we decide the functional details together before building them. Update this file as decisions are made.

## Overview

- Personal, single-user issue tracker inspired by Jira/Trello.
- Tickets move through columns on a board.
- Deployed on Vercel, data stored in GCP Firestore, single shared-password gate for access.

## Board Columns

_TBD — decide the workflow stages (e.g. Backlog/To Do/In Progress/Done vs a Jira-style flow with a review step)._

## Ticket Fields

_TBD — e.g. title, description, priority, labels, due date, created/updated timestamps._

## Auth Flow

_TBD — login page/form, session cookie mechanics, logout._

## Deployment

_TBD — GitHub + Vercel auto-deploy vs Vercel CLI; GCP Firestore project setup steps._

## Todo

- [ ] Decide board columns
- [ ] Decide ticket fields
- [ ] Decide auth flow details
- [ ] Set up GCP project + Firestore
- [ ] Set up Vercel project + env vars
- [ ] Decide deployment method
