#!/usr/bin/env python3
"""Build Katalina_Resume_2026.docx (and the PDF) from the content below.

Run:  python3 scripts/build-resume.py
Then: soffice --headless --convert-to pdf Katalina_Resume_2026.docx

House rules: no em dashes anywhere. Accent matches the site's pink ink (#c4126f).
Keep it to one page.
"""
import os
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

ACCENT = RGBColor(0xC4, 0x12, 0x6F)   # --i-pink from css/style.css
INK    = RGBColor(0x11, 0x11, 0x11)
DARK   = RGBColor(0x33, 0x33, 0x33)
MUTED  = RGBColor(0x55, 0x55, 0x55)
FAINT  = RGBColor(0x44, 0x44, 0x44)
FONT   = "Arial"
SEP    = "  ·  "

doc = Document()
s = doc.sections[0]
s.page_width, s.page_height = Inches(8.5), Inches(11)
s.top_margin = s.bottom_margin = Inches(0.26)
s.left_margin = s.right_margin = Inches(0.5)

base = doc.styles["Normal"]
base.font.name = FONT
base.font.size = Pt(9)
base.paragraph_format.space_before = Pt(0)
base.paragraph_format.space_after = Pt(0)


def p(text, size=9, bold=False, color=INK, before=0, after=1, italic=False):
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(before)
    para.paragraph_format.space_after = Pt(after)
    r = para.add_run(text)
    r.font.name = FONT
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    r.font.color.rgb = color
    return para


def lead(label, text, size=9, before=0.5, after=0.5):
    """A bold lead-in label followed by running text, e.g. 'Design  ...'."""
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(before)
    para.paragraph_format.space_after = Pt(after)
    a = para.add_run(label + "   ")
    a.font.name, a.font.size, a.bold, a.font.color.rgb = FONT, Pt(size), True, INK
    b = para.add_run(text)
    b.font.name, b.font.size, b.font.color.rgb = FONT, Pt(size), INK
    return para


def bullet(text, size=9):
    para = doc.add_paragraph(style="List Bullet")
    para.paragraph_format.space_before = Pt(0)
    para.paragraph_format.space_after = Pt(0.5)
    para.paragraph_format.left_indent = Inches(0.24)
    para.paragraph_format.first_line_indent = Inches(-0.14)
    r = para.add_run(text)
    r.font.name, r.font.size, r.font.color.rgb = FONT, Pt(size), INK
    return para


def section(title):
    p(title, size=10.5, bold=True, color=ACCENT, before=3.5, after=1)


def role(title, meta):
    p(title, size=10, bold=True, before=2.5, after=0)
    p(meta, size=8.5, color=MUTED, after=1)


# ---------------------------------------------------------------- header
p("Katalina Vasquez", size=17, bold=True, color=ACCENT, after=1)
p("Product, Brand & UX/UI Designer", size=10, color=DARK, after=1)
p("Los Angeles, CA  |  hello.katalinav@gmail.com  |  linkedin.com/in/katalinav1  |  katalinaisland.online",
  size=8.5, color=MUTED, after=3)
p("I build brand and product foundations, then hand them off so teams can run them without me. Started in "
  "UX/UI, now heading toward software and hardware.", size=9, color=DARK, after=1)

# ------------------------------------------------------------ experience
section("Experience")

role("Independent Product & Brand Designer",
     "Various Clients" + SEP + "2024 to present" + SEP + "Los Angeles and Remote")
bullet("Brand identity and design systems for early stage startups, including SLATE, a Y Combinator backed AI "
       "company: research, positioning, logo and type systems, and tone of voice.")
bullet("Designed and built client websites, social asset systems, and written documentation, including a live "
       "author site the client now runs on their own.")
bullet("Product design support: app icon design, UX feedback on in-development builds, marketing site "
       "wireframes, and pitch decks for fundraising.")
bullet("Packaging, product labels, and print collateral for consumer and food brands.")

role("Live Stream Technician",
     "Social Objects" + SEP + "2026 to present" + SEP + "Freelance, Los Angeles")
bullet("Technical operations for live streams: stream setup, monitoring, and on-air troubleshooting "
       "in OBS Studio and TikTok LIVE Manager.")

role("Co-Founder & Founding Designer",
     "SAN Sound" + SEP + "Jan 2022 to Aug 2024" + SEP + "Remote")
