# TDS (Technical Data Sheet) Documentation

## Overview

The TDS (Technical Data Sheet) generation system allows users to create PDF documents for products with their technical specifications, images, and brand-specific headers/footers.

## Features

- **Automatic PDF Generation**: Generates professional PDFs from product data
- **Multi-Brand Support**: Supports multiple brands with custom headers and footers
- **Bulk Generation**: Generate TDS for multiple products at once
- **Item Code Display**: Shows item codes for different brands (LIT, ECOSHIFT, OKO, LUMERA, ZUMTOBEL)
- **Technical Drawings**: Includes dimensional drawings, mounting heights, wiring diagrams, etc.
- **Brand Assets**: Optional header/footer images for branded TDS documents

## Supported Brands

The system supports the following brands with custom header/footer images:

| Brand | Header Image | Footer Image | Color Theme |
|-------|-------------|--------------|-------------|
| LIT | `/templates/lit-header.png` | `/templates/lit-footer.png` | Yellow (#ca8a04) |
| ECOSHIFT | `/templates/ecoshift-header.png` | `/templates/ecoshift-footer.png` | Green (#16a34a) |
| OKO | `/templates/oko-header.png` | `/templates/oko-footer.png` | Cyan (#0891b2) |
| LUMERA | `/templates/lumera-header.png` | `/templates/lumera-footer.png` | Orange (#ea580c) |
| ZUMTOBEL | `/templates/zumtobel-header.png` | `/templates/zumtobel-footer.png` | Black (#18181b) |

## File Structure

```
jaries/
├── lib/
│   └── tdsGenerator.ts          # Core PDF generation logic
├── components/
│   ├── tds-preview.tsx          # TDS preview component
│   └── product-forms/
│       ├── bulk-download-tds-dialog.tsx  # Bulk download dialog
│       └── add-new-product-form.tsx      # Product form with TDS generation
├── types/
│   └── product.ts               # Product type definitions including ItemCodeBrand
├── public/
│   └── templates/
│       ├── lit-header.png
│       ├── lit-footer.png
│       ├── ecoshift-header.png
│       ├── ecoshift-footer.png
│       ├── oko-header.png
│       ├── oko-footer.png
│       ├── lumera-header.png
│       ├── lumera-footer.png
│       ├── zumtobel-header.png
│       └── zumtobel-footer.png
└── app/
    └── products/
        └── all-products/
            └── page.tsx         # Main products page with TDS features
```

## Usage

### Individual TDS Generation

1. Navigate to a product in the products list
2. Click the "View TDS" button to preview the TDS
3. Click "Download PDF" to download the generated PDF
4. Click "Save TDS" to save the PDF to the product record

### Bulk TDS Generation

1. Select multiple products from the products list
2. Click "Generate TDS" in the bulk actions bar
3. Select the header brand (LIT, ECOSHIFT, or OKO)
4. If products have multiple item code brands, select which item code to display
5. Click "Generate" to create TDS for all selected products

### TDS Preview

The TDS preview shows a live preview of the PDF with:
- Product image
- Item codes (filtered by selected brand if specified)
- Brand information
- Technical specifications
- Technical drawings (if available)
- Brand header and footer (if enabled)

## Configuration

### Header/Footer Resolution

The header and footer images maintain their original aspect ratio and are scaled to fit the page width. This ensures that brand logos and text are not stretched or distorted.

**Implementation**: In `lib/tdsGenerator.ts`, the system:
1. Loads the header/footer image
2. Calculates the aspect ratio from original dimensions
3. Scales to fit page width while maintaining height proportion
4. Dynamically adjusts content layout based on actual header height

### Item Code Schema

The system supports both legacy and new item code schemas:

**Legacy Schema**:
```typescript
{
  litItemCode: string;
  ecoItemCode: string;
  itemCode: string;
}
```

**New Schema** (preferred):
```typescript
{
  itemCodes: {
    LIT?: string;
    ECOSHIFT?: string;
    OKO?: string;
    LUMERA?: string;
    ZUMTOBEL?: string;
  }
}
```

### Brand Selection

Users can select different brands for:
1. **Header Brand**: Determines which header/footer images to use
2. **Item Code Brand**: Determines which item code to display prominently in the TDS

These can be different - for example, you can use OKO header but display LIT item codes.

## API Reference

### generateTdsPdf

```typescript
interface GenerateTdsInput {
  itemDescription: string;
  itemCodes?: ItemCodes;
  litItemCode?: string;
  ecoItemCode?: string;
  technicalSpecs: TdsTechnicalSpec[];
  brand?: TdsBrand;
  itemCodeBrand?: ItemCodeBrand;
  includeBrandAssets?: boolean;
  mainImageUrl?: string;
  rawImageUrl?: string;
  dimensionalDrawingUrl?: string;
  recommendedMountingHeightUrl?: string;
  driverCompatibilityUrl?: string;
  baseImageUrl?: string;
  illuminanceLevelUrl?: string;
  wiringDiagramUrl?: string;
  installationUrl?: string;
  wiringLayoutUrl?: string;
  terminalLayoutUrl?: string;
  accessoriesImageUrl?: string;
  typeOfPlugUrl?: string;
  wiringConnectionUrl?: string;
}

export async function generateTdsPdf(input: GenerateTdsInput): Promise<Blob>
```

### TdsPreview Component

```typescript
interface TdsPreviewProps {
  product: any;
  headerBrand: "LIT" | "ECOSHIFT" | "OKO";
  itemCodeBrand?: "LIT" | "ECOSHIFT" | "OKO";
}
```

## Recent Updates

### OKO Brand Support (2026-10-27)

- Added OKO as a supported brand for TDS generation
- OKO header and footer images configured
- OKO added to brand selection dropdown in bulk TDS generation
- OKO item code support in the item code schema

### Header/Footer Resolution Fix (2026-10-27)

- Fixed header and footer images to maintain original aspect ratio
- Images are now scaled proportionally to fit page width
- No more stretching or distortion of brand logos
- Dynamic layout adjustment based on actual header height

### Refresh Button (2026-10-27)

- Added refresh button to product inventory page
- Refresh reloads product data while preserving search queries
- Shows loading spinner during refresh
- Available in both full view and read-only view

## Troubleshooting

### TDS Not Generating

1. Check that product has required fields (itemDescription, technicalSpecs)
2. Verify that brand images exist in `/public/templates/`
3. Check browser console for errors
4. Ensure Firestore connection is active

### Header/Footer Not Showing

1. Verify `includeBrandAssets` is set to `true`
2. Check that brand images exist in correct location
3. Ensure brand name matches case (e.g., "OKO" not "oko")
4. Check that image files are valid PNG format

### Item Codes Not Displaying

1. Verify item codes are filled in product data
2. Check that item code brand is specified if using multi-brand
3. Ensure new item code schema is properly populated
4. Check that item codes are not empty or "N/A"

## Brand Management

To add a new brand:

1. Add brand header image to `/public/templates/{brand}-header.png`
2. Add brand footer image to `/public/templates/{brand}-footer.png`
3. Update `TdsBrand` type in `lib/tdsGenerator.ts`
4. Update `brandAssets` function in `lib/tdsGenerator.ts`
5. Update `ITEM_CODE_BRAND_CONFIG` in `types/product.ts`
6. Update `TDS_BRAND_OPTIONS` in `app/products/all-products/page.tsx`
7. Update type definitions in `components/tds-preview.tsx`

## Technical Specifications

### PDF Layout

- **Page Size**: A4 (595pt x 842pt)
- **Margins**: Left 28pt, Right 28pt
- **Header Height**: Dynamic (based on image aspect ratio)
- **Footer Reserve**: 72pt
- **Product Image Box**: 155pt x 130pt
- **Font Size Range**: 6.5pt - 8.5pt (auto-scales to fit content)

### Image Slots

The TDS supports the following technical drawing images:

1. Dimensional Drawing
2. Recommended Mounting Height
3. Driver Compatibility
4. Base
5. Illuminance Level
6. Wiring Diagram
7. Installation
8. Wiring Layout
9. Terminal Layout
10. Accessories
11. Type of Plug
12. Wiring Connection

### Color Themes

Each brand has an associated color theme used in the UI:

- **LIT**: Yellow background, yellow border, yellow-700 text
- **ECOSHIFT**: Green background, green border, green-700 text
- **OKO**: Cyan background, cyan border, cyan-700 text
- **LUMERA**: Orange background, orange border, orange-700 text
- **ZUMTOBEL**: Zinc/black background, zinc border, zinc-900 text

## Dependencies

- `jspdf`: PDF generation
- `jspdf-autotable`: Table generation in PDF
- `motion/react`: Animations in preview component
- `lucide-react`: Icons

## License

Internal use only.
