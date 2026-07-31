"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "@/lib/firestore/client";
import {
  Pencil,
  Trash2,
  Loader2,
  Plus,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useDropzone } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type KeyProject = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  createdAt?: any;
  updatedAt?: any;
};

export default function BuildchemKeyProjectsPage() {
  const [projects, setProjects] = useState<KeyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    imageUrl: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const q = collection(db, "buildchemKeyProjects");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as KeyProject[];
      setProjects(projectsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setFormData((prev) => ({ ...prev, imageUrl: url }));
      toast.success("Image uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload image");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop: (files) => {
      if (files[0]) {
        handleImageUpload(files[0]);
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, "buildchemKeyProjects", editingId), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        toast.success("Project updated successfully");
      } else {
        await addDoc(collection(db, "buildchemKeyProjects"), {
          ...formData,
          createdAt: serverTimestamp(),
        });
        toast.success("Project added successfully");
      }
      resetForm();
    } catch (error) {
      toast.error("Failed to save project");
      console.error(error);
    }
  };

  const handleEdit = (project: KeyProject) => {
    setEditingId(project.id);
    setFormData({
      title: project.title,
      description: project.description,
      imageUrl: project.imageUrl || "",
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "buildchemKeyProjects", id));
      toast.success("Project deleted successfully");
    } catch (error) {
      toast.error("Failed to delete project");
      console.error(error);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: "",
      description: "",
      imageUrl: "",
    });
  };

  return (
    <SidebarProvider>
      <TooltipProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/content">Contents</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Buildchem Key Projects</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  {editingId ? "Edit Project" : "Add New Project"}
                </h2>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Image
                    </label>
                    <div
                      {...getRootProps()}
                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <input {...getInputProps()} />
                      {formData.imageUrl ? (
                        <div className="relative">
                          <img
                            src={formData.imageUrl}
                            alt="Preview"
                            className="max-h-48 mx-auto rounded"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData((prev) => ({ ...prev, imageUrl: "" }));
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {uploading ? "Uploading..." : "Drag & drop image or click to browse"}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs text-muted-foreground mb-1">
                        Or paste Cloudinary URL:
                      </label>
                      <Input
                        value={formData.imageUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))
                        }
                        placeholder="https://res.cloudinary.com/..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Title *
                    </label>
                    <Input
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="Enter project title"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Description *
                    </label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Enter project description"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={uploading}>
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : editingId ? (
                        "Update Project"
                      ) : (
                        "Add Project"
                      )}
                    </Button>
                    {editingId && (
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-2xl font-bold">Projects List</h2>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : projects.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No projects yet. Add your first project above.
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                      <Card key={project.id}>
                        {project.imageUrl && (
                          <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                            <img
                              src={project.imageUrl}
                              alt={project.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-2">
                            {project.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                            {project.description}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(project)}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Project
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{project.title}"?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(project.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
}
