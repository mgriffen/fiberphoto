#!/usr/bin/env python3
"""Generate Google Play Store assets for FiberPhoto."""

from PIL import Image, ImageDraw, ImageFont
import math
import os

OUT = "/mnt/c/Users/mgrif/Downloads/play-store-assets"
os.makedirs(OUT, exist_ok=True)

# Fonts
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(size, bold=True):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)

# Brand colors (from mockup)
NAVY = (26, 35, 50)
NAVY_LIGHT = (35, 52, 78)
TEAL = (45, 120, 140)
TEAL_LIGHT = (60, 160, 180)
ACCENT_BLUE = (37, 99, 235)
WHITE = (255, 255, 255)
GREEN_CHECK = (22, 163, 74)
ORANGE = (234, 136, 12)
GRAY_BG = (240, 242, 245)
GRAY_TEXT = (107, 114, 128)
SURFACE = (255, 255, 255)
BORDER = (229, 231, 235)

def draw_rounded_rect(draw, box, fill, radius=20):
    """Draw a rounded rectangle."""
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=radius, fill=fill)

def draw_gradient_rect(img, box, color_top, color_bottom):
    """Draw a vertical gradient rectangle."""
    x0, y0, x1, y1 = box
    draw = ImageDraw.Draw(img)
    for y in range(y0, y1):
        ratio = (y - y0) / max(1, (y1 - y0 - 1))
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * ratio)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * ratio)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * ratio)
        draw.line([(x0, y), (x1, y)], fill=(r, g, b))

def draw_camera_lens(draw, cx, cy, r):
    """Draw a stylized camera lens."""
    # Outer ring
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(60, 70, 90), outline=(80, 90, 110), width=3)
    # Inner dark
    inner_r = int(r * 0.75)
    draw.ellipse([cx-inner_r, cy-inner_r, cx+inner_r, cy+inner_r], fill=(20, 25, 35))
    # Highlight ring
    hl_r = int(r * 0.65)
    draw.ellipse([cx-hl_r, cy-hl_r, cx+hl_r, cy+hl_r], fill=(40, 50, 70), outline=(70, 90, 120), width=2)
    # Center glass
    glass_r = int(r * 0.45)
    draw.ellipse([cx-glass_r, cy-glass_r, cx+glass_r, cy+glass_r], fill=(30, 80, 110))
    # Reflection
    ref_r = int(r * 0.2)
    draw.ellipse([cx-ref_r-int(r*0.15), cy-ref_r-int(r*0.15), cx+ref_r-int(r*0.15), cy+ref_r-int(r*0.15)],
                 fill=(80, 140, 170, 150))

