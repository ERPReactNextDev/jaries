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
  getDoc,
  deleteDoc,
  Timestamp,
} from "@/lib/firestore/client";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export const dynamic = "force-dynamic";

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
        const keysQuery = query(collection(db, "apiKeys"), where("isActive", "==", true));
        const snapshot = await getDocs(keysQuery);
        const keys = snapshot.docs.map((d) => {
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
        });
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
  } catch (error: any) {
    console.error("API Keys error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
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
