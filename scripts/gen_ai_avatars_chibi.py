#!/usr/bin/env python3
"""
Generate 10 AI avatar images in chibi cartoon style via Doubao Seedream 5.0.
"""
import urllib.request
import urllib.error
import json
import os
import time

API_KEY = 'ark-760ac07f-94d8-4b50-9759-2ec350b69521-3e5ad'
ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
MODEL = 'doubao-seedream-5-0-260128'

STYLE = (
    "chibi anime character card portrait, cute super-deformed (SD) proportions with big round head and small body, "
    "clean cel-shaded 2D illustration, thick black outlines, vivid saturated warm colors, "
    "medieval fantasy costume and accessories, character fills the entire square frame — "
    "head takes up top 60% of the frame, shoulders and upper chest at the bottom, "
    "warm golden amber radiant gradient background with soft glowing light rays behind the character, "
    "Chinese mobile RPG card game character art style similar to Clash Royale, "
    "expressive cheerful or fierce face, large bright shiny anime eyes, "
    "square 1:1 composition, no text, no watermark, no UI elements."
)

CHARACTERS = [
    ("ai-01-wizard",
     "Ancient old wizard: long white beard, tall pointed dark blue star-patterned wizard hat with crescent moon badge, "
     "long dark purple star-embroidered robes, wise glowing amber eyes, gentle mysterious expression. "
     "Color palette: deep navy, purple, gold stars."),

    ("ai-02-knight",
     "Noble Arthurian knight: full iron helmet with gold cross crest on the front, "
     "bright blue glowing eye slits, silver chainmail collar, earnest honorable bearing. "
     "Color palette: silver gray metal, gold cross, blue glow."),

    ("ai-03-assassin",
     "Agile assassin: deep black hood pulled low over the head, only cold crimson eyes visible, "
     "dark bandage wrappings across the lower face, dark leather vest. "
     "Color palette: jet black, crimson red eye glint."),

    ("ai-04-noble",
     "Arrogant prince: ornate gold crown with red gems, sharp stylish dark hair, "
     "cold golden eyes with a slight smirk, rich burgundy fur-trimmed royal cape. "
     "Color palette: deep burgundy, gold, dark hair."),

    ("ai-05-archer",
     "Forest ranger archer: deep forest green hood, lean face with a thin scar on the cheek, "
     "bright green eyes, brown leather quiver strap across shoulder, confident expression. "
     "Color palette: forest green, brown leather, bright green eyes."),

    ("ai-06-mage",
     "Elegant court mage: wide-brimmed purple witch hat with star pin, "
     "glowing violet eyes, silver arcane sigil on forehead, dark robes with purple constellation trim. "
     "Color palette: deep purple, violet glow, silver details."),

    ("ai-07-paladin",
     "Holy paladin: full dark blue closed helmet with large gold cross emblem on the forehead, "
     "warm golden divine light glowing from the eye slits, sun motif pauldrons. "
     "Color palette: dark navy armor, bright gold cross, warm amber glow."),

    ("ai-08-witch",
     "Enchanting forest witch: long flowing dark hair, sharp green eyes, "
     "a small green serpent coiled on the shoulder, deep emerald robes with bone clasp. "
     "Color palette: dark emerald green, pale skin, bright green eyes, dark hair."),

    ("ai-09-guard",
     "Seasoned castle guard: worn bronze plate helmet pushed up to show face, "
     "strong square jaw, short dark beard with grey streaks, stern loyal expression, heavy pauldrons. "
     "Color palette: bronze armor, warm brown tones, grey beard."),

    ("ai-10-oracle",
     "Mysterious oracle: dark silk blindfold embroidered with silver constellation star patterns, "
     "flowing silver-white hair, ethereal serene expression, deep midnight-blue robes with celestial motifs. "
     "Color palette: midnight blue, silver stars, white hair."),
]

OUT_DIR = '/tmp/ai-avatars-chibi2'
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
        body_err = e.read().decode()
        raise ValueError(f"HTTP {e.code}: {body_err}")

    item = data['data'][0]
    if 'b64_json' in item and item['b64_json']:
        import base64
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
    time.sleep(1)

print("\n=== Generation Done ===")
if failed:
    print(f"Failed: {failed}")
else:
    print("All 10 avatars generated!")

# Crop watermark (bottom 12%) and resize to 512x512
print("\n=== Cropping & resizing ===")
try:
    from PIL import Image
    CROP_DIR = '/tmp/ai-avatars-chibi2-final'
    os.makedirs(CROP_DIR, exist_ok=True)
    for name, _ in CHARACTERS:
        src = os.path.join(OUT_DIR, f'{name}.jpg')
        dst = os.path.join(CROP_DIR, f'{name}.jpg')
        if not os.path.exists(src):
            print(f"  skip {name} (not generated)")
            continue
        img = Image.open(src)
        w, h = img.size
        new_h = int(h * 0.88)
        cropped = img.crop((0, 0, w, new_h))
        final = cropped.resize((512, 512), Image.LANCZOS)
        final.save(dst, 'JPEG', quality=90)
        print(f"  ✓ {name}.jpg → {os.path.getsize(dst)//1024}KB")
    print(f"\nFinal files in: {CROP_DIR}")
except ImportError:
    print("PIL not available, skipping crop step")
    print(f"Raw files in: {OUT_DIR}")
