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

        const status = searchParams.get("status") ?? "public";

        const productsQuery = query(
          collection(db, "products"),
          where("status", "==", status)
        );

        const snapshot = await getDocs(productsQuery);
        const products = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name,
            slug: data.slug,
            itemCode: data.itemCode,
            itemCodes: data.itemCodes,
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
        return NextResponse.json({
          id: productDoc.id,
          name: data.name,
          slug: data.slug,
          itemCode: data.itemCode,
          itemCodes: data.itemCodes,
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
