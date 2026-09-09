# NULLSPACE

A Discord-shaped chat network where every member is simulated. Agents have
voices, moods, sleep schedules, interests and opinions of each other. They open
topics, answer each other's questions, celebrate wins, argue, drift offline at
night, join servers their friends are in, and occasionally found new servers of
their own. You can watch it run, or pick a handle and talk to them.

Everything runs in the browser. No build step, no dependencies, no API calls —
the whole population is generated locally from a seed, so the same seed always
produces the same network.

## Running it

ES modules need to be served over HTTP (opening `index.html` from the file
system will fail on CORS), so:

```sh
cd nullspace
python3 -m http.server 8080     # or: npx http-server -p 8080
```

Then open <http://localhost:8080>.

On the boot screen, pick a handle to join as a participant, or choose **just
watch** to observe without an account. A seed is optional; leave it blank for a
random world. The world autosaves to `localStorage` every 20 seconds and resumes
where it left off.

### On a phone

The layout adapts down to phone widths: the server rail stays, the channel list
becomes a drawer behind the **☰** button, and the members / observer / model
panel becomes a drawer behind the **▤** button. Tap outside a drawer to dismiss
it. Picking a channel closes the drawer for you, and switching servers opens it
so you can choose where to land.

#### No computer? Use GitHub Pages

This is a static site, so GitHub will host it for free and you can set that up
entirely from a phone browser. On github.com, in this repository:

1. **Settings** → **Pages** (you may need "request desktop site" for the
   settings menu to appear).
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
3. Pick the branch holding this work and folder **/ (root)**, then **Save**.

A minute or so later the app is at:

```
https://<your-username>.github.io/<repository>/nullspace/
```

Pushes to that branch redeploy automatically. The `.nojekyll` file at the
repository root tells Pages to serve the files as they are instead of running
them through Jekyll.

Once it loads, use your browser's **Add to Home Screen**. There is a web app
manifest, so it installs with its own icon and opens without browser chrome,
which is worth a surprising amount of screen on a phone.

Note this makes the page reachable by anyone with the link. That is fine for
what it is — but each visitor's world, and any API key they enter, live only in
their own browser and are never part of the page.

#### With a computer

Serve it and connect over the same wifi:

```sh
cd nullspace
python3 -m http.server 8080 --bind 0.0.0.0
```

Then find the computer's LAN address (`ipconfig getifaddr en0` on macOS,
`hostname -I` on Linux, `ipconfig` on Windows) and visit
`http://<that-address>:8080` on the phone. Both devices need to be on the same
network, and some networks block this — a "guest" wifi usually will.

Two things worth knowing on mobile: the simulation runs off `requestAnimationFrame`,
so it pauses when you switch tabs or lock the screen and resumes where it left
off rather than fast-forwarding. And leaving it running at 10× will use battery
like any animated page.

## What you can do

- **Read the rooms.** Five servers, ~40 channels, and a few hundred messages of
  history already exist before you arrive.
- **Talk.** Post in any channel and someone will answer — if the whole server
  happens to be asleep, one member wakes up and checks their phone.
- **Click anyone.** Their profile shows the voice profile driving how they type,
  their traits, interests, disposition, closest relationships in the network,
  and how many messages they've sent.
- **Watch the machine think.** The *observer* tab logs every decision the
  simulation makes: who spoke, in which room, and the reason they were chosen —
  "kestrel → #devlog · someone left a question open · move: answer".
- **Change the clock.** Run at 0.5× to read along, or 10× to watch a week of
  community history compress into a couple of minutes.

## Optional: let Gemini do the writing

The **model** tab in the right-hand panel takes a Google Gemini API key. With
one saved, lines for the channel you are currently reading are written live by
the model instead of by the local generator. Everything else still comes from
the simulation — which agent speaks, their persona and mood, and which
conversational move they are making. The model only writes the words, and it is
given the persona's typing rules (casing, punctuation, emoji, length, shorthand)
so an agent still sounds like themselves.

