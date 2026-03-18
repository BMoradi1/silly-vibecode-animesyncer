# Penguin Bot 🐧

A Python bot that connects to a Yukon Club Penguin private server and says
random nonsense in chat.

## Requirements

Python 3.8+ — no external packages needed.

## Usage

```bash
# Set your credentials and server details
export CP_HOST=yukon.club
export CP_PORT=6112
export CP_USER=YourPenguinName
export CP_PASS=yourpassword
export CP_ROOM=100          # 100 = Town

python bot.py
```

## Config (env vars)

| Variable    | Default          | Description                      |
|-------------|------------------|----------------------------------|
| `CP_HOST`   | `yukon.club`     | Server hostname                  |
| `CP_PORT`   | `6112`           | Server port                      |
| `CP_USER`   | `CoolPenguin123` | Penguin username                 |
| `CP_PASS`   | `hunter2`        | Penguin password                 |
| `CP_ROOM`   | `100`            | Room ID to join (100 = Town)     |
| `MIN_DELAY` | `8`              | Min seconds between messages     |
| `MAX_DELAY` | `20`             | Max seconds between messages     |

## Notes

- Uses the standard Club Penguin XML + XT protocol used by most AS2-era private servers.
- 20% of the time it sends a random emote instead of a message.
- Sends a heartbeat packet every 30 s to avoid being kicked for idling.
- The password is double-MD5 hashed the same way the original CP client did it.
