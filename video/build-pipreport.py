#!/usr/bin/env python3
"""THE PIP REPORT — commentary channel pilot.

Pip hosts an internet-culture commentary show. Demonstrates the format modes:
desk commentary, the signature paused-clip bit, a skit, and an expose teaser.
All content is an original parody universe (made-up celebs/brands) — no real
footage, no real accusations. Reuses infra from build_vunderra.
"""
import math
import os
import random
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import build_vunderra as v

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pip_out")
os.makedirs(OUT, exist_ok=True)

SS, W, H, SR = v.SS, v.W, v.H, v.SR
FPS_R, FPS_O = v.FPS_R, v.FPS_O
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

INK = (38, 34, 44)
CREAM = (255, 246, 236)
PINK = "#F15BB5"
PURPLE = "#8E5BE8"
TEAL = "#46C2B4"
YELLOW = "#FFC93C"
RED = "#E4572E"
BLUE = "#4C8BF5"


def hx(h):
    return v.hx(h)


def F(sz, reg=False):
    return ImageFont.truetype(FONT_R if reg else FONT, int(sz * SS))


def T(d, xy, s, sz, fill=INK, anchor="lm", reg=False, stroke=0, sfill=(255, 255, 255)):
    d.text((xy[0] * SS, xy[1] * SS), s, font=F(sz, reg), fill=fill, anchor=anchor,
           stroke_width=int(stroke * SS), stroke_fill=sfill)


def rrect(d, box, rad, fill=None, outline=None, wdt=3):
    d.rounded_rectangle([box[0] * SS, box[1] * SS, box[2] * SS, box[3] * SS],
                        radius=rad * SS, fill=fill, outline=outline, width=int(wdt * SS))


def studio_bg(seed, c1, c2):
    img = v.grad(c1, c2)
    d = ImageDraw.Draw(img, "RGBA")
    rr = random.Random(seed)
    for _ in range(16):  # soft studio bokeh
        x, y = rr.randint(0, W), rr.randint(0, 420)
        r = rr.randint(30, 90)
        d.ellipse([(x - r) * SS, (y - r) * SS, (x + r) * SS, (y + r) * SS],
                  fill=(255, 255, 255, 22))
    return img, d


# ---------------------------------------------------------------- Pip w/ expressions
BODY = "#46C2B4"; BODY_D = "#2F9E92"; BELLY = "#EAFBF7"
HAT = "#D9A24E"; HATBAND = "#E4572E"


def _cap(d, p, q, col, w):
    d.line([p[0] * SS, p[1] * SS, q[0] * SS, q[1] * SS], fill=col, width=int(w * SS))
    for pt in (p, q):
        r = w / 2
        d.ellipse([(pt[0] - r) * SS, (pt[1] - r) * SS, (pt[0] + r) * SS, (pt[1] + r) * SS], fill=col)


