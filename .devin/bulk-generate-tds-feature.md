# Bulk Generate TDS PDFs Feature

## Overview
The Bulk Generate TDS PDFs feature allows users to generate Technical Data Sheets (TDS) for multiple products at once, with support for selecting different brands for the header/footer and the item code displayed in the TDS.

## Feature Details

### Two-Step Selection Process

#### Step 1: Select Header Brand
- **Purpose**: Determines which brand header and footer images appear on the TDS
- **Options**: LIT or Ecoshift
- **Description**: 
  - LIT: LIT brand header & footer
  - Ecoshift: Ecoshift brand header & footer

#### Step 2: Select Item Code Brand (Conditional)
- **Purpose**: Determines which item code appears in the TDS
- **Options**: LIT or Ecoshift
- **When Shown**: Only when selected products have **both** LIT and Ecoshift item codes
- **When Hidden**: When selected products have only **one** item code brand (auto-selected)

### Smart Behavior

#### Multiple Item Codes (LIT + Ecoshift)
- Shows step indicator: `1 — 2`
- User selects header brand in Step 1
- User selects item code brand in Step 2
- Button flow: "Next" → "Generate TDS"
- Description: "X products queued · Multiple item codes detected"

#### Single Item Code (LIT only or Ecoshift only)
- No step indicator shown
- Step 2 is automatically skipped
- Single item code brand is auto-selected
- Button shows "Generate TDS" directly (no "Next")
- Description: "X products queued · Single item code"

## Technical Implementation

### Files Modified

1. **app/products/all-products/page.tsx**
   - `BulkGenerateTdsDialog` component:
     - Added `selectedProducts` prop to access product data
     - Added `hasMultipleItemCodeBrands` check to detect if products have multiple item code brands
     - Added auto-selection logic for single item code brands
     - Added conditional rendering for step 2 and step indicator
     - Modified button behavior to skip step 2 when only one item code brand exists
   - `handleOpenBulkTds`:
     - Added `selectedBulkTdsProducts` state to track selected products
   - State management:
     - Added `selectedBulkTdsProducts` state

2. **lib/tdsGenerator.ts**
   - `GenerateTdsInput` interface:
     - Added `itemCodeBrand?: ItemCodeBrand` parameter
   - `buildItemCodeRows` function:
     - Added logic to respect `itemCodeBrand` parameter
     - If `itemCodeBrand` is specified, only that brand's item code is shown
     - If not specified, all filled item codes are shown (existing behavior)
   - `generateTdsPdf` function:
     - Updated to pass `itemCodeBrand` to `buildItemCodeRows`

### Key Logic

#### Item Code Brand Detection
```typescript
const hasMultipleItemCodeBrands = React.useMemo(() => {
  const brands = new Set<"LIT" | "ECOSHIFT">();
  selectedProducts.forEach((product) => {
    const codes = resolveItemCodes(product);
    const filled = getFilledItemCodes(codes);
    filled.forEach(({ brand }) => {
      if (brand === "LIT" || brand === "ECOSHIFT") {
        brands.add(brand);
      }
    });
  });
  return brands.size > 1;
}, [selectedProducts]);
```

#### Auto-Selection for Single Item Code
```typescript
React.useEffect(() => {
  if (open && !hasMultipleItemCodeBrands) {
    const brands = new Set<"LIT" | "ECOSHIFT">();
    selectedProducts.forEach((product) => {
      const codes = resolveItemCodes(product);
      const filled = getFilledItemCodes(codes);
      filled.forEach(({ brand }) => {
        if (brand === "LIT" || brand === "ECOSHIFT") {
          brands.add(brand);
        }
      });
    });
    if (brands.size === 1) {
      setSelectedItemCodeBrand(Array.from(brands)[0]);
    }
  }
}, [open, hasMultipleItemCodeBrands, selectedProducts]);
```

#### Conditional Step Navigation
```typescript
const handleNextStep = () => {
  if (currentStep === 1 && selectedHeaderBrand) {
    // If only one item code brand exists, skip step 2 and generate directly
    if (!hasMultipleItemCodeBrands && selectedItemCodeBrand) {
      onStart(selectedHeaderBrand, selectedItemCodeBrand);
    } else {
      setCurrentStep(2);
    }
  }
};
```

## Use Cases

### Scenario 1: Mixed Brand Products
- **Products**: Items with both LIT and Ecoshift item codes
- **Flow**: 
  1. Select header brand (e.g., Ecoshift)
  2. Select item code brand (e.g., LIT)
  3. Generate TDS with Ecoshift header but LIT item code

### Scenario 2: Single Brand Products
- **Products**: Items with only LIT item codes
- **Flow**:
  1. Select header brand (e.g., LIT)
  2. Auto-selects LIT item code brand
  3. Generate TDS immediately (no step 2)

## Benefits

1. **Flexibility**: Allows mixing header brand with different item code brands
2. **Efficiency**: Skips unnecessary steps when only one item code exists
3. **User Experience**: Clear visual indicators and smart defaults
4. **Type Safety**: Proper TypeScript typing for LIT/ECOSHIFT brands only

## Notes

- The feature only supports LIT and ECOSHIFT brands for header and item code selection
- Other item code brands (LUMERA, OKO, ZUMTOBEL) are filtered out during the multiple brand check
- The TDS generator respects the `itemCodeBrand` parameter to display only the selected brand's item code
