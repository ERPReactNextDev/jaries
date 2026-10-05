"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Key,
  Copy,
  Trash2,
  Plus,
  Shield,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "@/lib/firestore/client";
import { onAuthStateChanged } from "firebase/auth";

interface ApiKey {
  keyId: string;
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  lastUsedAt: string | null;
  usageCount: number;
}

interface UserData {
  fullName: string;
  email: string;
  role: string;
}

export default function APIManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: {
      "products:read": true,
    },
  });

  // Check superadmin access
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "adminaccount", user.uid));

          if (userDoc.exists()) {
            const data = userDoc.data();
            const userRole = String(data.role || "")
              .toLowerCase()
              .trim();

            setUser({
              fullName: data.fullName || user.displayName || "User",
              email: user.email || "",
              role: userRole,
            });

            if (userRole !== "superadmin") {
              toast.error("Access Denied", {
                description: "This page is restricted to superadmin only.",
              });
              router.push("/products/all-products");
              return;
            }
          } else {
            router.push("/auth/login");
            return;
          }
        } catch (error) {
          console.error("Error checking access:", error);
          router.push("/auth/login");
        } finally {
          setLoading(false);
        }
      } else {
        router.push("/auth/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch API keys
  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/api-keys?action=list");
      if (!res.ok) throw new Error("Failed to fetch API keys");

      const data = await res.json();
      setApiKeys(data.keys || []);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      toast.error("Failed to load API keys");
    }
  }, []);

  useEffect(() => {
    if (user?.role === "superadmin") {
      fetchApiKeys();
    }
  }, [user, fetchApiKeys]);

  const handleGenerateKey = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const permissions = Object.entries(formData.permissions)
        .filter(([_, enabled]) => enabled)
        .map(([perm]) => perm);

      const res = await fetch("/api/admin/api-keys?action=generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          permissions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate API key");
      }

      setGeneratedKey(data.apiKey);
      toast.success("API Key Generated", {
        description: data.message,
      });

      // Refresh the list
      fetchApiKeys();
    } catch (error: any) {
      toast.error("Error", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!selectedKey) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/api-keys?action=revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: selectedKey.keyId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke API key");
      }

      toast.success("API Key Revoked", {
        description: data.message,
      });

      setIsRevokeDialogOpen(false);
      setSelectedKey(null);
      fetchApiKeys();
    } catch (error: any) {
      toast.error("Error", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      permissions: {
        "products:read": true,
      },
    });
    setGeneratedKey(null);
    setShowGeneratedKey(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "superadmin") {
    return null; // Will redirect
  }

  return (
    <SidebarProvider>
      <TooltipProvider>
        <AppSidebar />
        <SidebarInset>
        <div className="h-dvh flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white/80 backdrop-blur-md border-b">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">API Key Management</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Generate and manage API keys for third-party integrations
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  Active Keys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{apiKeys.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-blue-500" />
                  API Endpoints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <code className="bg-gray-100 px-2 py-1 rounded">/api/public-api?endpoint=products</code>
                  <br />
                  <code className="bg-gray-100 px-2 py-1 rounded">/api/public-api?endpoint=product-detail</code>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Security Notice
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  API keys grant access to product data. Keep keys secure and rotate them regularly.
                </p>
              </CardContent>
            </Card>
          </div>

            <Card className="mt-6">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Active API Keys</CardTitle>
                  <CardDescription>Manage existing API keys and their permissions</CardDescription>
                </div>
                <Button onClick={() => { resetForm(); setIsGenerateDialogOpen(true); }} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Generate New Key
                </Button>
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No API keys generated yet. Click &quot;Generate New Key&quot; to create one.
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto -mx-6 px-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32">Name</TableHead>
                            <TableHead className="w-40">Permissions</TableHead>
                            <TableHead className="w-28">Usage</TableHead>
                            <TableHead className="w-40">Last Used</TableHead>
                            <TableHead className="w-40">Created</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {apiKeys.map((key) => (
                            <TableRow key={key.keyId}>
                              <TableCell>
                                <div className="font-medium">{key.name}</div>
                                {key.description && (
                                  <div className="text-xs text-muted-foreground">{key.description}</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {key.permissions.map((perm) => (
                                    <Badge key={perm} variant="secondary" className="text-xs whitespace-nowrap">
                                      {perm}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{key.usageCount} requests</TableCell>
                              <TableCell className="whitespace-nowrap">{formatDate(key.lastUsedAt)}</TableCell>
                              <TableCell className="whitespace-nowrap">{formatDate(key.createdAt)}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    setSelectedKey(key);
                                    setIsRevokeDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                      {apiKeys.map((key) => (
                        <div key={key.keyId} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">{key.name}</div>
                              {key.description && (
                                <div className="text-xs text-muted-foreground">{key.description}</div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedKey(key);
                                setIsRevokeDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {key.permissions.map((perm) => (
                              <Badge key={perm} variant="secondary" className="text-xs">
                                {perm}
                              </Badge>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Usage:</span>
                              <div>{key.usageCount} requests</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Last Used:</span>
                              <div>{formatDate(key.lastUsedAt)}</div>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Created:</span>
                              <div>{formatDate(key.createdAt)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* API Endpoint Guide */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-blue-500" />
                  API Endpoint Guide
                </CardTitle>
                <CardDescription>
                  Learn how to use the API endpoints with your generated API keys
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between px-0">
                      <span className="font-medium">GET /api/public-api?endpoint=products</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      List all products with optional filters. Requires <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">products:read</code> permission.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Query Params:</strong> status (default: public), pageSize
                    </p>
                    <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                      <p className="text-green-400">// Example Request</p>
                      <p>curl -X GET \</p>
                      <p>{'  '}https://your-domain.com/api/public-api?endpoint=products \</p>
                      <p>{'  '}-H &quot;X-API-Key: YOUR_API_KEY&quot;</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between px-0">
                      <span className="font-medium">GET /api/public-api?endpoint=product-detail&id={'{id}'}</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Get a single product by ID. Requires <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">products:read</code> permission.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Query Params:</strong> id (required)
                    </p>
                    <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                      <p className="text-green-400">// Example Request</p>
                      <p>curl -X GET \</p>
                      <p>{'  '}https://your-domain.com/api/public-api?endpoint=product-detail&id=abc123 \</p>
                      <p>{'  '}-H &quot;X-API-Key: YOUR_API_KEY&quot;</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between px-0">
                      <span className="font-medium">Authentication</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      All API requests require authentication via the <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">X-API-Key</code> header.
                    </p>
                    <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                      <p className="text-green-400">// Header Format</p>
                      <p>X-API-Key: jari_xxxxxxxxxxxxxxxx</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-800 font-medium">Important:</p>
                      <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
                        <li>Keep your API key secure and never share it publicly</li>
                        <li>Include the X-API-Key header in every request</li>
                        <li>API keys are tied to specific permissions</li>
                        <li>Revoke compromised keys immediately</li>
                      </ul>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between px-0">
                      <span className="font-medium">Error Handling</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      The API returns standard HTTP status codes and JSON error responses.
                    </p>
                    <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                      <p className="text-green-400">// 401 Unauthorized</p>
                      <p>{'{'} error: &quot;API key required&quot; {'}'}</p>
                    </div>
                    <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                      <p className="text-green-400">// 403 Forbidden</p>
                      <p>{'{'} error: &quot;Permission denied: products:read required&quot; {'}'}</p>
                    </div>
                    <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                      <p className="text-green-400">// 404 Not Found</p>
                      <p>{'{'} error: &quot;Product not found&quot; {'}'}</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

          {/* Generate Key Dialog */}
          <Dialog
            open={isGenerateDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                resetForm();
              }
              setIsGenerateDialogOpen(open);
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Generate New API Key</DialogTitle>
                <DialogDescription>
                  Create a new API key for third-party access to products.
                </DialogDescription>
              </DialogHeader>

              {generatedKey ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Copy this key now!</p>
                        <p className="text-xs text-amber-700 mt-1">
                          This is the only time you will see the full API key. Store it securely.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Your API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showGeneratedKey ? "text" : "password"}
                          value={generatedKey}
                          readOnly
                          className="font-mono text-sm pr-20"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-8 top-0 h-full"
                          onClick={() => setShowGeneratedKey(!showGeneratedKey)}
                        >
                          {showGeneratedKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(generatedKey)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={() => {
                        setIsGenerateDialogOpen(false);
                        resetForm();
                      }}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Done
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Key Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Production API Key"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="What is this key used for?"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Permissions</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="products-read"
                          checked={formData.permissions["products:read"]}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              permissions: { ...formData.permissions, "products:read": checked as boolean },
                            })
                          }
                        />
                        <Label htmlFor="products-read" className="font-normal">
                          products:read - Access product data
                        </Label>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleGenerateKey} disabled={isSubmitting || !formData.name.trim()}>
                      {isSubmitting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Key className="h-4 w-4 mr-2" />
                      )}
                      Generate Key
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Revoke Key Dialog */}
          <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Revoke API Key
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to revoke the API key &quot;{selectedKey?.name}&quot;? This action cannot be undone.
                  Any applications using this key will immediately lose access.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRevokeDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleRevokeKey} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Revoke Key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        </div>
      </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
}