def pip(d, cx, cy, pose="idle", expr="smile", s=1.0, t=0.0, body=BODY, hat=True):
    bob = math.sin(t * 3.0) * 5 * s if pose in ("idle", "point_side", "point_up", "think", "desk") else 0
    def P(dx, dy):
        return (cx + dx * s, cy + (dy + bob) * s)
    bcol = hx(body); bdark = hx(BODY_D) if body == BODY else tuple(int(c * 0.75) for c in hx(body))
    for fx in (-34, 34):
        f = P(fx, -8)
        d.ellipse([(f[0]-26*s)*SS,(f[1]-14*s)*SS,(f[0]+26*s)*SS,(f[1]+12*s)*SS], fill=bdark, outline=INK, width=3*SS)
    bx0,by0=P(-82,-300); bx1,by1=P(82,-18)
    d.rounded_rectangle([bx0*SS,by0*SS,bx1*SS,by1*SS], radius=78*SS, fill=bcol, outline=INK, width=4*SS)
    e=P(0,-150)
    d.ellipse([(e[0]-52*s)*SS,(e[1]-78*s)*SS,(e[0]+52*s)*SS,(e[1]+82*s)*SS], fill=hx(BELLY))
    # eyes
    wide = 1.25 if expr == "shock" else 1.0
    lid = expr in ("judge", "deadpan")
    for ex in (-32, 32):
        ey=-232; pt=P(ex,ey)
        rw, rh = 20*wide, 24*wide
        d.ellipse([(pt[0]-rw*s)*SS,(pt[1]-rh*s)*SS,(pt[0]+rw*s)*SS,(pt[1]+rh*s)*SS], fill=(255,255,255), outline=INK, width=3*SS)
        look = 8 if expr in ("smirk","judge") else 0
        pu=P(ex+look, ey+ (4 if not expr=="shock" else 0))
        pr = 8*(1.15 if expr=="shock" else 1.0)
        d.ellipse([(pu[0]-pr*s)*SS,(pu[1]-9*s)*SS,(pu[0]+pr*s)*SS,(pu[1]+9*s)*SS], fill=INK)
        if lid:  # half-lidded lids
            d.rectangle([(pt[0]-rw*s)*SS,(pt[1]-rh*s)*SS,(pt[0]+rw*s)*SS,(pt[1]-rh*0.1*s)*SS], fill=bcol)
            d.line([(pt[0]-rw*s)*SS,(pt[1]-rh*0.1*s)*SS,(pt[0]+rw*s)*SS,(pt[1]-rh*0.1*s)*SS], fill=INK, width=3*SS)
    # eyebrows
    if expr == "smirk":
        b=P(20,-268); d.line([(b[0]-2)*SS,(b[1]+8)*SS,(b[0]+40)*SS,(b[1]-6)*SS], fill=INK, width=5*SS)
    if expr == "shock":
        for bx in (-32,32):
            b=P(bx,-272); d.arc([(b[0]-22)*SS,(b[1]-4)*SS,(b[0]+22)*SS,(b[1]+24)*SS],200,340,fill=INK,width=5*SS)
    # cheeks
    for cxx in (-46,46):
        pt=P(cxx,-200); d.ellipse([(pt[0]-13*s)*SS,(pt[1]-8*s)*SS,(pt[0]+13*s)*SS,(pt[1]+8*s)*SS], fill=(255,158,148,180))
    # mouth
    m=P(0,-196)
    if expr=="shock":
        d.ellipse([(m[0]-16*s)*SS,(m[1]-4*s)*SS,(m[0]+16*s)*SS,(m[1]+30*s)*SS], fill=hx("#7A2E2E"), outline=INK, width=3*SS)
    elif expr=="deadpan":
        d.line([(m[0]-22*s)*SS,(m[1]+4*s)*SS,(m[0]+22*s)*SS,(m[1]+4*s)*SS], fill=INK, width=4*SS)
    elif expr=="smirk":
        d.arc([(m[0]-24*s)*SS,(m[1]-14*s)*SS,(m[0]+10*s)*SS,(m[1]+16*s)*SS],10,150,fill=INK,width=4*SS)
    elif expr=="judge":
        d.arc([(m[0]-20*s)*SS,(m[1]-2*s)*SS,(m[0]+20*s)*SS,(m[1]+14*s)*SS],200,340,fill=INK,width=4*SS)
    else:
        d.arc([(m[0]-22*s)*SS,(m[1]-18*s)*SS,(m[0]+22*s)*SS,(m[1]+16*s)*SS],15,165,fill=INK,width=4*SS)
    # hat
    if hat:
        hb=P(0,-292)
        d.ellipse([(hb[0]-78*s)*SS,(hb[1]-8*s)*SS,(hb[0]+78*s)*SS,(hb[1]+22*s)*SS], fill=hx(HAT), outline=INK, width=4*SS)
        dome=P(0,-300)
        d.pieslice([(dome[0]-60*s)*SS,(dome[1]-58*s)*SS,(dome[0]+60*s)*SS,(dome[1]+40*s)*SS],180,360,fill=hx(HAT),outline=INK,width=4*SS)
        d.line([(dome[0]-58*s)*SS,(dome[1]-6*s)*SS,(dome[0]+58*s)*SS,(dome[1]-6*s)*SS], fill=hx(HATBAND), width=8*SS)
        knob=P(0,-352); d.ellipse([(knob[0]-9*s)*SS,(knob[1]-9*s)*SS,(knob[0]+9*s)*SS,(knob[1]+9*s)*SS],fill=hx(HATBAND),outline=INK,width=2*SS)
    # arms
    Lsh,Rsh=P(-74,-232),P(74,-232); aw=26*s
    poses={"idle":((-104,-150),(104,-150)),"desk":((-110,-120),(110,-120)),
           "point_side":((-98,-150),(172,-238)),"point_up":((-98,-150),(78,-372)),
           "think":((-98,-150),(30,-250)),"cheer":((-126,-338),(126,-338)),
           "present":((-150,-232),(150,-232))}
    (ld,rd)=poses.get(pose,poses["idle"]); Lh=P(*ld); Rh=P(*rd)
    _cap(d,Lsh,Lh,bcol,aw); _cap(d,Rsh,Rh,bcol,aw)
    for h in (Lh,Rh):
        d.ellipse([(h[0]-17*s)*SS,(h[1]-17*s)*SS,(h[0]+17*s)*SS,(h[1]+17*s)*SS], fill=bdark, outline=INK, width=3*SS)


