# Hamees Attire - Brand Design System

## Brand Overview

**Business Name:** Hamees Attire
**Tagline:** Bespoke Tailoring • Wedding Attire Specialists
**Location:** Amritsar, Punjab, India
**Contact:** +91-8400008096
**Website:** https://hamees.gagneet.com
**Instagram:** @hameesattire

**Specialization:**
- Premium bespoke tailoring
- Wedding attire (Sherwanis, Suits)
- Custom tailoring for men and women
- Groom wear specialists

---

## Brand Color Palette

### Primary Colors

#### Rich Burgundy (Primary)
- **Hex:** `#7C2D12`
- **RGB:** `124, 45, 18`
- **Usage:** Main brand color, headers, primary buttons, logo
- **Meaning:** Tradition, luxury, wedding elegance

**Variations:**
- Light: `#991B1B`
- Dark: `#5C1F0A`

#### Royal Gold (Secondary)
- **Hex:** `#C49A6C`
- **RGB:** `196, 154, 108`
- **Usage:** Accents, borders, decorative elements, luxury touches
- **Meaning:** Elegance, premium quality, traditional Indian weddings

**Variations:**
- Light: `#D4AF76`
- Dark: `#9B7B54`

#### Deep Royal Blue (Accent)
- **Hex:** `#1E3A8A`
- **RGB:** `30, 58, 138`
- **Usage:** Links, informational elements, secondary actions
- **Meaning:** Trust, professionalism, tradition

**Variations:**
- Light: `#3B82F6`
- Dark: `#1E40AF`

### Functional Colors

#### Success Green
- **Hex:** `#10B981`
- **RGB:** `16, 185, 129`
- **Usage:** Success messages, positive indicators

#### Warning/Gold
- **Hex:** `#F59E0B`
- **RGB:** `245, 158, 11`
- **Usage:** Warnings, alerts, highlights

#### Error Red
- **Hex:** `#EF4444`
- **RGB:** `239, 68, 68`
- **Usage:** Error messages, critical alerts

#### Info Blue
- **Hex:** `#3B82F6`
- **RGB:** `59, 130, 246`
- **Usage:** Informational messages

### Neutral Colors

- **Neutral 50-900:** Full grayscale palette from `#F9FAFB` to `#111827`
- **Background:** `#FFFFFF` (light mode), `#0A0A0A` (dark mode)
- **Foreground:** `#171717` (light mode), `#EDEDED` (dark mode)

---

## Typography

### Font Families

**Primary Font (Sans-serif):**
- Geist Sans (Google Fonts)
- Fallback: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif

**Monospace Font:**
- Geist Mono (Google Fonts)
- Usage: Code snippets, technical data, SKUs

**Display/Headings:**
- Serif fonts for brand name in logo-text.svg
- Bold, elegant style reflecting traditional craftsmanship

---

## Logo & Brand Assets

### Logo Files

#### 1. Primary Logo (`/public/logo.svg`)
- **Size:** 200x200px
- **Format:** SVG (scalable)
- **Design Elements:**
  - Ornamental double border in Royal Gold
  - Central "H" monogram styled as traditional sherwani
  - Button details down the center in Gold
  - Corner decorative elements in Royal Blue
  - Background: Transparent

**Usage:**
- Website header
- Large format displays
- Print materials
- Social media profile

#### 2. Logo with Text (`/public/logo-text.svg`)
- **Size:** 300x80px
- **Format:** SVG (scalable)
- **Content:**
  - "Hamees Attire" in elegant serif font (Burgundy)
  - Decorative line in Royal Gold
  - Tagline: "BESPOKE TAILORING • AMRITSAR" (Royal Blue)

**Usage:**
- Website banners
- Email signatures
- Documents/invoices
- Marketing materials

#### 3. Favicon (`/public/favicon.svg`)
- **Size:** 32x32px
- **Format:** SVG
- **Design:** Simplified "H" monogram on Burgundy background
- **Usage:** Browser tab icon

#### 4. Apple Touch Icon (`/public/apple-touch-icon.svg`)
- **Size:** 180x180px
- **Format:** SVG
- **Design:** Full logo with iOS-friendly rounded corners
- **Usage:** iOS home screen icon, PWA icon

---

## Design Principles

### Visual Aesthetic

1. **Traditional Elegance**
   - Ornamental details inspired by traditional Indian wedding attire
   - Gold accents reflecting luxury and celebration
   - Burgundy representing traditional wedding colors

2. **Professional & Premium**
   - Clean, spacious layouts
   - High-quality imagery
   - Attention to detail in every element

3. **Cultural Authenticity**
   - Colors reflect Indian wedding traditions
   - Design elements inspired by sherwani details (buttons, borders)
   - Typography balances modern readability with traditional elegance

### UI/UX Guidelines

1. **Color Usage:**
   - Burgundy for primary actions and headers
   - Gold for accents and premium features
   - Blue for secondary actions and links
   - Maintain high contrast for accessibility

2. **Spacing:**
   - Generous whitespace for luxury feel
   - Consistent padding and margins
   - Clear visual hierarchy

3. **Components:**
   - Rounded corners (4-8px) for modern feel
   - Subtle shadows for depth
   - Smooth transitions and animations
   - Custom scrollbar styling

