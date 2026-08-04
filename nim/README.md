# nim

Networked 1v1 [misère Nim](https://en.wikipedia.org/wiki/Nim). Rows of 1, 3,
5, and 7 glowing platonic solids; on your turn, click a piece to take it and
everything to its right in that row. Whoever takes the **last** piece loses.

No menus: open the page, click *copy invite link*, send it to your opponent.
The moment they open it, the game starts. Rematch is one click and alternates
who moves first.

## How it works

All game logic runs client-side. Matchmaking uses the free public
[PeerJS](https://peerjs.com) cloud broker to set up a WebRTC data channel;
after the handshake, moves travel peer-to-peer. Both sides validate every
move, so there is no server and no stored state. three.js (CDN) renders the
scene — wireframe solids through a bloom pass, a spring-mass grid fabric that
ripples when pieces explode, and a GPU particle pool. The techno soundtrack is
synthesized live with WebAudio (no audio files); it layers up as the board
empties. Sound starts on your first click, per browser autoplay rules.

Unlike the other toys here, this one needs the internet: three.js and PeerJS
load from jsdelivr, and matchmaking needs the PeerJS cloud. It still runs from
`file://` with no build or server. One caveat when running from a local file:
the copied invite link contains *your* file path, so it works as-is for a
second tab on your machine (or when hosted on the web), but a remote friend
with their own copy should append the `#...` fragment to their own URL.
Restrictive NATs (no TURN relay on the free tier) can occasionally prevent a
connection — the status line will say so.