# ---------------------------------------------------------------- show UI
def chyron(d, tag, headline, col):
    # lower-third news bar
    rrect(d, (60, 838, 1860, 946), 14, fill=(*hx(col), 245), outline=INK, wdt=4)
    rrect(d, (60, 838, 470, 946), 14, fill=(255,255,255,235), outline=INK, wdt=4)
    T(d, (265, 892), tag, 34, fill=hx(col), anchor="mm")
    T(d, (500, 892), headline, 40, fill=(255,255,255), anchor="lm")


def logo_bug(d):
    rrect(d, (1560, 60, 1860, 130), 14, fill=(*hx(PURPLE), 230), outline=(255,255,255,180), wdt=2)
    T(d, (1710, 95), "THE PIP REPORT", 24, fill=(255,255,255), anchor="mm")


def desk(d, cx=960, top=690):
    rrect(d, (cx-580, top, cx+580, 1080), 26, fill=hx("#6C4A8F"), outline=INK, wdt=5)
    rrect(d, (cx-580, top, cx+580, top+30), 12, fill=hx(PURPLE))
    rrect(d, (cx-250, top+70, cx+250, top+150), 12, fill=(*hx(PURPLE), 120), outline=(255,255,255,60), wdt=2)
    T(d, (cx, top+110), "THE PIP REPORT", 34, fill=(255,255,255,150), anchor="mm")


def screen(d, box, title, tcol, draw_inner=None, t=0):
    rrect(d, box, 18, fill=(20,18,30,235), outline=hx(tcol), wdt=4)
    rrect(d, (box[0]+20, box[1]+16, box[0]+40+len(title)*17, box[1]+58), 10,
          fill=(*hx(tcol),50), outline=hx(tcol), wdt=2)
    T(d, (box[0]+34, box[1]+37), title, 26, fill=hx(tcol))
    if draw_inner:
        draw_inner(d, box, t)


# --- little illustrations (all fictional) ---
def bottle(d, cx, cy, s=1.0, col="#8FD3E8", label="$90"):
    d.rounded_rectangle([(cx-40*s)*SS,(cy-90*s)*SS,(cx+40*s)*SS,(cy+110*s)*SS], radius=24*SS, fill=hx(col), outline=INK, width=4*SS)
    d.rectangle([(cx-22*s)*SS,(cy-120*s)*SS,(cx+22*s)*SS,(cy-90*s)*SS], fill=hx("#4C6A78"), outline=INK, width=4*SS)
    d.rounded_rectangle([(cx-34*s)*SS,(cy-10*s)*SS,(cx+34*s)*SS,(cy+60*s)*SS], radius=8*SS, fill=(255,255,255,220))
    T(d, (cx, cy+26*s), label, 30*s, fill=INK, anchor="mm")
    for k in range(3):
        a=k*2.1; sx=cx+math.cos(a)*70*s; sy=cy-40+math.sin(a)*60*s
        d.line([(sx-8)*SS,sy*SS,(sx+8)*SS,sy*SS], fill=hx(YELLOW), width=4*SS)
        d.line([sx*SS,(sy-8)*SS,sx*SS,(sy+8)*SS], fill=hx(YELLOW), width=4*SS)


def moon_bottle(d, cx, cy, s=1.0):
    bottle(d, cx, cy, s, col="#B8A6E8", label="AURA")
    d.ellipse([(cx+30*s)*SS,(cy-140*s)*SS,(cx+90*s)*SS,(cy-80*s)*SS], fill=hx(YELLOW), outline=INK, width=3*SS)
    d.ellipse([(cx+46*s)*SS,(cy-140*s)*SS,(cx+94*s)*SS,(cy-84*s)*SS], fill=(20,18,30))