4. **Imagery:**
   - High-quality product photos
   - Focus on fabric textures and craftsmanship
   - Lifestyle shots of wedding events
   - Behind-the-scenes tailoring process

---

## CSS Implementation

### Root Variables

```css
:root {
  /* Hamees Attire Brand Colors */
  --primary: #7C2D12;
  --primary-light: #991B1B;
  --primary-dark: #5C1F0A;

  --secondary: #C49A6C;
  --secondary-light: #D4AF76;
  --secondary-dark: #9B7B54;

  --accent: #1E3A8A;
  --accent-light: #3B82F6;
  --accent-dark: #1E40AF;

  --success: #10B981;
  --warning: #F59E0B;
  --error: #EF4444;
  --info: #3B82F6;
}
```

### Utility Classes

```css
/* Gradient backgrounds */
.gradient-primary {
  background: linear-gradient(135deg, var(--primary) 0%, #7C3AED 100%);
}

.gradient-secondary {
  background: linear-gradient(135deg, var(--secondary) 0%, var(--secondary-light) 100%);
}

/* Text gradient */
.text-gradient {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## Brand Voice & Messaging

### Tone
- Professional yet warm
- Knowledgeable and expert
- Respectful of tradition
- Attentive to detail

### Key Messages
1. "Bespoke tailoring for your special moments"
2. "Wedding attire specialists in Amritsar"
3. "Where tradition meets craftsmanship"
4. "Your perfect fit, our promise"
5. "Celebrating life's milestones with elegance"

### Taglines
- Primary: "Bespoke Tailoring • Wedding Attire Specialists"
- Alternative: "Crafting Elegance Since [Year]"
- For Weddings: "The Best Sherwani Shop in Amritsar for Grooms"

---

## Social Media Guidelines

### Profile Setup
- **Profile Picture:** Use `/public/logo.svg` (primary logo)
- **Cover Photo:** Use `/public/logo-text.svg` or lifestyle imagery
- **Bio Template:**
  ```
  Hamees Attire 🧵
  Bespoke Tailoring • Wedding Attire Specialists
  📍 Amritsar, Punjab
  📞 +91-8400008096
  🎩 Best Sherwani Shop for Grooms
  ```

### Content Style
- Showcase finished products (sherwanis, suits)
- Behind-the-scenes tailoring process
- Customer testimonials and wedding photos
- Fabric close-ups and texture details
- Color coordination tips for weddings

### Hashtags
`#HameesAttire #BespokeTailoring #Sherwani #WeddingAttire #Amritsar #GroomWear #CustomTailoring #IndianWedding #TraditionalWear #LuxuryTailoring`

---

## Application UI Examples

### Login Page
- Centered card with logo
- Burgundy primary buttons
- Gold decorative elements
- Professional, welcoming layout

### Dashboard
- Clean, spacious design
- KPI cards with brand colors
- Charts using color palette
- Inventory health indicators

### Inventory Management
- Color-coded stock status
- Barcode scanner integration
- Fabric type categorization
- SKU system with brand prefix

---

## File Structure

```
/public/
  ├── logo.svg                  # Primary logo (200x200)
  ├── logo-text.svg             # Logo with text (300x80)
  ├── favicon.svg               # Browser favicon (32x32)
  ├── apple-touch-icon.svg      # iOS icon (180x180)
  └── favicon.ico               # Legacy favicon

/app/
  ├── globals.css               # Brand colors and design system
  └── layout.tsx                # Metadata and SEO

/components/
  └── login-form.tsx            # Brand-aligned login UI
```

---

## SEO & Metadata

### Page Title
"Hamees Attire - Bespoke Tailoring & Wedding Attire | Amritsar"

### Meta Description
"Premium bespoke tailoring and wedding attire specialists in Amritsar. Expert sherwani designers and custom tailoring for men and women. Contact: +91-8400008096"

### Keywords
- Bespoke tailoring
- Sherwani
- Wedding attire
- Custom tailoring
- Amritsar
- Hamees Attire
- Groom wear
- Wedding suits

### Open Graph
- Title: "Hamees Attire - Bespoke Tailoring & Wedding Attire"
- Type: Website
- Locale: en_IN
- URL: https://hamees.gagneet.com

---

## Contact Information

### Business Details
- **Name:** Hamees Attire
- **Address:** Amritsar, Punjab, India
- **Phone:** +91-8400008096
- **Email:** contact@hameesattire.com
- **Website:** https://hamees.gagneet.com
- **Instagram:** @hameesattire

### Login Credentials (Demo)
- Owner: `owner@hameesattire.com` / `admin123`
- Inventory Manager: `inventory@hameesattire.com` / `admin123`

---

## Next Steps

1. **Logo Refinement:**
   - Consider professional designer for polished final version
   - Create variations (horizontal, vertical, icon-only)
   - Develop print-ready formats (PNG, EPS, AI)

2. **Photography:**
   - Professional product photography
   - Lifestyle shots for marketing
   - Team/workshop photos for authenticity

3. **Marketing Materials:**
   - Business cards with new branding
   - Letterhead and invoices
   - Packaging/tags with logo
   - Signage design

4. **Digital Assets:**
   - Social media templates
   - Email signature template
   - WhatsApp Business profile
   - Google My Business optimization

---

**Document Version:** 1.0
**Last Updated:** January 11, 2026
**Created By:** Claude Code AI Assistant
