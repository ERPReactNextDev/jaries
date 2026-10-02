"use client";

import React from "react";

interface TdsPreviewProps {
  product: any;
  headerBrand: "LIT" | "ECOSHIFT";
  itemCodeBrand?: "LIT" | "ECOSHIFT";
}

// Local helper to resolve item codes
function resolveItemCodes(product: any): any {
  if (product.itemCodes && typeof product.itemCodes === 'object') {
    return product.itemCodes;
  }
  return {
    LIT: product.litItemCode || "",
    ECOSHIFT: product.ecoItemCode || "",
  };
}

function getFilledItemCodes(codes: any): Array<{ brand: string; code: string }> {
  const filled: Array<{ brand: string; code: string }> = [];
  if (codes.LIT) filled.push({ brand: "LIT", code: codes.LIT });
  if (codes.ECOSHIFT) filled.push({ brand: "ECOSHIFT", code: codes.ECOSHIFT });
  return filled;
}

export function TdsPreview({ product, headerBrand, itemCodeBrand }: TdsPreviewProps) {
  const codes = resolveItemCodes(product);
  const filledCodes = getFilledItemCodes(codes);
  
  // Get the item code to display
  const displayItemCode = itemCodeBrand 
    ? (codes[itemCodeBrand] || "")
    : (filledCodes[0]?.code || "");
  
  const itemDescription = product.itemDescription || product.name || "";
  const mainImage = product.mainImage || 
    (Array.isArray(product.rawImage) ? product.rawImage[0] : product.rawImage as string) || "";

  // Get technical specs
  const technicalSpecs = (product.technicalSpecs ?? [])
    .map((group: any) => ({
      ...group,
      specs: (group.specs ?? []).filter((s: any) => {
        const v = (s.value ?? "").toUpperCase().trim();
        return v !== "" && v !== "N/A";
      }),
    }))
    .filter((group: any) => (group.specs ?? []).length > 0);

  return (
    <div className="w-full bg-white border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="relative h-24 bg-gradient-to-r from-yellow-50 to-yellow-100">
        <img
          src={`/templates/${headerBrand.toLowerCase()}-header.png`}
          alt={`${headerBrand} header`}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Product Image and Title */}
        <div className="flex gap-6 items-start">
          {/* Product Image Box */}
          <div className="w-36 h-32 border-2 border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 shrink-0">
            {mainImage ? (
              <img
                src={mainImage}
                alt={itemDescription}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <div className="text-gray-400 text-xs">No Image</div>
            )}
          </div>

          {/* Product Name */}
          <div className="flex-1 text-center">
            <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
              {itemDescription}
            </h2>
            <div className="h-0.5 bg-gray-400 mt-2" />
          </div>
        </div>

        {/* Specifications Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="px-4 py-2 font-semibold bg-gray-100 w-1/2">BRAND :</td>
                <td className="px-4 py-2 font-bold">{headerBrand}</td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-2 font-semibold bg-gray-100 w-1/2">
                  {itemCodeBrand || "LIT"} ITEM CODE :
                </td>
                <td className="px-4 py-2 font-mono font-bold">{displayItemCode || "—"}</td>
              </tr>
              {technicalSpecs.map((group: any, groupIdx: number) => (
                <React.Fragment key={groupIdx}>
                  <tr className="border-b bg-gray-100">
                    <td colSpan={2} className="px-4 py-2 font-bold text-center">
                      {group.specGroup}
                    </td>
                  </tr>
                  {group.specs.map((spec: any, specIdx: number) => (
                    <tr key={specIdx} className="border-b">
                      <td className="px-4 py-2 font-semibold bg-gray-50">
                        {spec.name} :
                      </td>
                      <td className="px-4 py-2">{spec.value}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Drawings Section */}
        {(product as any).dimensionalDrawingImage || (product as any).illuminanceLevelImage ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide">Technical Drawings</h3>
            <div className="grid grid-cols-2 gap-4">
              {(product as any).dimensionalDrawingImage && (
                <div className="border rounded-lg p-2">
                  <p className="text-xs font-semibold mb-2 text-center">Dimensional Drawing</p>
                  <img
                    src={(product as any).dimensionalDrawingImage}
                    alt="Dimensional Drawing"
                    className="w-full h-32 object-contain"
                  />
                </div>
              )}
              {(product as any).illuminanceLevelImage && (
                <div className="border rounded-lg p-2">
                  <p className="text-xs font-semibold mb-2 text-center">Illuminance Level</p>
                  <img
                    src={(product as any).illuminanceLevelImage}
                    alt="Illuminance Level"
                    className="w-full h-32 object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="relative h-16 bg-gradient-to-r from-yellow-50 to-yellow-100">
        <img
          src={`/templates/${headerBrand.toLowerCase()}-footer.png`}
          alt={`${headerBrand} footer`}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    </div>
  );
}