def outfit(d, cx, cy, kind, s=1.0):
    # simple mannequin
    d.line([cx*SS,(cy-70)*SS,cx*SS,(cy+70)*SS], fill=INK, width=6*SS)
    d.ellipse([(cx-22)*SS,(cy-110)*SS,(cx+22)*SS,(cy-66)*SS], fill=hx("#F0C9A0"), outline=INK, width=3*SS)
    if kind=="hiker":
        d.polygon([(cx-40)*SS,(cy+70)*SS,(cx+40)*SS,(cy+70)*SS,(cx+30)*SS,(cy-40)*SS,(cx-30)*SS,(cy-40)*SS], fill=hx("#6B8E5A"), outline=INK, width=3*SS)
        d.rectangle([(cx-46)*SS,(cy-30)*SS,(cx-30)*SS,(cy+40)*SS], fill=hx(RED), outline=INK, width=3*SS)  # backpack strap
        T(d,(cx,cy+100),"GORPCORE",22,fill=hx("#6B8E5A"),anchor="mm")
    else:
        for k in range(6):
            a=k*1.0; px=cx+math.cos(a)*34; py=cy-10+math.sin(a)*34
            d.ellipse([(px-14)*SS,(py-14)*SS,(px+14)*SS,(py+14)*SS], fill=hx(PINK), outline=INK, width=2*SS)
        d.polygon([(cx-34)*SS,(cy+70)*SS,(cx+34)*SS,(cy+70)*SS,(cx+24)*SS,(cy-20)*SS,(cx-24)*SS,(cy-20)*SS], fill=hx("#7FB069"), outline=INK, width=3*SS)
        T(d,(cx,cy+100),"BLOOMCORE",22,fill=hx(PINK),anchor="mm")


def player(d, t, dur, paused=True):
    box = (150, 150, 1770, 760)
    rrect(d, box, 16, fill=(12,12,20), outline=(70,70,90), wdt=4)
    # fictional "clip": a person on a couch holding the bottle, tv-ad vibe
    cx, cy = 960, 430
    d.rounded_rectangle([(cx-360)*SS,(cy+40)*SS,(cx+360)*SS,(cy+250)*SS], radius=24*SS, fill=hx("#3A5068"))  # couch
    pip(d, cx-140, cy+250, "present", "smile", 0.7, t, body="#E8A0C0")  # a stand-in "influencer"
    bottle(d, cx+180, cy+120, 1.3, col="#8FD3E8", label="$90")
    T(d, (cx+180, cy-40), '"it\'s structured."', 34, fill=(255,255,255), anchor="mm")
    # highlight detail
    if paused:
        d.ellipse([(cx+120)*SS,(cy+40)*SS,(cx+240)*SS,(cy+200)*SS], outline=hx(RED), width=6*SS)
        d.line([(cx+240)*SS,(cy+120)*SS,(cx+360)*SS,(cy+60)*SS], fill=hx(RED), width=5*SS)
        T(d, (cx+370, cy+50), "wait.", 34, fill=hx(RED), anchor="lm")
    # player bar
    by = 712
    d.line([190*SS, by*SS, 1730*SS, by*SS], fill=(90,90,110), width=6*SS)
    prog = 190 + (1730-190)*0.33
    d.line([190*SS, by*SS, prog*SS, by*SS], fill=hx(PINK), width=6*SS)
    d.ellipse([(prog-12)*SS,(by-12)*SS,(prog+12)*SS,(by+12)*SS], fill=hx(PINK))
    # pause icon + time
    d.rectangle([200*SS,(by+24)*SS,214*SS,(by+56)*SS], fill=(230,230,240))
    d.rectangle([224*SS,(by+24)*SS,238*SS,(by+56)*SS], fill=(230,230,240))
    T(d, (270, by+40), "1:04 / 3:12", 26, fill=(200,200,215), anchor="lm", reg=True)
    if paused:
        T(d, (960, 250), "❚❚  PAUSED", 60, fill=(255,255,255,235), anchor="mm")


def receipts(d, t):
    rows = [("day 1", "AURA launches 'moon-charged' electrolytes", TEAL),
            ("day 3", "customers charged 12x. AURA blames 'lunar sync'", YELLOW),
            ("day 5", "the moon issues no comment", RED)]
    for i,(a,b,c) in enumerate(rows):
        if t < 0.6+i*0.9: continue
        y=360+i*130
        rrect(d,(240,y-46,1680,y+46),14,fill=(24,20,32,230),outline=hx(c),wdt=2)
        T(d,(280,y),a,32,fill=hx(c)); T(d,(470,y),b,34,fill=(235,235,245),reg=True)