Every other room keeps using the local generator, so quota is spent only on
what you are actually reading. Calls are capped at 15/minute with at most 2 in
flight; anything rate-limited, failed or timed out silently falls back to the
locally generated line, which was already written before the call was made. The
observer feed marks model-written lines with `· gemini`.

### About the key

- It is stored in this browser's `localStorage` on your machine, under a
  separate key from the world. It is **never** written into the saved world,
  never logged, and never committed.
- It is sent as an `x-goog-api-key` header rather than a query parameter, so it
  stays out of URLs and referrers.
- The input never displays it back — once saved you see only `AIza…7890
  (39 chars)`. Error messages are scrubbed of anything key-shaped before they
  reach the UI.
- **A key used from browser JavaScript is readable by anyone with access to
  that browser or its devtools.** That is inherent to calling the API directly
  from a page, not something this app can fix. Use a restricted key, don't
  point real billing at it, and revoke it if you are unsure. Routing calls
  through a small server-side proxy is the fix if you ever host this anywhere
  other than your own machine.
- "forget key" removes it and drops straight back to local generation.

The default model is `gemini-2.5-flash`, editable in the same panel — thinking
is disabled for the Flash family since a one-line chat message doesn't need it.
"test connection" does a one-token round trip and shows the API's actual error
if something is wrong.

## How it works

```
src/
  data/       content: interest domains, voice profiles, conversational moves
  model/      state: Agent, World, servers, channels, messages
  engine/     behaviour: genesis, dialogue, language, simulation, persistence
  ui/         rendering and interaction
```

**Agents** are the product of two independent axes. A *voice profile*
(`data/voice.js`) decides how someone types — casing, punctuation, typo rate,
abbreviations, emoji, message length, whether they send a second message right
after the first. An *interest domain* (`data/topics.js`) decides what they know:
each domain carries a lexicon plus pools of whole opinions, questions, gripes and
good news written in that community's own idiom. The same argument delivered by
`lowercase` and by `academic` is recognisably two different people.

**Conversations** are a state machine per channel, not a random message
generator. Each room tracks its current topic, how hot it is, who has spoken
recently, and whether a question is sitting unanswered. When the engine picks a
speaker it picks a *move* from that state — answer the open question, celebrate
the win that was just posted, push back on the take, ask for detail, derail
slightly — weighted by the speaker's personality. That's why threads hold
together: a question gets an answer, the answer gets agreement, the agreement
gets a joke.

**Language** is assembled in two passes. The dialogue engine produces a plain
lowercase sentence with the room's vocabulary filled in; `engine/language.js`
then renders it as a specific person typed it. Each channel remembers its recent
sentences so nobody repeats themselves in the same room.

**Relationships** move on every exchange. Agreeing warms two agents to each
other, disagreement cools them (less so between people who already like each
other), reactions nudge moods. Those numbers feed back into who replies to whom,
who gets @mentioned, who follows whom into a new server, and which pairs
eventually found one together and bring their friends.

**Time** is simulated, not real. Agents have a peak hour and a wakefulness curve
around it, so the network has a night shift, quiet mornings and busy evenings.
Typing indicators are real delays derived from each agent's words-per-minute and
the length of what they are about to say.

## Extending it

Adding a community is the cheapest way to change the world: append a domain to
`DOMAINS` in `src/data/topics.js` with its channels, lexicon, and the four
sentence pools (`takes`, `questions`, `gripes`, `wins`). Everything else —
server names, member routing, conversation, bios — picks it up automatically.

New personality types go in `VOICE_PROFILES` (`src/data/voice.js`); new
conversational moves go in `MOVES` (`src/data/moves.js`) and get wired into the
weighting in `chooseMove` (`src/engine/dialogue.js`).

The live world is exposed as `window.nullspace` for poking at from the console.
