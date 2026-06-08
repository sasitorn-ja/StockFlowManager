# Dashboard Design Guide

คู่มือนี้สรุปแนวทางดีไซน์ของแดชบอร์ด เพื่อใช้ต่อยอดกับโปรเจกต์อื่นโดยไม่ผูกกับเนื้อหาธุรกิจเดิม

## Design Tone

- บุคลิกโดยรวม: สะอาด โปร่ง ใช้งานซ้ำได้ทุกวัน อ่านตัวเลขเร็ว
- เน้น dashboard / operational tool มากกว่า landing page
- ใช้สีอ่อน พื้นหลังขาวอมฟ้า เส้น border บาง และเงาเบามาก
- หลีกเลี่ยงการตกแต่งหนัก เช่น gradient ใหญ่ ๆ orb / blob / card ซ้อน card
- ข้อมูลสำคัญควรถูก scan ได้ใน 1-2 วินาที: label สั้น ตัวเลขชัด หน่วยชัด

## Layout

### App Shell

- พื้นหลังหลัก: `#fbfcfe`
- Shell background:

```css
linear-gradient(180deg, #ffffff 0, rgba(249, 251, 253, 0.98) 260px), #fbfcfe
```

- Main content:
  - Desktop padding: `16px`
  - Mobile/tablet padding: `12px`
  - Section gap: `10px-12px`

### Sidebar

- Expanded width: `224px`
- Collapsed width: `68px`
- Background: `#ffffff`
- Border right: `#e8edf3`
- No heavy shadow in light mode
- Mobile sidebar slides over content with dark overlay `rgba(15, 23, 42, 0.45)`

### Header

- Height: visually around `72px-84px`
- White background
- Bottom border: `#e8edf3`
- Page title:
  - Font size: `28px-32px` for page header
  - Weight: `700-800`
  - Color: `#07142b`

## Navigation

### Menu Item

- Height: `40px`
- Border radius: `6px`
- Horizontal padding: `10px`
- Gap icon/text: `10px`
- Text size: `13px`
- Weight: `600`
- Default text: `#475569` / Tailwind `slate-600`
- Default icon: `#64748b` / Tailwind `slate-500`
- Hover: background `#f0f9ff`, text `#0369a1`
- Active:
  - Background: `#f0f9ff`
  - Text/icon: `#0284c7`
  - Right active bar: width `4px`, height `32px`, color `#0284c7`, rounded left

Example:

```tsx
className="
  relative flex h-10 w-full items-center gap-2.5 rounded-md px-2.5
  text-[13px] font-semibold text-slate-600
  hover:bg-sky-50 hover:text-sky-700
"
```

## Color System

### Base

| Token | Color | Usage |
| --- | --- | --- |
| Background | `#fbfcfe` | Page background |
| Surface | `#ffffff` | Cards, sidebar, header |
| Surface Soft | `#f7f9fc` | Table header, subtle section background |
| Border | `#dfe7ef` | Cards |
| Border Soft | `#e8edf3` | Sidebar/header separators |
| Table Border | `#edf1f2` | Table row/cell dividers |
| Text Strong | `#07142b` | Page title, main values |
| Text Body | `#13213a` | Table body |
| Text Muted | `#52627a` | Table header/secondary labels |
| Text Subtle | `#94a3b8` | Units, helper text |

### Accent Colors

| Name | Color | Usage |
| --- | --- | --- |
| Sky | `#0284c7` / `#0ea5e9` | Active nav, primary chart accent |
| Emerald | `#10b981` | Confirmed/success, delivered-positive states |
| Amber | `#f59e0b` | Warning/attention |
| Rose | `#f43f5e` | Cancelled/error |
| Violet | `#8b5cf6` | Ranking/product accent |
| Slate | `#64748b` | Neutral icons/text |

Use accents sparingly. Most screens should still read as white/slate with one blue active signal.

## Cards

### Dashboard Card

- Border: `1px solid #dfe7ef`
- Radius: `8px`
- Shadow: `0 1px 2px rgba(15, 23, 42, 0.04)`
- Background: `#ffffff`
- Header border: `#d9e3e6`
- Avoid nested cards. Use one card per table/panel.

```css
.dashboard-card {
  border-color: #dfe7ef;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
```

### KPI Card

- Min height: `88px`
- Padding: `16px 12px`
- Number size: `24px`
- Label size: `12px`
- Icon container: `36px-44px`
- Icon background should be pale accent: `sky-50`, `emerald-50`, `violet-50`

## Typography

- Preferred Thai font: `Sarabun`
- Fallback: `ui-sans-serif`, system fonts
- Body size: `14px`
- Table body: `13px`
- Table header: `12px`, weight `600`
- Compact helper text: `11px-12px`
- Avoid negative letter spacing
- Enable tabular numbers:

```css
font-feature-settings: "tnum";
```

## Tables

### General

- Use `table-fixed` for dense dashboards
- Header background: `#f7f9fc`
- Header text: `#52627a`
- Row border: `#edf1f2`
- Cell padding: `8px 12px` or `8px 10px` for compact tables
- Table body font: `13px`
- Numbers align right
- Units should be small muted text next to value

