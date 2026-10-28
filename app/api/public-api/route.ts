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
  startAfter,
  limit,
  orderBy,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QueryConstraint,
  type QuerySnapshot,
} from "@/lib/firestore/client";
import crypto from "crypto";
import { migrateToItemCodes, hasAtLeastOneItemCode } from "@/lib/produc";

export const dynamic = "force-dynamic";

const PRODUCT_READ_BATCH_SIZE = 500;
const MAX_PRODUCT_PAGE_SIZE = 500;

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function buildProductsQuery(
  status: string | null,
  cursor: string | null,
  pageSize: number,
): Query<DocumentData> {
  const constraints: QueryConstraint[] = [orderBy("__name__", "asc")];
  if (status) constraints.unshift(where("status", "==", status));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  return query(collection(db, "products"), ...constraints);
}

function serializeProduct(id: string, data: DocumentData) {
  const itemCodes = migrateToItemCodes({
    itemCodes: data.itemCodes,
    litItemCode: data.litItemCode,
    ecoItemCode: data.ecoItemCode,
    itemCode: data.itemCode,
  });
  return {
    id,
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
        const pageSizeParam = searchParams.get("pageSize");
        const pageSize = pageSizeParam === null ? null : Number(pageSizeParam);
        const cursor = searchParams.get("cursor");

        if (
          pageSize !== null &&
          (!Number.isInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > MAX_PRODUCT_PAGE_SIZE)
        ) {
          return NextResponse.json(
            { error: `pageSize must be an integer between 1 and ${MAX_PRODUCT_PAGE_SIZE}` },
            { status: 400 },
          );
        }

        if (cursor && pageSize === null) {
          return NextResponse.json(
            { error: "pageSize is required when using cursor" },
            { status: 400 },
          );
        }

        const products: ReturnType<typeof serializeProduct>[] = [];
        let nextCursor: string | null = null;

        if (pageSize !== null) {
          const snapshot: QuerySnapshot<DocumentData> = await getDocs(
            buildProductsQuery(status, cursor, pageSize + 1),
          );
          const pageDocs = snapshot.docs.slice(0, pageSize);
          products.push(
            ...pageDocs.map((product) =>
              serializeProduct(product.id, product.data()),
            ),
          );
          if (snapshot.docs.length > pageSize && pageDocs.length > 0) {
            nextCursor = pageDocs[pageDocs.length - 1].id;
          }
        } else {
          let batchCursor: string | null = null;
          while (true) {
            const snapshot: QuerySnapshot<DocumentData> = await getDocs(
              buildProductsQuery(status, batchCursor, PRODUCT_READ_BATCH_SIZE),
            );
            products.push(
              ...snapshot.docs.map((product) =>
                serializeProduct(product.id, product.data()),
              ),
            );
            if (snapshot.docs.length < PRODUCT_READ_BATCH_SIZE) break;
            batchCursor = snapshot.docs[snapshot.docs.length - 1].id;
          }
        }

        return NextResponse.json({
          data: products,
          count: products.length,
          nextCursor,
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

        let cursor: string | null = null;
        let matchedProduct: QueryDocumentSnapshot<DocumentData> | null = null;
        const searchCode = itemCode.trim().toLowerCase();
        while (!matchedProduct) {
          const snapshot: QuerySnapshot<DocumentData> = await getDocs(
            buildProductsQuery(status, cursor, PRODUCT_READ_BATCH_SIZE),
          );
          matchedProduct = snapshot.docs.find((d) => {
            const data = d.data();

            if (data.itemCodes) {
              for (const brand of Object.keys(data.itemCodes)) {
                if (data.itemCodes[brand]?.toLowerCase() === searchCode) {
                  return true;
                }
              }
            }

            if (data.itemCode?.toLowerCase() === searchCode) return true;
            if (data.litItemCode?.toLowerCase() === searchCode) return true;
            if (data.ecoItemCode?.toLowerCase() === searchCode) return true;

            return false;
          }) ?? null;

          if (
            matchedProduct ||
            snapshot.docs.length < PRODUCT_READ_BATCH_SIZE
          ) {
            break;
          }
          cursor = snapshot.docs[snapshot.docs.length - 1].id;
        }

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
  } catch (error: unknown) {
    console.error("Public API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}