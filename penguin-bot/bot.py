#!/usr/bin/env python3
"""
Yukon Club Penguin Private Server Bot
Connects to a CP private server and spams random nonsense in chat.
"""

import socket
import time
import random
import hashlib
import logging
import sys
import threading

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("penguin-bot")

# ── Config (override via env or edit here) ───────────────────────────────────
import os

HOST     = os.getenv("CP_HOST", "yukon.club")
PORT     = int(os.getenv("CP_PORT", "6112"))
USERNAME = os.getenv("CP_USER", "CoolPenguin123")
PASSWORD = os.getenv("CP_PASS", "hunter2")
ROOM_ID  = int(os.getenv("CP_ROOM", "100"))   # 100 = Town
MIN_DELAY = float(os.getenv("MIN_DELAY", "8"))
MAX_DELAY = float(os.getenv("MAX_DELAY", "20"))
# ─────────────────────────────────────────────────────────────────────────────

RANDOM_MESSAGES = [
    "yo has anyone seen my pizza",
    "im a ninja dont tell anyone",
    "puffles are just dogs with anxiety",
    "the iceberg is definitely gonna tip i believe",
    "bro the ski lodge is haunted i swear",
    "gary invented the pizza but no one talks about it",
    "one time i saw a mod and i ran",
    "my igloo is bigger than your igloo no cap",
    "the mine is just a vibe honestly",
    "club penguin lore goes so hard",
    "herbert p bear was right about everything",
    "i survived the meteor shower with no therapy",
    "free items in the gift shop!! (there aren't)",
    "did you know penguins can't taste pizza? false they love it",
    "the coffee shop coffee hits different at 2am",
    "been here since beta and still no free membership smh",
    "the dojo master sensei is literally immortal think about it",
    "snow forts is where the real beef happens",
    "i threw a snowball at a moderator once, worth it",
    "penguins have bones right? asking for a friend",
    "the lighthouse has wifi i checked",
    "card jitsu water was peak content",
    "if the island is floating where are we floating to",
    "my penguin runs on pure pizza and existential dread",
    "the everyday phoning facility isn't subtle at all",
    "elite penguin force rise up",
    "i have 47 puffles and zero regrets",
    "the plaza fountain is just a wishing well that ignores you",
    "captain rockhopper has never paid taxes",
    "i am become snowball, destroyer of frames",
]

EMOTES = [
    "e|1",   # wave
    "e|2",   # laugh
    "e|4",   # sad
    "e|5",   # surprised
    "e|6",   # sick
    "e|9",   # coffee
    "e|21",  # pizza
    "e|23",  # music note
    "e|26",  # igloo
    "e|40",  # puffle
]


def md5(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()


class PenguinBot:
    def __init__(self):
        self.sock = None
        self.penguin_id = None
        self._recv_buf = ""

    # ── low-level I/O ─────────────────────────────────────────────────────

    def connect(self):
        log.info("Connecting to %s:%d", HOST, PORT)
        self.sock = socket.create_connection((HOST, PORT), timeout=30)
        self.sock.settimeout(60)
        log.info("Connected")

    def send_raw(self, data: str):
        pkt = data + "\x00"
        log.debug(">> %s", data)
        self.sock.sendall(pkt.encode())

    def recv_line(self) -> str:
        while "\x00" not in self._recv_buf:
            chunk = self.sock.recv(4096).decode("utf-8", errors="replace")
            if not chunk:
                raise ConnectionError("Server closed connection")
            self._recv_buf += chunk
        line, self._recv_buf = self._recv_buf.split("\x00", 1)
        log.debug("<< %s", line)
        return line.strip()

    def recv_until(self, needle: str, timeout: float = 15.0) -> str:
        deadline = time.time() + timeout
        while time.time() < deadline:
            self.sock.settimeout(max(0.5, deadline - time.time()))
            line = self.recv_line()
            if needle in line:
                return line
        raise TimeoutError(f"Timed out waiting for: {needle}")

    # ── Club Penguin XML protocol ──────────────────────────────────────────

    def handshake(self):
        """Initial policy / version handshake."""
        self.send_raw("<policy-file-request/>")
        self.recv_until("cross-domain-policy")

        self.send_raw(
            "<msg t='sys'><body action='verChk' r='0'>"
            "<ver v='153' /></body></msg>"
        )
        self.recv_until("apiOK")

    def login(self):
        """Send login credentials and grab the login key."""
        hashed_pw = md5(md5(PASSWORD).upper() + "≡")  # standard CP hash trick

        self.send_raw(
            f"<msg t='sys'><body action='login' r='0'>"
            f"<login z='w1'>"
            f"<nick><![CDATA[{USERNAME}]]></nick>"
            f"<pword><![CDATA[{hashed_pw}]]></pword>"
            f"</login></body></msg>"
        )

        resp = self.recv_until("login", timeout=20)
        # Parse penguin id from response
        if "redir" in resp or "e=" in resp:
            raise ConnectionError(f"Login failed: {resp}")

        # grab id between |
        try:
            parts = resp.split("|")
            self.penguin_id = parts[8]
            login_key = parts[1]
            log.info("Logged in as penguin id=%s", self.penguin_id)
        except (IndexError, ValueError):
            log.warning("Could not parse login response, continuing anyway: %s", resp)
            login_key = ""

        return login_key

    def join_world(self, login_key: str):
        """Connect to the game world server (same host for most private servers)."""
        self.send_raw(
            f"%xt%s%-1%{self.penguin_id or USERNAME}%{login_key}%"
        )
        self.recv_until("js", timeout=15)

    def join_room(self, room_id: int = ROOM_ID):
        log.info("Joining room %d", room_id)
        self.send_raw(f"%xt%j#jr%-1%{room_id}%0%0%")
        self.recv_until("jr", timeout=15)
        log.info("Joined room %d", room_id)

    def send_message(self, msg: str):
        safe = msg.replace("%", "").replace("\x00", "")
        self.send_raw(f"%xt%s#sm%-1%{safe}%")

    def send_emote(self, emote: str):
        self.send_raw(f"%xt%s#se%-1%{emote}%")

    # ── main loop ─────────────────────────────────────────────────────────

    def spam_loop(self):
        log.info("Starting spam loop (delay %.0f–%.0fs)", MIN_DELAY, MAX_DELAY)
        while True:
            delay = random.uniform(MIN_DELAY, MAX_DELAY)
            time.sleep(delay)

            # 20 % chance to throw an emote instead
            if random.random() < 0.20:
                emote = random.choice(EMOTES)
                log.info("Sending emote: %s", emote)
                self.send_emote(emote)
            else:
                msg = random.choice(RANDOM_MESSAGES)
                log.info("Saying: %s", msg)
                self.send_message(msg)

    def _keepalive_loop(self):
        """Send an xt heartbeat every 30 s so the server doesn't kick us."""
        while True:
            time.sleep(30)
            try:
                self.send_raw("%xt%s#h%-1%%")
            except Exception:
                break

    def run(self):
        self.connect()
        self.handshake()
        login_key = self.login()
        self.join_world(login_key)
        self.join_room(ROOM_ID)

        # keepalive in background thread
        t = threading.Thread(target=self._keepalive_loop, daemon=True)
        t.start()

        self.spam_loop()


# ── entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    bot = PenguinBot()
    try:
        bot.run()
    except KeyboardInterrupt:
        log.info("Bot stopped by user.")
        sys.exit(0)
    except Exception as e:
        log.error("Fatal: %s", e)
        sys.exit(1)
