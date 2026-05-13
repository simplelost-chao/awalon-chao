#!/usr/bin/env python3
"""
Generate 10 AI avatar images via Doubao Seedream 5.0 and upload to server.
"""
import urllib.request
import json
import base64
import os
import time

API_KEY = 'ark-760ac07f-94d8-4b50-9759-2ec350b69521-3e5ad'
ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
MODEL = 'doubao-seedream-5-0-260128'

STYLE = (
    "Single character bust portrait. ART STYLE: dark fantasy oil painting — "
    "smooth painterly brushwork, realistic facial anatomy, dramatic chiaroscuro lighting, "
    "warm amber and gold tones on deep navy-charcoal background. "
    "Square 1:1. Head and upper chest only, face filling 70-80% of frame, "
    "bottom 20% fades to near-black. No text, no labels, no watermarks."
)

CHARACTERS = [
    ("ai-01-wizard",
     "Ancient wizard — hollow gaunt face, long white beard, deep-set amber-glowing eyes, "
     "dark star-rune robes, worn pointed hat with crescent moon emblem. "
     "Royal purple accents on robe trim and eye glow."),

    ("ai-02-knight",
     "Noble Arthurian knight — battered iron full helmet with gold cross crest, "
     "blue glowing eye slits, silver chainmail gorget, earnest honorable bearing. "
     "Steel blue and gold accents on helmet and cross."),

    ("ai-03-assassin",
     "Silent assassin — deep black leather hood pulled low, only cold hollow eyes visible, "
     "dark bandage wrappings around the jaw, faint scar below the left eye. "
     "Deep crimson accents on eye glint and hood lining."),

    ("ai-04-noble",
     "Arrogant medieval noble lord — ornate golden crown with dark gems, "
     "sharp angular jaw, cold calculating eyes, rich fur-trimmed deep burgundy cloak. "
     "Gold and crimson accents on crown and collar."),

    ("ai-05-archer",
     "Forest archer — deep green hood, lean weathered face, thin scar across cheek, "
     "piercing green eyes, quiver strap over shoulder. "
     "Forest green accents on hood edge and eye highlights."),

    ("ai-06-mage",
     "Arcane mage — wide-brimmed purple hat, intense glowing violet eyes, "
     "silver arcane sigil on forehead, dark flowing robes with constellation patterns. "
     "Violet and silver accents on eyes and sigil."),

    ("ai-07-paladin",
     "Holy paladin — closed full helmet, large gold cross emblem on forehead, "
     "warm divine light radiating behind the helmet's eye slits, heavy pauldrons with sun motif. "
     "Bright gold and ivory accents on cross and armor."),

    ("ai-08-witch",
     "Forest witch — long dark hair framing a pale angular face, sharp green eyes, "
     "a small serpent coiled at the shoulder, dark emerald robes with bone-clasp. "
     "Emerald green accents on eyes and serpent scales."),

    ("ai-09-guard",
     "Seasoned castle guard — worn bronze plate armor, strong square jaw, "
     "short dark beard with grey streaks, stern loyal expression, thick pauldron. "
     "Bronze and amber accents on armor plates."),

    ("ai-10-oracle",
     "Mysterious oracle — dark silk blindfold over the eyes with faint star-map embroidery, "
     "silver-white hair, ethereal calm face, flowing midnight-blue robes with celestial motifs. "
     "Silver and deep blue accents on blindfold stars and robe."),
]

OUT_DIR = '/tmp/ai-avatars'
os.makedirs(OUT_DIR, exist_ok=True)

def call_doubao(prompt):
    body = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "size": "1920x1920",
    }).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}',
        },
        method='POST'
    )
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise ValueError(f"HTTP {e.code}: {body}")
    item = data['data'][0]
    if 'b64_json' in item and item['b64_json']:
        return base64.b64decode(item['b64_json'])
    if 'url' in item and item['url']:
        print(f"  → fetching image URL...")
        with urllib.request.urlopen(item['url'], timeout=60) as r:
            return r.read()
    raise ValueError(f"No image data in response: {item}")

failed = []
for name, char_desc in CHARACTERS:
    out_path = os.path.join(OUT_DIR, f'{name}.jpg')
    if os.path.exists(out_path):
        print(f"✓ {name} already exists, skipping")
        continue
    prompt = f"{STYLE} CHARACTER: {char_desc}"
    print(f"⏳ Generating {name}...")
    try:
        img_bytes = call_doubao(prompt)
        with open(out_path, 'wb') as f:
            f.write(img_bytes)
        print(f"✓ Saved {name}.jpg ({len(img_bytes)//1024}KB)")
    except Exception as e:
        print(f"✗ FAILED {name}: {e}")
        failed.append(name)
    time.sleep(1)  # rate limit

print("\n=== Done ===")
if failed:
    print(f"Failed: {failed}")
else:
    print("All 10 avatars generated successfully!")
print(f"Files in: {OUT_DIR}")