# ---------------------------------------------------------------- scenes
SCENES = [
    ("intro", "smile",
     "Welcome back to the Pip Report. The only show where a small creature tells you what the internet did, while you were trying to have a real life. Big week. A billionaire's magic water, a fashion war, and a wellness brand that fought the moon. Let's get into it."),
    ("headline1", "smirk",
     "First up. Mega-influencer Blaine Voss has launched a new water. It costs ninety dollars. He says it is, quote, structured. Blaine. Water is already structured. It has a structure. It's called H-2-O. That's the whole thing."),
    ("paused", "judge",
     "And here's the ad. Watch this. Pause. Right here. See it? He blinks. Every single time he says, clinically proven. Clinically proven by who, Blaine? The clinic? The one you own? In the building? With your name on it?"),
    ("skit", "smile",
     "Honestly, let me just show you how that meeting probably went. Blaine says: what if we sold water, but ninety dollars. The intern says: sir, that's just water. And Blaine says: not if we call it structured. And that, is a real job someone has."),
    ("headline2", "shock",
     "In fashion news, the Gorpcore versus Bloomcore war has escalated. Gorpcore is dressing like you are about to hike a mountain at any moment. Bloomcore is dressing like you ARE, personally, a garden. They are at war. Neither of them will survive actual winter."),
    ("expose", "deadpan",
     "And finally, a teaser. Next week, the full breakdown of AURA. The wellness brand that sold moon-charged electrolytes, and accidentally charged everyone's card twelve times. This one has receipts. They're fictional receipts. But they are, receipts."),
    ("outro", "smile",
     "That is the internet, this week. None of it was real. Some of it felt a little too real. That is the actual problem. I'm Pip. Please, log off. ...you won't. I know you won't. See you next week."),
]


def draw_scene(d, img, kind, expr, t, dur):
    logo_bug(d)
    if kind == "intro":
        T(d, (960, 210), "THE PIP REPORT", 88, fill=hx(PURPLE), anchor="mm", stroke=5)
        T(d, (960, 295), "the internet, explained by a small creature who is very online", 30, fill=INK, anchor="mm", reg=True)
        pip(d, 960, 760, "desk", expr, 0.92, t)
        desk(d, top=690)
        chyron(d, "LIVE", "the internet had a week", PURPLE)
    elif kind == "headline1":
        screen(d, (110, 170, 980, 720), "CELEBRITY", PINK,
               draw_inner=lambda d,b,t: bottle(d, 545, 470, 1.5))
        pip(d, 1420, 740, "present", expr, 0.82, t)
        chyron(d, "BREAKING", "Blaine Voss sells $90 'structured' water", PINK)
    elif kind == "paused":
        player(d, t, dur, paused=(t > 1.3))
        pip(d, 1650, 748, "present", expr, 0.5, t)  # reaction cam, tucked in the corner
        chyron(d, "RECEIPTS", "the blink heard 'round the timeline", RED)
    elif kind == "skit":
        T(d, (960, 120), "SKIT — the pitch meeting", 44, fill=hx(YELLOW), anchor="mm", stroke=4)
        # two characters
        pip(d, 620, 900, "present", "smirk", 0.95, t, body="#E8A0C0", hat=False)
        T(d, (620, 930), "BLAINE", 30, fill=hx(PINK), anchor="mm")
        pip(d, 1320, 900, "idle", "shock", 0.95, t, body="#9AD0E0", hat=False)
        T(d, (1320, 930), "the intern", 30, fill=hx(BLUE), anchor="mm")
        if t > 1.0:
            rrect(d, (330, 360, 900, 470), 18, fill=(255,255,255,240), outline=INK, wdt=3)
            T(d, (350, 415), '"what if water, but $90?"', 30, fill=INK, anchor="lm")
        if t > 3.0:
            rrect(d, (1030, 470, 1620, 580), 18, fill=(255,255,255,240), outline=INK, wdt=3)
            T(d, (1050, 525), '"sir... that\'s just water."', 30, fill=INK, anchor="lm")
        chyron(d, "SKIT", "dramatization. probably accurate.", YELLOW)
    elif kind == "headline2":
        screen(d, (110, 170, 1770, 720), "FASHION", "#7FB069", None)
        outfit(d, 620, 440, "hiker")
        T(d, (960, 440), "VS", 70, fill=hx(RED), anchor="mm", stroke=4)
        outfit(d, 1300, 440, "bloom")
        pip(d, 1660, 1010, "think", expr, 0.6, t)
        chyron(d, "SUBCULTURE", "Gorpcore vs Bloomcore: the war escalates", "#7FB069")
    elif kind == "expose":
        img.paste(v.grad("#241826", "#3A2440").resize((W,H)))
        d2 = ImageDraw.Draw(img, "RGBA")
        logo_bug(d2)
        T(d2, (960, 200), "COMING SOON", 40, fill=hx(YELLOW), anchor="mm", reg=True)
        T(d2, (960, 285), "THE AURA SCANDAL", 82, fill=(240,235,245), anchor="mm", stroke=4, sfill=(20,15,25))
        receipts(d2, t)
        pip(d2, 1690, 1000, "point_side", expr, 0.55, t)
        chyron(d2, "EXPOSÉ", "a full breakdown. next week.", RED)
        return
    elif kind == "outro":
        T(d, (960, 220), "log off.", 108, fill=hx(PURPLE), anchor="mm", stroke=5)
        T(d, (960, 320), "(you won't)", 44, fill=INK, anchor="mm", reg=True)
        pip(d, 960, 760, "desk", expr, 0.92, t)
        desk(d, top=690)
        chyron(d, "THE PIP REPORT", "new episode every week", PURPLE)