### Avoid Horizontal Scroll

When a table has many columns:

- Shorten column labels
- Use Thai labels instead of mixed English if users are Thai
- Split datetime into 2 lines
- Clamp long names to 2 lines
- Reduce padding from `px-3` to `px-2.5`
- Prefer one meaningful date column on summary tables
- Keep full audit dates only on detail/drilldown views

Compact datetime pattern:

```tsx
function CompactDateTime({ value }: { value?: string | null }) {
  const text = dateText(value);
  const parts = text.split(" ");
  if (parts.length < 3) return <span>{text}</span>;

  return (
    <span className="block text-[11px] leading-4">
      <span className="block whitespace-nowrap">{parts.slice(0, 3).join(" ")}</span>
      <span className="block whitespace-nowrap">{parts.slice(3).join(" ")}</span>
    </span>
  );
}
```

## Data Labeling Rules

Use labels that state exactly what the field means. Do not combine dates with fallback logic unless the label says it is a reference date.

### Recommended Thai Labels

| Meaning | Label |
| --- | --- |
| Number of order records | `จำนวนออเดอร์` and show unit `ครั้ง` |
| Ordered quantity | `ปริมาณที่สั่ง` or `จำนวนที่สั่ง` and show unit `คิว` |
| Delivered quantity | `ปริมาณส่งจริง` or `จำนวนส่งจริง` and show unit `คิว` |
| Product/site/customer count | `จำนวนสินค้า`, `จำนวนไซต์`, `จำนวนลูกค้า` |
| Latest concrete pour time | `เวลาเทล่าสุด` |
| Order pour time | `เวลาเท` |
| Order created_at | `วันที่สร้างออเดอร์` |
| Order updated_at | `วันที่อัปเดตรายการ` |
| Dealer last_active_at | `ใช้งานล่าสุด` |
| Dealer created_at | `วันที่สร้าง dealer` |
| Dealer updated_at | `วันที่อัปเดตข้อมูล dealer` |
| Group created_at | `วันที่สร้างกลุ่ม` |
| Group updated_at | `วันที่อัปเดตข้อมูลกลุ่ม` |
| Site created_at | `วันที่สร้างไซต์` |
| Site last_pour_datetime | `เวลาเทล่าสุด` |
| Site updated_at | `วันที่อัปเดตไซต์` |
| Usage updated_at | `วันที่อัปเดตข้อมูล usage` |

### Date Filter Rule

If a global date filter applies to many resources, define the date basis per resource:

| Resource | Date field for filtering |
| --- | --- |
| Dealers | `last_active_at` |
| Dealer groups | `created_at` |
| Dealer usage | `updated_at` |
| Customer usage | `updated_at` |
| Sites | `last_pour_datetime` |
| Orders | `pour_datetime` |

Do not silently fallback across meanings, for example:

```ts
// Avoid for user-facing filtering
order.pour_datetime ?? order.updated_at ?? order.created_at
```

If fallback is necessary for sorting, label it as `ข้อมูลล่าสุด` or `วันที่อ้างอิงล่าสุด`, not `เวลาเท`.

## Status Pills

Use small rounded pills with clear colors:

| Status | Background | Text |
| --- | --- | --- |
| Confirmed | `#ecfdf5` | `#047857` |
| Pending | `#fffbeb` | `#b45309` |
| Cancelled | `#fff1f2` | `#be123c` |
| Other | `#f1f5f9` | `#334155` |

Pill style:

```tsx
"inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1"
```

## Buttons And Controls

- Buttons: radius `6px-8px`
- Icon buttons: use familiar icons, not text-only when icon is obvious
- Segmented controls:
  - Outer: pale surface `#f8fafb`
  - Border: `#d9e3e6`
  - Active: blue background `#2563eb` or app primary
- Search inputs:
  - Height: `36px-44px`
  - Border: `#d5e0e3`
  - Focus ring: soft slate/sky

## Empty And Loading States

- Empty box:
  - Dashed border `#d9e3e6`
  - Background `#fbfcfc`
  - Text `#64748b`
- Loading text:
  - Centered
  - `14px`, weight `600`

## Dark Mode

Optional but supported:

- Background: `#020617`
- Card: `#0f172a`
- Border: `#1e293b`
- Strong text: `#e2e8f0`
- Muted text: `#94a3b8`
- Dark mode shadow: `0 16px 36px rgba(2, 6, 23, 0.26)`

## Implementation Checklist

- Sidebar width is compact and does not dominate content
- Active menu has a visible but quiet indicator
- KPI cards show unit next to numbers
- Table labels use Thai where the audience is Thai
- Count fields say whether they are `ครั้ง`, `รายการ`, or `ราย`
- Volume fields show unit such as `คิว` or `m3`
- Summary tables do not show every audit date
- Detail tables can show created/updated/pour dates
- No table should require horizontal scroll unless data inspection truly needs it
- Long names are clamped, not allowed to stretch the table
