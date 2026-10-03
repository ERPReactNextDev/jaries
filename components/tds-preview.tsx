"use client";

import React from "react";

interface TdsPreviewProps {
  product: any;
  headerBrand: "LIT" | "ECOSHIFT";
  itemCodeBrand?: "LIT" | "ECOSHIFT";
}

// A4 base canvas (pt). Everything is laid out at this size, then scaled to fit.
const PAGE_W = 595;
const PAGE_H = 842;

// Spec table font range (px at base canvas size)
const MAX_FONT = 9;
const MIN_FONT = 3.5;

// Reserved height per drawing row (label + image) so drawings never collapse
const DRAWING_ROW_MIN_H = 85;

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function resolveItemCodes(product: any): any {
  if (product.itemCodes && typeof product.itemCodes === "object") {
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
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [scale, setScale] = React.useState(1);
  const [assetTick, setAssetTick] = React.useState(0); // refit after header/footer load

  // Scale the fixed A4 canvas to the available width
  React.useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / PAGE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const codes = resolveItemCodes(product);
  const filledCodes = getFilledItemCodes(codes);

  const displayItemCode = itemCodeBrand
    ? codes[itemCodeBrand] || ""
    : filledCodes[0]?.code || "";
  const displayItemCodeBrand = itemCodeBrand || filledCodes[0]?.brand || "LIT";

  const itemDescription = product.itemDescription || product.name || "";
  const mainImage =
    product.mainImage ||
    (Array.isArray(product.rawImage) ? product.rawImage[0] : (product.rawImage as string)) ||
    "";

  const technicalSpecs = (product.technicalSpecs ?? [])
    .map((group: any) => ({
      ...group,
      specs: (group.specs ?? []).filter((s: any) => {
        const v = (s.value ?? "").toUpperCase().trim();
        return v !== "" && v !== "N/A";
      }),
    }))
    .filter((group: any) => (group.specs ?? []).length > 0);

  // Same drawing slots the PDF generator uses
  const p = product as any;
  const drawings = [
    { label: "Dimensional Drawing", url: p.dimensionDrawingImage || p.dimensionalDrawingImage },
    { label: "Recommended Mounting Height", url: p.mountingHeightImage || p.recommendedMountingHeightImage },
    { label: "Driver Compatibility", url: p.driverCompatibilityImage },
    { label: "Base", url: p.baseImage },
    { label: "Illuminance Level", url: p.illuminanceLevelImage },
    { label: "Wiring Diagram", url: p.wiringDiagramImage },
    { label: "Installation", url: p.installationImage },
    { label: "Wiring Layout", url: p.wiringLayoutImage },
    { label: "Terminal Layout", url: p.terminalLayoutImage },
    { label: "Accessories", url: p.accessoriesImage },
    { label: "Type of Plug", url: p.typeOfPlugImage },
    { label: "Wiring Connection", url: p.wiringConnectionImage },
  ].filter((d) => !!d.url);

  const drawingRows: (typeof drawings)[] = [];
  for (let i = 0; i < drawings.length; i += 3) drawingRows.push(drawings.slice(i, i + 3));

  // Auto-fit: shrink the spec table font until EVERYTHING fits inside the page
  useIsoLayoutEffect(() => {
    const content = contentRef.current;
    const table = tableRef.current;
    if (!content || !table) return;

    let size = MAX_FONT;
    table.style.fontSize = `${size}px`;
    while (size > MIN_FONT && content.scrollHeight > content.clientHeight + 0.5) {
      size -= 0.25;
      table.style.fontSize = `${size}px`;
    }
  }, [product, headerBrand, itemCodeBrand, assetTick]);

  const bumpTick = () => setAssetTick((t) => t + 1);

  // Cell padding is in em so it shrinks together with the font
  const cellStyle: React.CSSProperties = { padding: "0.28em 0.6em" };

  return (
    <div
      ref={wrapperRef}
      className="w-full relative bg-white border shadow-md overflow-hidden"
      style={{ height: PAGE_H * scale }}
    >
      <div
        className="absolute top-0 left-0 flex flex-col bg-white overflow-hidden"
        style={{
          width: PAGE_W,
          height: PAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Header — full image, natural ratio (no cropping) */}
        <div className="shrink-0">
          <img
            key={`h-${headerBrand}`}
            src={`/templates/${headerBrand.toLowerCase()}-header.png`}
            alt={`${headerBrand} header`}
            className="block w-full h-auto"
            onLoad={bumpTick}
          />
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 min-h-0 flex flex-col gap-3 px-7 pt-3 pb-2 overflow-hidden"
        >
          {/* Product image + title */}
          <div className="shrink-0 flex gap-5 items-center">
            <div
              className="border-2 border-black flex items-center justify-center bg-white shrink-0"
              style={{ width: 110, height: 92 }}
            >
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={itemDescription}
                  className="w-full h-full object-contain p-1.5"
                />
              ) : (
                <div className="text-gray-400 text-[9px]">No Image</div>
              )}
            </div>
            <div className="flex-1 text-center">
              <h2 className="text-[17px] leading-tight font-bold text-gray-900 uppercase">
                {itemDescription}
              </h2>
              <div className="h-px bg-gray-500 mt-2" />
            </div>
          </div>

          {/* Specs table — font auto-shrinks so ALL specs fit */}
          <div className="shrink-0 border border-gray-300">
            <table
              ref={tableRef}
              className="w-full border-collapse"
              style={{ fontSize: MAX_FONT, lineHeight: 1.15 }}
            >
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="font-bold uppercase" style={{ ...cellStyle, width: "36%" }}>
                    {displayItemCodeBrand} ITEM CODE :
                  </td>
                  <td className="uppercase" style={cellStyle}>
                    {displayItemCode || "—"}
                  </td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="font-bold uppercase" style={cellStyle}>
                    BRAND :
                  </td>
                  <td className="font-bold uppercase" style={cellStyle}>
                    {headerBrand}
                  </td>
                </tr>
                {technicalSpecs.map((group: any, gi: number) => (
                  <React.Fragment key={gi}>
                    <tr className="border-b border-gray-300 bg-gray-200">
                      <td colSpan={2} className="font-bold uppercase" style={cellStyle}>
                        {group.specGroup}
                      </td>
                    </tr>
                    {group.specs.map((spec: any, si: number) => (
                      <tr key={si} className="border-b border-gray-300">
                        <td className="font-bold uppercase" style={cellStyle}>
                          {spec.name} :
                        </td>
                        <td className="uppercase" style={cellStyle}>
                          {spec.value}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Drawings — label sits right above its image, images shrink to fit */}
          {drawingRows.length > 0 && (
            <div
              className="flex-1 flex flex-col gap-1"
              style={{ minHeight: drawingRows.length * DRAWING_ROW_MIN_H }}
            >
              {drawingRows.map((row, ri) => (
                <div
                  key={ri}
                  className="flex-1 min-h-0 grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                >
                  {row.map((d) => (
                    <div key={d.label} className="min-h-0 flex flex-col items-stretch">
                      <p className="shrink-0 text-[7px] font-bold uppercase text-gray-700 text-center leading-none mb-0.5">
                        {d.label}
                      </p>
                      <div className="flex-1 min-h-0">
                        <img
                          src={d.url}
                          alt={d.label}
                          className="w-full h-full object-contain object-top"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — full image, natural ratio, pinned to bottom */}
        <div className="shrink-0">
          <img
            key={`f-${headerBrand}`}
            src={`/templates/${headerBrand.toLowerCase()}-footer.png`}
            alt={`${headerBrand} footer`}
            className="block w-full h-auto"
            onLoad={bumpTick}
          />
        </div>
      </div>
    </div>
  );
}