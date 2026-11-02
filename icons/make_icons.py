import sys
from PIL import Image, ImageDraw

out = sys.argv[1]
S = 1024
BG, WHITE, RED, DARK = (38, 50, 56, 255), (255, 255, 255, 255), (229, 57, 53, 255), (38, 50, 56, 255)

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

d.rounded_rectangle((0, 0, S - 1, S - 1), radius=220, fill=BG)                 # Hintergrund
d.rounded_rectangle((180, 240, 844, 850), radius=80, fill=RED)                  # Kalender (Kopfzeile rot)
d.rounded_rectangle((180, 420, 844, 850), radius=80, fill=WHITE)                # Kalenderblatt
d.rectangle((180, 420, 844, 500), fill=WHITE)                                   # obere Ecken des Blatts eckig
for x in (330, 634):                                                            # Ringe
    d.rounded_rectangle((x, 160, x + 60, 330), radius=30, fill=WHITE)
    d.rounded_rectangle((x + 12, 172, x + 48, 318), radius=18, fill=DARK)
d.polygon([(432, 520), (432, 760), (632, 640)], fill=RED)                       # Play-Dreieck

for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(f'{out}/icon{size}.png')
