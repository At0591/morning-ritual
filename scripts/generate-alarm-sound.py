"""Generate a simple alarm sound WAV (880Hz + 1100Hz beeps).

CC0 — public domain. Generated programmatically, no licensing concerns.
"""
import math
import struct
import wave
import os

OUT_DIR = r"C:\Users\aksha\OneDrive\Documents\Alarm App\morning-ritual\assets\sounds"
os.makedirs(OUT_DIR, exist_ok=True)
OUT_PATH = os.path.join(OUT_DIR, "alarm.wav")

SAMPLE_RATE = 22050
DURATION = 1.2  # seconds
NUM_SAMPLES = int(SAMPLE_RATE * DURATION)
samples = []

for i in range(NUM_SAMPLES):
    t = i / SAMPLE_RATE
    beep = 0.0
    # Two short beeps with envelope
    if 0.0 <= t < 0.4:
        beep = math.sin(2 * math.pi * 880 * t)
    elif 0.5 <= t < 0.9:
        beep = math.sin(2 * math.pi * 1100 * (t - 0.5))

    # Apply envelope (fade in / fade out to avoid clicks)
    env = 1.0
    if t < 0.05:
        env = t / 0.05
    elif 0.35 < t < 0.40:
        env = (0.40 - t) / 0.05
    elif 0.50 < t < 0.55:
        env = (t - 0.50) / 0.05
    elif 0.85 < t < 0.90:
        env = (0.90 - t) / 0.05
    elif 0.4 <= t < 0.5 or 0.9 <= t:
        env = 0.0  # silence between beeps

    samples.append(int(beep * env * 16000))

# Write WAV
with wave.open(OUT_PATH, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SAMPLE_RATE)
    w.writeframes(struct.pack(f"<{len(samples)}h", *samples))

print(f"Wrote {len(samples)} samples to {OUT_PATH}")
print(f"File size: {os.path.getsize(OUT_PATH)} bytes")