def draw_location_pin(draw, cx, cy, size):
    """Draw a location pin icon."""
    # Pin body
    r = size // 2
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=TEAL_LIGHT)
    # Pin point
    draw.polygon([(cx-r//2, cy+r//2), (cx, cy+size), (cx+r//2, cy+r//2)], fill=TEAL_LIGHT)
    # Inner circle
    ir = r // 3
    draw.ellipse([cx-ir, cy-ir, cx+ir, cy+ir], fill=WHITE)

def draw_fiber_photo_placeholder(draw, x, y, w, h):
    """Draw a stylized fiber infrastructure image placeholder."""
    # Concrete box
    draw.rounded_rectangle([x, y, x+w, y+h], radius=8, fill=(160, 155, 140))
    # Inner dark area (the box opening)
    margin = int(w * 0.1)
    draw.rounded_rectangle([x+margin, y+margin, x+w-margin, y+h-margin], radius=4, fill=(60, 55, 45))
    # Green conduits
    conduit_y = y + h // 2
    for i in range(3):
        cx = x + margin + 15 + i * int(w * 0.12)
        draw.ellipse([cx, conduit_y-8, cx+16, conduit_y+8], fill=(30, 140, 60))
    # Orange conduits
    for i in range(2):
        cx = x + w // 2 + i * int(w * 0.12)
        draw.ellipse([cx, conduit_y+10, cx+14, conduit_y+26], fill=(220, 140, 30))
    # Fiber strands
    draw.line([(x+margin+10, conduit_y-5), (x+w-margin-10, conduit_y+5)], fill=(40, 180, 80), width=2)
    draw.line([(x+margin+10, conduit_y+15), (x+w-margin-10, conduit_y+20)], fill=(220, 160, 30), width=2)

def draw_check(draw, x, y, size, color=GREEN_CHECK):
    """Draw a checkmark."""
    draw.rounded_rectangle([x, y, x+size, y+size], radius=4, fill=color)
    # Checkmark
    s = size
    draw.line([(x+s*0.2, y+s*0.5), (x+s*0.4, y+s*0.7)], fill=WHITE, width=max(2, size//8))
    draw.line([(x+s*0.4, y+s*0.7), (x+s*0.8, y+s*0.25)], fill=WHITE, width=max(2, size//8))

def draw_badge(draw, x, y, text, bg_color, text_color=WHITE, f=None):
    """Draw a pill badge."""
    if f is None:
        f = font(14)
    bbox = f.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pad_x, pad_y = 10, 4
    draw.rounded_rectangle([x, y, x+tw+pad_x*2, y+th+pad_y*2], radius=10, fill=bg_color)
    draw.text((x+pad_x, y+pad_y-2), text, fill=text_color, font=f)
    return tw + pad_x * 2

def draw_type_pill(draw, x, y, text, f=None):
    """Draw a structure type pill like the app."""
    colors_map = {
        'HH': ((239, 246, 255), (37, 99, 235), (147, 197, 253)),
        'FP': ((236, 253, 245), (5, 150, 105), (110, 231, 183)),
        'BP': ((255, 247, 237), (234, 88, 12), (253, 186, 116)),
    }
    abbrev = text[:2]
    bg, txt, border = colors_map.get(abbrev, colors_map['HH'])
    if f is None:
        f = font(13, bold=True)
    bbox = f.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pad_x, pad_y = 8, 3
    draw.rounded_rectangle([x, y, x+tw+pad_x*2, y+th+pad_y*2], radius=10, fill=bg, outline=border, width=1)
    draw.text((x+pad_x, y+pad_y-1), text, fill=txt, font=f)
    return tw + pad_x * 2


# ================================================================
# 1. APP ICON (512x512)
# ================================================================
def create_app_icon():
    img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background with gradient
    draw_gradient_rect(img, (0, 0, 512, 512), (35, 65, 90), NAVY)
    draw = ImageDraw.Draw(img)

    # Rounded corners mask
    mask = Image.new('L', (512, 512), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, 511, 511], radius=90, fill=255)

    # Camera lens (top right area)
    draw_camera_lens(draw, 350, 130, 80)

    # Location pin (top left)
    draw_location_pin(draw, 80, 60, 40)

    # Fiber photo area (center)
    draw_fiber_photo_placeholder(draw, 50, 160, 260, 160)

    # Record overlay card (bottom of photo area)
    draw.rounded_rectangle([60, 280, 300, 370], radius=8, fill=(255, 255, 255, 230))
    draw.text((75, 286), "HH 17x30", fill=NAVY, font=font(22))

    # SC badge
    draw_check(draw, 75, 318, 20, GREEN_CHECK)
    w = draw_badge(draw, 100, 315, "SC", GREEN_CHECK, WHITE, font(13))
    # Terminal badge
    draw_badge(draw, 100 + w + 8, 315, "T 2.13", (124, 58, 237), WHITE, font(13))

    # App name
    draw.text((50, 400), "FiberPhoto", fill=WHITE, font=font(64))

    # Subtle tagline
    draw.text((55, 468), "Field Documentation", fill=(180, 200, 220), font=font(18, bold=False))

    # Apply rounded corner mask
    img.putalpha(mask)

    img.save(os.path.join(OUT, "app_icon_512.png"), "PNG")
    print("Created app_icon_512.png")


# ================================================================
# 2. FEATURE GRAPHIC (1024x500)
# ================================================================
def create_feature_graphic():
    img = Image.new('RGB', (1024, 500), NAVY)
    draw_gradient_rect(img, (0, 0, 1024, 500), (30, 55, 80), NAVY)
    draw = ImageDraw.Draw(img)

    # Left side: phone mockup area with fiber photo
    # Phone frame
    phone_x, phone_y = 40, 30
    phone_w, phone_h = 280, 440
    draw.rounded_rectangle([phone_x, phone_y, phone_x+phone_w, phone_y+phone_h],
                          radius=20, fill=(50, 60, 75), outline=(80, 90, 110), width=2)
    # Screen area
    sx, sy = phone_x+10, phone_y+30
    sw, sh = phone_w-20, phone_h-50
    draw.rounded_rectangle([sx, sy, sx+sw, sy+sh], radius=8, fill=GRAY_BG)

    # Header bar
    draw.rectangle([sx, sy, sx+sw, sy+45], fill=NAVY)
    draw.text((sx+12, sy+10), "DA001-014", fill=WHITE, font=font(18))

    # Photo placeholder
    draw_fiber_photo_placeholder(draw, sx+15, sy+55, sw-30, 140)

    # Record info
    draw.text((sx+15, sy+210), "HH 17x30", fill=NAVY, font=font(20))
    draw_check(draw, sx+15, sy+240, 18, GREEN_CHECK)
    w = draw_badge(draw, sx+38, sy+237, "SC", GREEN_CHECK, WHITE, font(12))
    draw_badge(draw, sx+38+w+6, sy+237, "T 2.13", (124, 58, 237), WHITE, font(12))

    # Notes area
    draw.text((sx+15, sy+270), "Confirmed terminal inside.", fill=GRAY_TEXT, font=font(12, bold=False))

    # Right side: branding and features
    rx = 380

    # Camera lens decoration
    draw_camera_lens(draw, 960, 70, 50)

    # App title
    draw.text((rx, 50), "FiberPhoto", fill=WHITE, font=font(56))

    # Subtitle
    draw.text((rx, 120), "Document Fiber Infrastructure", fill=(140, 170, 200), font=font(22, bold=False))

    # Feature checklist
    features = [
        "Take Field Photos",
        "Tag with Box Type & Equipment",
        "Export with Data",
        "Works Fully Offline",
    ]

    fy = 190
    for feat in features:
        draw_check(draw, rx, fy, 28, GREEN_CHECK)
        draw.text((rx + 38, fy + 2), feat, fill=WHITE, font=font(22, bold=False))
        fy += 48

    # Bottom tagline
    draw.text((rx, 420), "MCN Field Documentation Tool", fill=(100, 130, 160), font=font(16, bold=False))

    img.save(os.path.join(OUT, "feature_graphic_1024x500.png"), "PNG")
    print("Created feature_graphic_1024x500.png")


# ================================================================
# 3. PHONE SCREENSHOTS (1080x1920, 9:16)
# ================================================================

def draw_status_bar(draw, w, y=0):
    """Draw a minimal phone status bar."""
    draw.rectangle([0, y, w, y+36], fill=NAVY)
    draw.text((20, y+8), "9:41", fill=WHITE, font=font(14))
    # Battery/signal indicators
    draw.rectangle([w-60, y+12, w-20, y+24], outline=WHITE, width=1)
    draw.rectangle([w-58, y+14, w-35, y+22], fill=WHITE)

def create_screenshot_welcome():
    """Screenshot 1: Welcome / sign-in screen."""
    W, H = 1080, 1920
    img = Image.new('RGB', (W, H), NAVY)
    draw = ImageDraw.Draw(img)

    draw_status_bar(draw, W)

    # Header area
    draw.text((W//2 - 180, 200), "FiberPhoto", fill=WHITE, font=font(72))
    draw.text((W//2 - 210, 290), "MCN Field Documentation Tool", fill=(140, 170, 200), font=font(26, bold=False))

    # Body card area
    body_y = 400
    draw.rounded_rectangle([0, body_y, W, H], radius=30, fill=GRAY_BG)
    draw = ImageDraw.Draw(img)

    # Field Technician section
    sy = body_y + 50
    draw.text((50, sy), "FIELD TECHNICIAN", fill=GRAY_TEXT, font=font(18))
    draw.rounded_rectangle([50, sy+35, W-200, sy+90], radius=12, fill=SURFACE, outline=BORDER, width=2)
    draw.text((70, sy+48), "Griffen", fill=NAVY, font=font(22, bold=False))
    # Save button
    draw.rounded_rectangle([W-180, sy+35, W-50, sy+90], radius=12, fill=ACCENT_BLUE)
    draw.text((W-145, sy+48), "Save", fill=WHITE, font=font(20))
    draw.text((50, sy+100), "Signed in as: Griffen", fill=GREEN_CHECK, font=font(18))

    # Starting Sequence section
    sy += 160
    draw.text((50, sy), "STARTING SEQUENCE NUMBER", fill=GRAY_TEXT, font=font(18))
    draw.rounded_rectangle([50, sy+35, W-200, sy+90], radius=12, fill=SURFACE, outline=BORDER, width=2)
    draw.text((70, sy+48), "573", fill=NAVY, font=font(22, bold=False))
    draw.rounded_rectangle([W-180, sy+35, W-50, sy+90], radius=12, fill=ACCENT_BLUE)
    draw.text((W-135, sy+48), "Set", fill=WHITE, font=font(20))
    draw.text((50, sy+100), "Next new record starts at #573", fill=GREEN_CHECK, font=font(18))

    # Divider
    sy += 160
    draw.line([(50, sy), (W-50, sy)], fill=BORDER, width=2)

    # Create New DA
    sy += 20
    draw.text((50, sy), "CREATE NEW DA", fill=GRAY_TEXT, font=font(18))
    draw.rounded_rectangle([50, sy+35, W-50, sy+90], radius=12, fill=SURFACE, outline=BORDER, width=2)
    draw.text((70, sy+48), "DA011", fill=NAVY, font=font(22, bold=False))
    draw.rounded_rectangle([50, sy+110, W-50, sy+175], radius=12, fill=ACCENT_BLUE)
    draw.text((W//2 - 70, sy+128), "Create DA", fill=WHITE, font=font(24))

    # Divider
    sy += 200
    draw.line([(50, sy), (W-50, sy)], fill=BORDER, width=2)

    # Load Existing
    sy += 20
    draw.rounded_rectangle([50, sy, W-50, sy+65], radius=12, outline=ACCENT_BLUE, width=3)
    draw.text((W//2 - 120, sy+16), "Load Existing DA", fill=ACCENT_BLUE, font=font(24))

    img.save(os.path.join(OUT, "screenshot_01_welcome.png"), "PNG")
    print("Created screenshot_01_welcome.png")


def create_screenshot_da_detail():
    """Screenshot 2: DA detail screen with records."""
    W, H = 1080, 1920
    img = Image.new('RGB', (W, H), GRAY_BG)
    draw = ImageDraw.Draw(img)

    # Header
    draw.rectangle([0, 0, W, 280], fill=NAVY)
    draw_status_bar(draw, W)
    draw.text((30, 50), "< Back", fill=(180, 200, 220), font=font(18, bold=False))
    draw.text((30, 90), "DA001", fill=WHITE, font=font(56))

    # Stat bubbles
    stats = [("117", "structures"), ("52", "HH"), ("48", "FP"), ("17", "BP")]
    bx = 30
    for num, label in stats:
        draw.rounded_rectangle([bx, 180, bx+110, 255], radius=10, fill=(255, 255, 255, 30))
        # Semi-transparent white
        draw.rounded_rectangle([bx, 180, bx+110, 255], radius=10, fill=(50, 65, 85))
        draw.text((bx + 55 - len(num)*10, 188), num, fill=WHITE, font=font(28))
        draw.text((bx + 55 - len(label)*5, 222), label.upper(), fill=(160, 180, 200), font=font(12))
        bx += 125

    # Action buttons
    by = 300
    draw.rounded_rectangle([30, by, 700, by+70], radius=12, fill=ACCENT_BLUE)
    draw.text((310, by+18), "+ New Record", fill=WHITE, font=font(24))
    draw.rounded_rectangle([720, by, W-30, by+70], radius=12, fill=SURFACE, outline=BORDER, width=2)
    draw.text((760, by+20), "Export ZIP", fill=NAVY, font=font(20))

    # Records label
    draw.text((30, by+90), "RECORDS", fill=GRAY_TEXT, font=font(16))

    # Record cards
    records = [
        ("HH117", "HH 24x36", "HH", True, True, "T 5.12", "Terminal confirmed"),
        ("FP116", "FP 12x12", "FP", False, False, None, None),
        ("HH115", "HH 17x30", "HH", True, True, "T 2.13", "Confirmed terminal inside"),
        ("BP114", "BP", "BP", False, False, None, "Bore pit at corner of Main St"),
        ("HH113", "HH 30x60", "HH", True, False, None, None),
        ("FP112", "FP 12x12", "FP", False, True, "T 1.8", None),
    ]

    cy = by + 120
    for rec_id, rec_type, abbrev, has_sc, has_term, term_val, notes in records:
        if cy + 130 > H - 50:
            break
        # Card
        draw.rounded_rectangle([30, cy, W-30, cy+125], radius=12, fill=SURFACE, outline=BORDER, width=1)

        # Photo thumbnail placeholder
        draw.rounded_rectangle([45, cy+10, 155, cy+110], radius=8, fill=(180, 175, 160))
        draw.rounded_rectangle([52, cy+17, 148, cy+103], radius=4, fill=(80, 75, 65))

        # Record ID and type pill
        draw.text((175, cy+12), rec_id, fill=NAVY, font=font(26))
        type_colors = {
            'HH': ((239, 246, 255), (37, 99, 235), (147, 197, 253)),
            'FP': ((236, 253, 245), (5, 150, 105), (110, 231, 183)),
            'BP': ((255, 247, 237), (234, 88, 12), (253, 186, 116)),
        }
        bg_c, txt_c, brd_c = type_colors[abbrev]
        pill_x = 175 + len(rec_id) * 20 + 15
        draw.rounded_rectangle([pill_x, cy+14, pill_x+45, cy+38], radius=10, fill=bg_c, outline=brd_c, width=1)
        draw.text((pill_x+8, cy+16), abbrev, fill=txt_c, font=font(14))

        # Structure type name
        draw.text((175, cy+45), rec_type, fill=GRAY_TEXT, font=font(16, bold=False))

        # Badges
        badge_x = 175
        badge_y = cy + 72
        if has_sc:
            draw.rounded_rectangle([badge_x, badge_y, badge_x+45, badge_y+24], radius=6, fill=ACCENT_BLUE)
            draw.text((badge_x+10, badge_y+3), "SC", fill=WHITE, font=font(13))
            badge_x += 55
        if has_term and term_val:
            draw.rounded_rectangle([badge_x, badge_y, badge_x+70, badge_y+24], radius=6, fill=(124, 58, 237))
            draw.text((badge_x+8, badge_y+3), term_val, fill=WHITE, font=font(13))
            badge_x += 80

        if notes:
            draw.text((175, cy+100), notes, fill=GRAY_TEXT, font=font(14, bold=False))

        # Chevron
        draw.text((W-70, cy+45), ">", fill=BORDER, font=font(28))

        cy += 140

    img.save(os.path.join(OUT, "screenshot_02_da_detail.png"), "PNG")
    print("Created screenshot_02_da_detail.png")


def create_screenshot_camera():
    """Screenshot 3: Camera screen."""
    W, H = 1080, 1920
    img = Image.new('RGB', (W, H), (30, 30, 30))
    draw = ImageDraw.Draw(img)

    # Simulated camera viewfinder (dark with some texture)
    for y in range(200, H-250):
        for x in range(0, W, 40):
            shade = 35 + (x * y) % 20
            draw.rectangle([x, y, x+40, y+1], fill=(shade, shade+2, shade-2))

    # Fiber structure in viewfinder (simplified)
    # Concrete box
    bx, by, bw, bh = 200, 500, 680, 500
    draw.rounded_rectangle([bx, by, bx+bw, by+bh], radius=10, fill=(145, 140, 125))
    draw.rounded_rectangle([bx+30, by+30, bx+bw-30, by+bh-30], radius=6, fill=(55, 50, 40))

    # Green conduits
    for i in range(5):
        cx = bx + 80 + i * 70
        cy_c = by + 180
        draw.ellipse([cx, cy_c, cx+40, cy_c+40], fill=(35, 140, 55))
        draw.ellipse([cx+5, cy_c+5, cx+35, cy_c+35], fill=(25, 110, 40))

    # Orange conduits
    for i in range(3):
        cx = bx + 100 + i * 90
        cy_c = by + 280
        draw.ellipse([cx, cy_c, cx+50, cy_c+50], fill=(210, 140, 25))
        draw.ellipse([cx+8, cy_c+8, cx+42, cy_c+42], fill=(180, 110, 15))

    # Fibers
    draw.line([(bx+60, by+350), (bx+bw-60, by+380)], fill=(40, 180, 70), width=3)
    draw.line([(bx+80, by+370), (bx+bw-80, by+400)], fill=(200, 150, 20), width=3)

    # Top bar
    draw.rectangle([0, 0, W, 200], fill=(0, 0, 0, 200))
    # Semi-dark overlay
    draw.rectangle([0, 0, W, 200], fill=(15, 15, 15))

    draw_status_bar(draw, W)

    # DA label
    draw.text((W//2 - 80, 60), "DA001", fill=WHITE, font=font(28))

    # Close button (X)
    draw.text((40, 60), "X", fill=WHITE, font=font(32))

    # Lens toggle
    draw.rounded_rectangle([W//2 - 100, 130, W//2 + 100, 175], radius=22, fill=(60, 60, 60))
    # 0.5x active
    draw.rounded_rectangle([W//2 - 95, 133, W//2, 172], radius=20, fill=ACCENT_BLUE)
    draw.text((W//2 - 72, 140), "0.5x", fill=WHITE, font=font(20))
    draw.text((W//2 + 28, 140), "1x", fill=(160, 160, 160), font=font(20))

    # Bottom bar
    draw.rectangle([0, H-250, W, H], fill=(15, 15, 15))

    # Shutter button
    cx, cy = W//2, H-140
    draw.ellipse([cx-50, cy-50, cx+50, cy+50], outline=WHITE, width=4)
    draw.ellipse([cx-40, cy-40, cx+40, cy+40], fill=WHITE)

    # Flash icon (left)
    draw.text((100, cy-15), "Flash", fill=(160, 160, 160), font=font(18, bold=False))

    # Gallery preview (right)
    draw.rounded_rectangle([W-130, cy-35, W-60, cy+35], radius=8, fill=(80, 80, 80), outline=WHITE, width=2)

    img.save(os.path.join(OUT, "screenshot_03_camera.png"), "PNG")
    print("Created screenshot_03_camera.png")


def create_screenshot_record_detail():
    """Screenshot 4: Record detail / edit screen."""
    W, H = 1080, 1920
    img = Image.new('RGB', (W, H), GRAY_BG)
    draw = ImageDraw.Draw(img)

    # Header
    draw.rectangle([0, 0, W, 110], fill=NAVY)
    draw_status_bar(draw, W)
    draw.text((30, 55), "< DA001", fill=(180, 200, 220), font=font(18, bold=False))
    draw.text((W//2 - 50, 55), "HH117", fill=WHITE, font=font(24))

    # Content card
    cy = 130
    draw.rounded_rectangle([20, cy, W-20, cy+400], radius=14, fill=SURFACE)

    # Photo
    draw.rounded_rectangle([40, cy+15, W-40, cy+250], radius=10, fill=(145, 140, 125))
    draw.rounded_rectangle([60, cy+35, W-60, cy+230], radius=6, fill=(55, 50, 40))
    # Green conduits in photo
    for i in range(4):
        px = 100 + i * 80
        draw.ellipse([px, cy+120, px+35, cy+155], fill=(35, 140, 55))
    for i in range(3):
        px = 120 + i * 100
        draw.ellipse([px, cy+165, px+40, cy+200], fill=(210, 140, 25))

    # Record info below photo
    info_y = cy + 270
    draw.text((40, info_y), "HH117", fill=NAVY, font=font(32))

    # Type pill
    draw.rounded_rectangle([210, info_y+4, 260, info_y+32], radius=10,
                          fill=(239, 246, 255), outline=(147, 197, 253), width=1)
    draw.text((220, info_y+8), "HH", fill=(37, 99, 235), font=font(14))

    # Badges
    draw_check(draw, 40, info_y+45, 22, GREEN_CHECK)
    draw_badge(draw, 68, info_y+42, "SC", GREEN_CHECK, WHITE, font(15))
    draw_badge(draw, 130, info_y+42, "T 5.12", (124, 58, 237), WHITE, font(15))

    # Form fields
    fy = cy + 420

    # Structure Type
    draw.text((40, fy), "STRUCTURE TYPE", fill=GRAY_TEXT, font=font(16))
    fy += 30
    draw.rounded_rectangle([40, fy, W-40, fy+55], radius=10, fill=(249, 250, 251), outline=BORDER, width=2)
    draw.text((60, fy+14), "HH 24x36", fill=NAVY, font=font(20, bold=False))
    fy += 75

    # Splice Closure toggle
    draw.text((40, fy), "SPLICE CLOSURE", fill=GRAY_TEXT, font=font(16))
    fy += 30
    # Toggle ON
    draw.rounded_rectangle([40, fy, 110, fy+36], radius=18, fill=GREEN_CHECK)
    draw.ellipse([70, fy+3, 106, fy+33], fill=WHITE)
    draw.text((130, fy+6), "Yes", fill=GREEN_CHECK, font=font(18))
    fy += 60

    # Terminal
    draw.text((40, fy), "INDEXED TERMINAL", fill=GRAY_TEXT, font=font(16))
    fy += 30
    draw.rounded_rectangle([40, fy, 110, fy+36], radius=18, fill=GREEN_CHECK)
    draw.ellipse([70, fy+3, 106, fy+33], fill=WHITE)
    draw.text((130, fy+6), "Yes", fill=GREEN_CHECK, font=font(18))
    fy += 50

    draw.text((40, fy), "TERMINAL DESIGNATION", fill=GRAY_TEXT, font=font(16))
    fy += 30
    draw.rounded_rectangle([40, fy, 300, fy+55], radius=10, fill=(249, 250, 251), outline=BORDER, width=2)
    draw.text((60, fy+14), "5.12", fill=NAVY, font=font(20, bold=False))
    fy += 75

    # Notes
    draw.text((40, fy), "NOTES", fill=GRAY_TEXT, font=font(16))
    fy += 30
    draw.rounded_rectangle([40, fy, W-40, fy+120], radius=10, fill=(249, 250, 251), outline=BORDER, width=2)
    draw.text((60, fy+14), "Terminal confirmed. Splice closure", fill=NAVY, font=font(18, bold=False))
    draw.text((60, fy+42), "in good condition.", fill=NAVY, font=font(18, bold=False))
    fy += 145

    # Save button
    draw.rounded_rectangle([40, fy, W-40, fy+65], radius=12, fill=ACCENT_BLUE)
    draw.text((W//2 - 60, fy+16), "Save Changes", fill=WHITE, font=font(24))

    img.save(os.path.join(OUT, "screenshot_04_record_detail.png"), "PNG")
    print("Created screenshot_04_record_detail.png")


def create_screenshot_export():
    """Screenshot 5: DA detail showing export flow."""
    W, H = 1080, 1920
    img = Image.new('RGB', (W, H), GRAY_BG)
    draw = ImageDraw.Draw(img)

    # Header
    draw.rectangle([0, 0, W, 280], fill=NAVY)
    draw_status_bar(draw, W)
    draw.text((30, 50), "< Back", fill=(180, 200, 220), font=font(18, bold=False))
    draw.text((30, 90), "DA001", fill=WHITE, font=font(56))

    # Stat bubbles
    stats = [("117", "structures"), ("52", "HH"), ("48", "FP"), ("17", "BP")]
    bx = 30
    for num, label in stats:
        draw.rounded_rectangle([bx, 180, bx+110, 255], radius=10, fill=(50, 65, 85))
        draw.text((bx + 55 - len(num)*10, 188), num, fill=WHITE, font=font(28))
        draw.text((bx + 55 - len(label)*5, 222), label.upper(), fill=(160, 180, 200), font=font(12))
        bx += 125

    # Buttons - Export highlighted
    by = 300
    draw.rounded_rectangle([30, by, 700, by+70], radius=12, fill=ACCENT_BLUE)
    draw.text((310, by+18), "+ New Record", fill=WHITE, font=font(24))
    draw.rounded_rectangle([720, by, W-30, by+70], radius=12, fill=GREEN_CHECK)
    draw.text((745, by+20), "Exporting...", fill=WHITE, font=font(18))

    # Alert overlay (export confirmation)
    # Dim background
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 120))
    img = img.convert('RGBA')
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    # Alert dialog
    ax, ay = 100, 650
    aw, ah = W - 200, 400
    draw.rounded_rectangle([ax, ay, ax+aw, ay+ah], radius=20, fill=SURFACE)

    draw.text((ax+30, ay+30), "Export DA001", fill=NAVY, font=font(28))

    msg_lines = [
        "Your export will include:",
        "",
        "  117 structure photos",
        "  records.csv with all metadata",
        "  records.json data file",
        "",
        "Files will be packaged as DA001.zip",
        "and shared via your device."
    ]
    ty = ay + 80
    for line in msg_lines:
        draw.text((ax+30, ty), line, fill=GRAY_TEXT, font=font(18, bold=False))
        ty += 28

    # Buttons
    btn_y = ay + ah - 70
    draw.rounded_rectangle([ax+30, btn_y, ax+aw//2-15, btn_y+50], radius=10, outline=BORDER, width=2)
    draw.text((ax + aw//4 - 35, btn_y+12), "Cancel", fill=GRAY_TEXT, font=font(20))

    draw.rounded_rectangle([ax+aw//2+15, btn_y, ax+aw-30, btn_y+50], radius=10, fill=ACCENT_BLUE)
    draw.text((ax + 3*aw//4 - 50, btn_y+12), "Export ZIP", fill=WHITE, font=font(20))

    img = img.convert('RGB')
    img.save(os.path.join(OUT, "screenshot_05_export.png"), "PNG")
    print("Created screenshot_05_export.png")


# ================================================================
# RUN ALL
# ================================================================
if __name__ == "__main__":
    create_app_icon()
    create_feature_graphic()
    create_screenshot_welcome()
    create_screenshot_da_detail()
    create_screenshot_camera()
    create_screenshot_record_detail()
    create_screenshot_export()
    print(f"\nAll assets saved to: {OUT}")
    for f in sorted(os.listdir(OUT)):
        fpath = os.path.join(OUT, f)
        size = os.path.getsize(fpath)
        img = Image.open(fpath)
        print(f"  {f}: {img.size[0]}x{img.size[1]}, {size//1024}KB")
