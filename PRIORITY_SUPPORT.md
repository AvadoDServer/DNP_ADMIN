# Priority Support

The **Priority Support** tab sells a Stripe subscription (EUR 12 / month,
EUR 100 / year) that belongs to the box, identified by its node id. There are no
user accounts and no activation codes.

Code: `build/src/src/pages/priority/` (`components/Priority.jsx`, `priorityApi.js`).
Backend: the `avado-priority-support-backend` repository, served at
`https://priority.ava.do/api` (override at build time with
`REACT_APP_PRIORITY_API_URL`).

## Flow

1. On load the page asks the backend for `GET /subscription/status/:nodeId`.
2. **Subscribe** / **Manage billing**: the page takes `serverTime` from the
   status response, asks the DAPPMANAGER to sign the request
   (`signPrioritySupportRequest` RPC, signed with the box identity key), posts
   it to `/subscription/checkout` or `/subscription/portal` and sends the
   browser to the Stripe URL it gets back.
3. Stripe returns the browser to `https://priority.ava.do/return`, which
   forwards to `<admin ui origin>/#/priority?checkout=success|cancelled`.
4. The subscription reaches the backend by webhook a moment later, so after a
   successful checkout the page polls the status for up to 60 seconds.

Shown states: not subscribed, active, payment problem (`past_due`, support stays
active while Stripe retries), cancelled at period end, backend unreachable, box
identity not loaded yet, and a DAPPMANAGER too old to have the signing RPC
("needs a system update").

## Requirements

- DAPPMANAGER with the `signPrioritySupportRequest` call. Release it before or
  together with this Admin UI.
- The box needs internet access to reach `priority.ava.do` and Stripe.

## Development

`yarn dev` runs in mock mode (`REACT_APP_MOCK_DATA=true`): no backend and no box
are needed. Subscribing activates a mock subscription and Manage billing toggles
"cancelled at period end", so every state of the page can be seen.
