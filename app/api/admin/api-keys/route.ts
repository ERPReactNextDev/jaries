import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc,
  Timestamp,
  startAfter,
  limit,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "@/lib/firestore/client";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const API_KEY_READ_BATCH_SIZE = 500;

function generateApiKey(): string {
  return "jari_" + crypto.randomBytes(32).toString("hex");
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function handleRequest(req: NextRequest) {
  const session = await getSession();
  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "superadmin") {
    return NextResponse.json({ error: "Access denied. Superadmin only." }, { status: 403 });
  }

  try {
    switch (action) {
      case "generate": {
        const body = await req.json();
        const { name, description, permissions = ["products:read"] } = body;
        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const apiKey = generateApiKey();
        const hashedKey = hashApiKey(apiKey);
        const keyData = {
          keyId: crypto.randomUUID(),
          hashedKey,
          name,
          description: description || "",
          permissions,
          isActive: true,
          createdAt: Timestamp.now(),
          createdBy: session.uid,
          lastUsedAt: null,
          usageCount: 0,
        };
        await setDoc(doc(db, "apiKeys", keyData.keyId), keyData);
        return NextResponse.json(
          {
            success: true,
            apiKey,
            keyData: {
              keyId: keyData.keyId,
              name: keyData.name,
              description: keyData.description,
              permissions: keyData.permissions,
              isActive: keyData.isActive,
              createdAt: keyData.createdAt.toDate().toISOString(),
              createdBy: keyData.createdBy,
            },
            message: "API Key generated successfully. Store this key securely - it will not be shown again.",
          },
          { status: 201 }
        );
      }

      case "list": {
        const keys: Array<{
          keyId: string;
          name: string;
          description: string;
          permissions: string[];
          isActive: boolean;
          createdAt: string | null;
          createdBy: string;
          lastUsedAt: string | null;
          usageCount: number;
        }> = [];
        let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

        while (true) {
          const keysQuery: Query<DocumentData> = cursor
            ? query(
                collection(db, "apiKeys"),
                where("isActive", "==", true),
                startAfter(cursor),
                limit(API_KEY_READ_BATCH_SIZE),
              )
            : query(
                collection(db, "apiKeys"),
                where("isActive", "==", true),
                limit(API_KEY_READ_BATCH_SIZE),
              );
          const snapshot: QuerySnapshot<DocumentData> = await getDocs(keysQuery);
          keys.push(
            ...snapshot.docs.map((d) => {
              const data = d.data();
              return {
                keyId: data.keyId,
                name: data.name,
                description: data.description,
                permissions: data.permissions,
                isActive: data.isActive,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                createdBy: data.createdBy,
                lastUsedAt: data.lastUsedAt?.toDate?.()?.toISOString() || null,
                usageCount: data.usageCount || 0,
              };
            }),
          );

          if (snapshot.docs.length < API_KEY_READ_BATCH_SIZE) break;
          cursor = snapshot.docs[snapshot.docs.length - 1];
        }

        return NextResponse.json({ keys });
      }

      case "revoke": {
        const body = await req.json();
        const { keyId } = body;
        if (!keyId) return NextResponse.json({ error: "keyId is required" }, { status: 400 });

        await updateDoc(doc(db, "apiKeys", keyId), {
          isActive: false,
          revokedAt: Timestamp.now(),
        });
        return NextResponse.json(
          {
            success: true,
            message: "API Key revoked successfully.",
          },
          { status: 200 }
        );
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error("API Keys error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}