bullet("Co-founded a consumer audio startup building SANWEAR, a wireless in-ear monitor line shipped to customers "
       "in 37 countries.")
bullet("Produced manufacturer-ready production files to millimeter tolerances with Pantone specs, material "
       "callouts, and dielines, coordinating overseas manufacturing through multiple revision cycles.")
bullet("Designed packaging and user manuals for the full product line, including FCC and CE regulatory content.")
bullet("Led design on partner collaborations including TV Chosun and Supra, plus merch, email marketing in "
       "Klaviyo, and the first versions of the company website and mobile app.")
bullet("Helped build the community the product launched into: social on X, Discord moderation, and design for "
       "SAN Origin, the NFT collection.")

role("Design Associate",
     "Blockchain Marketing Advisors (BMA)" + SEP + "Mar 2022 to Aug 2022" + SEP + "Remote")
bullet("Website redesign and logo refresh for the firm's visual identity, plus campaign assets for a web3 audience.")

role("Product Designer",
     "Wise Token (WiseSoft, LLC)" + SEP + "Nov 2021 to Apr 2022" + SEP + "Remote")
bullet("Product design for LiquidNFTs, promoted to design lead three months in. Brought a design-skeptical "
       "engineering team into the process rather than working around them.")

role("UX Designer, Apprenticeship",
     "Blank & Co." + SEP + "Apr 2021 to Oct 2021" + SEP + "Los Angeles, CA")
bullet("Website and information design for two e-commerce clients in very different categories, industrial casters "
       "and luxury fireplaces.")

p("Earlier", size=10, bold=True, before=2.5, after=1)
p("Operations Coordinator, What You Didn't See (2022)" + SEP +
  "Tech Generalist, Imperial Art Studio" + SEP +
  "Marketing Intern, Loungefly, a Funko brand (2018 to 2019)" + SEP +
  "Film and service roles, 2017 to 2021. Everyone starts somewhere.", size=9, after=1)

# --------------------------------------------- education & certifications
section("Education & Certifications")

p("Ironhack Design Academy" + SEP + "UX/UI Design, Human Computer Interaction" + SEP + "2021",
  size=9.5, bold=True, after=0)
p("Yes, it was a bootcamp, and it was more thorough and hands-on than my time at a traditional university. "
  "I attended on the Uber Scholarship and graduated three months later.", size=8.5, color=FAINT, after=2)

p("Scholarship for Women in Blockchain, She(256) at UC Berkeley" + SEP + "2x recipient" + SEP + "2018, 2019",
  size=9.5, bold=True, after=1.5)

p("Mechanical Engineering coursework" + SEP + "Part time, transfer track" + SEP + "Los Angeles, CA" + SEP + "ongoing",
  size=9.5, bold=True, after=1.5)

lead("Certifications:",
     "Foundations of Humane Technology, Center for Humane Technology (2021)", size=9, before=0)

# ---------------------------------------------------------------- skills
section("Skills")
lead("Design & Strategy", "Brand identity \u00b7 Visual identity systems \u00b7 Packaging design \u00b7 Production and "
     "pre-press files \u00b7 UX/UI design \u00b7 Wireframing and prototyping \u00b7 Typography and type systems \u00b7 "
     "Art direction \u00b7 3D modeling and CAD \u00b7 Illustration \u00b7 Competitive and market research \u00b7 Brand "
     "positioning \u00b7 Tone of voice \u00b7 Pitch design \u00b7 Documentation, handoff, and project management")
lead("Tools", "Figma \u00b7 Adobe Illustrator, Photoshop and InDesign \u00b7 Procreate \u00b7 Squarespace \u00b7 Webflow \u00b7 "
     "Klaviyo \u00b7 Miro \u00b7 Pantone Connect \u00b7 CapCut \u00b7 Shapr3D \u00b7 OBS Studio \u00b7 TikTok LIVE Manager")
lead("Learning", "Blockchain development \u00b7 Software development \u00b7 Code art \u00b7 Autodesk Fusion \u00b7 SolidWorks")
lead("Also", "Manufacturing and vendor coordination \u00b7 English and Spanish (intermediate)")

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Katalina_Resume_2026.docx")
out = os.path.normpath(out)
doc.save(out)
print("wrote", out)