def caption(d, s):
    if not s: return
    cf = F(30, reg=True)
    words, lines, cur = s.split(), [], ""
    while words:
        w_ = words.pop(0); tt=(cur+" "+w_).strip()
        if d.textlength(tt, font=cf) <= 1700*SS: cur=tt
        else: lines.append(cur); cur=w_
    lines.append(cur)
    h=len(lines)*40+26; top=970-h
    rrect(d,(90,top,1830,970),14,fill=(255,255,255,238),outline=INK,wdt=3)
    y=(top+14)*SS
    for ln in lines:
        d.text((W*SS/2,y),ln,font=cf,fill=INK,anchor="ma"); y+=40*SS


def render_segment(idx, kind, expr, cap, dur, wav):
    nf = max(int(dur*FPS_R)+1, 4)
    mp4 = os.path.join(OUT, f"seg{idx:03d}.mp4")
    proc = subprocess.Popen(
        ["ffmpeg","-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS_R),"-i","-","-i",wav,
         "-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p","-r",str(FPS_O),
         "-c:a","aac","-b:a","160k","-t",f"{dur:.3f}",mp4],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    skies = {"expose":("#241826","#3A2440")}
    for fi in range(nf):
        t = fi/FPS_R
        img, d = studio_bg(idx+2, "#F4E9FF", "#FFF6EC")
        draw_scene(d, img, kind, expr, t, dur)
        d2 = ImageDraw.Draw(img, "RGBA")
        caption(d2, cap)
        proc.stdin.write(img.resize((W,H), Image.LANCZOS).tobytes())
    proc.stdin.close(); proc.wait()
    return mp4


def main():
    seg_files, durations = [], []
    for i,(kind,expr,narr) in enumerate(SCENES):
        wav=os.path.join(OUT,f"seg{i:03d}.wav"); done=os.path.join(OUT,f"seg{i:03d}.done")
        if os.path.exists(done):
            durations.append(len(v.read_wav(wav))/SR); seg_files.append(os.path.join(OUT,f"seg{i:03d}.mp4")); continue
        a=v.tts(narr, speed=1.0); a=np.concatenate([a, np.zeros(int(0.6*SR))])
        v.write_wav(wav,a); dur=len(a)/SR; durations.append(dur)
        render_segment(i, kind, expr, narr, dur, wav); open(done,"w").close()
        print(f"[{i+1}/{len(SCENES)}] {kind} {dur:.1f}s", flush=True)
    lst=os.path.join(OUT,"list.txt")
    with open(lst,"w") as f:
        for p in seg_files: f.write(f"file '{os.path.abspath(p)}'\n")
    joined=os.path.join(OUT,"joined.mp4")
    subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i",lst,"-c","copy",joined],check=True,capture_output=True)
    total=sum(durations); print(f"total {total:.1f}s", flush=True)
    v.write_wav(os.path.join(OUT,"bed.wav"), v.music_bed(total))
    final=os.path.join(OUT,"pip_report_pilot.mp4")
    subprocess.run(["ffmpeg","-y","-i",joined,"-i",os.path.join(OUT,"bed.wav"),"-filter_complex",
        "[1:a]volume=0.11[m];[0:a]volume=1.35[vv];[vv][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.94[a]",
        "-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k",final],check=True,capture_output=True)
    print("FINAL:", final, flush=True)


if __name__ == "__main__":
    main()
