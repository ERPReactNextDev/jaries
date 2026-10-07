import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  orderBy,
  limit,
} from "@/lib/firestore/client";
import crypto from "crypto";
import { migrateToItemCodes, hasAtLeastOneItemCode } from "@/lib/produc";

export const dynamic = "force-dynamic";

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function validateApiKey(
  apiKey: string
): Promise<{ valid: boolean; permissions?: string[]; keyId?: string; error?: string }> {
  if (!apiKey || !apiKey.startsWith("jari_")) {
    return { valid: false, error: "Invalid API key format" };
  }

  const hashedKey = hashApiKey(apiKey);
  const keysQuery = query(
    collection(db, "apiKeys"),
    where("hashedKey", "==", hashedKey),
    where("isActive", "==", true)
  );
  const snapshot = await getDocs(keysQuery);

  if (snapshot.empty) {
    return { valid: false, error: "Invalid or revoked API key" };
  }

  const keyDoc = snapshot.docs[0];
  const keyData = keyDoc.data();

  await updateDoc(doc(db, "apiKeys", keyDoc.id), {
    lastUsedAt: Timestamp.now(),
    usageCount: (keyData.usageCount || 0) + 1,
  });

  return { valid: true, permissions: keyData.permissions || [], keyId: keyData.keyId };
}

function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes(required) || permissions.includes("admin");
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ?? "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key required. Include X-API-Key header." },
      { status: 401 }
    );
  }

  const validation = await validateApiKey(apiKey);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 401 });
  }

  const { permissions } = validation;
  const { searchParams } = req.nextUrl;
  const endpoint = searchParams.get("endpoint");

  try {
    switch (endpoint) {
      case "products": {
        if (!hasPermission(permissions!, "products:read")) {
          return NextResponse.json(
            { error: "Permission denied: products:read required" },
            { status: 403 }
          );
        }

        const status = searchParams.get("status");

        let productsQuery;
        if (status) {
          productsQuery = query(
            collection(db, "products"),
            where("status", "==", status)
          );
        } else {
          productsQuery = query(collection(db, "products"));
        }

        const snapshot = await getDocs(productsQuery);
        const products = snapshot.docs.map((d) => {
          const data = d.data();
          // Migrate legacy itemCode fields to new itemCodes format
          const itemCodes = migrateToItemCodes({
            itemCodes: data.itemCodes,
            litItemCode: data.litItemCode,
            ecoItemCode: data.ecoItemCode,
            itemCode: data.itemCode,
          });
          return {
            id: d.id,
            name: data.name,
            slug: data.slug,
            itemCode: data.itemCode,
            itemCodes: hasAtLeastOneItemCode(itemCodes) ? itemCodes : undefined,
            itemDescription: data.itemDescription,
            shortDescription: data.shortDescription,
            productClass: data.productClass,
            productFamily: data.productFamily,
            productUsage: data.productUsage,
            brand: data.brand,
            mainImage: data.mainImage,
            baseImage: data.baseImage,
            galleryImages: data.galleryImages,
            technicalSpecs: data.technicalSpecs,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            promoPrice: data.promoPrice,
            status: data.status,
            seo: data.seo,
            websites: data.websites,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
          };
        });

        return NextResponse.json({
          data: products,
          count: products.length,
        });
      }

      case "product-detail": {
        if (!hasPermission(permissions!, "products:read")) {
          return NextResponse.json(
            { error: "Permission denied: products:read required" },
            { status: 403 }
          );
        }

        const id = searchParams.get("id");
        if (!id) {
          return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
        }

        const productDoc = await getDoc(doc(db, "products", id));
        if (!productDoc.exists()) {
          return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const data = productDoc.data();
        // Migrate legacy itemCode fields to new itemCodes format
        const itemCodes = migrateToItemCodes({
          itemCodes: data.itemCodes,
          litItemCode: data.litItemCode,
          ecoItemCode: data.ecoItemCode,
          itemCode: data.itemCode,
        });
        return NextResponse.json({
          id: productDoc.id,
          name: data.name,
          slug: data.slug,
          itemCode: data.itemCode,
          itemCodes: hasAtLeastOneItemCode(itemCodes) ? itemCodes : undefined,
          itemDescription: data.itemDescription,
          shortDescription: data.shortDescription,
          productClass: data.productClass,
          productFamily: data.productFamily,
          productUsage: data.productUsage,
          brand: data.brand,
          mainImage: data.mainImage,
          baseImage: data.baseImage,
          galleryImages: data.galleryImages,
          technicalSpecs: data.technicalSpecs,
          regularPrice: data.regularPrice,
          salePrice: data.salePrice,
          promoPrice: data.promoPrice,
          status: data.status,
          seo: data.seo,
          websites: data.websites,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        });
      }

      case "product-by-itemcode": {
        if (!hasPermission(permissions!, "products:read")) {
          return NextResponse.json(
            { error: "Permission denied: products:read required" },
            { status: 403 }
          );
        }

        const itemCode = searchParams.get("itemCode");
        if (!itemCode) {
          return NextResponse.json({ error: "Item code is required" }, { status: 400 });
        }

        const status = searchParams.get("status");

        // Get all products (with optional status filter)
        let productsQuery;
        if (status) {
          productsQuery = query(
            collection(db, "products"),
            where("status", "==", status)
          );
        } else {
          productsQuery = query(collection(db, "products"));
        }

        const snapshot = await getDocs(productsQuery);
        
        // Search for matching item code (case-insensitive)
        const searchCode = itemCode.trim().toLowerCase();
        const matchedProduct = snapshot.docs.find((d) => {
          const data = d.data();
          
          // Check new itemCodes format
          if (data.itemCodes) {
            for (const brand of Object.keys(data.itemCodes)) {
              if (data.itemCodes[brand]?.toLowerCase() === searchCode) {
                return true;
              }
            }
          }
          
          // Check legacy fields
          if (data.itemCode?.toLowerCase() === searchCode) return true;
          if (data.litItemCode?.toLowerCase() === searchCode) return true;
          if (data.ecoItemCode?.toLowerCase() === searchCode) return true;
          
          return false;
        });

        if (!matchedProduct) {
          return NextResponse.json({ error: "Product not found with this item code" }, { status: 404 });
        }

        const data = matchedProduct.data();
        // Migrate legacy itemCode fields to new itemCodes format
        const itemCodes = migrateToItemCodes({
          itemCodes: data.itemCodes,
          litItemCode: data.litItemCode,
          ecoItemCode: data.ecoItemCode,
          itemCode: data.itemCode,
        });
        
        return NextResponse.json({
          id: matchedProduct.id,
          name: data.name,
          slug: data.slug,
          itemCode: data.itemCode,
          itemCodes: hasAtLeastOneItemCode(itemCodes) ? itemCodes : undefined,
          itemDescription: data.itemDescription,
          shortDescription: data.shortDescription,
          productClass: data.productClass,
          productFamily: data.productFamily,
          productUsage: data.productUsage,
          brand: data.brand,
          mainImage: data.mainImage,
          baseImage: data.baseImage,
          galleryImages: data.galleryImages,
          technicalSpecs: data.technicalSpecs,
          regularPrice: data.regularPrice,
          salePrice: data.salePrice,
          promoPrice: data.promoPrice,
          status: data.status,
          seo: data.seo,
          websites: data.websites,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        });
      }

      default:
        return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Public API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
