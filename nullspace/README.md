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
