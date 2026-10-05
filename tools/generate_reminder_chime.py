"""Writes the reminder notification sound (a short three-note chime).

Run: python tools/generate_reminder_chime.py
Output: android/app/src/main/res/raw/reminder_chime.wav

To use your own sound instead, replace that file with any short WAV/MP3/OGG of
the same name (lowercase, no spaces) and rebuild. If the sound of an already
installed app must change, also change REMINDER_CHANNEL_ID in
src/services/notifications/NotifeeNotifications.ts: Android keeps a channel's
sound fixed once the channel exists.
"""
import math
import os
import struct
import wave

RATE = 44100
NOTES = [(1046.50, 0.00), (1318.51, 0.16), (1567.98, 0.32)]  # C6, E6, G6
LENGTH = 1.3
OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'android', 'app', 'src', 'main', 'res', 'raw', 'reminder_chime.wav',
)


def sample(t: float) -> float:
    total = 0.0
    for freq, start in NOTES:
        dt = t - start
        if dt < 0:
            continue
        attack = min(1.0, dt / 0.005)
        decay = math.exp(-dt * 4.2)
        tone = math.sin(2 * math.pi * freq * dt) + 0.25 * math.sin(
            2 * math.pi * freq * 2 * dt
        )
        total += attack * decay * tone
    return total


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    count = int(RATE * LENGTH)
    samples = [sample(i / RATE) for i in range(count)]
    peak = max(abs(s) for s in samples) or 1.0
    with wave.open(OUT, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(
            b''.join(struct.pack('<h', int(s / peak * 0.8 * 32767)) for s in samples)
        )
    print('wrote', OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
