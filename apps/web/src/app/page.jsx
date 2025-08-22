"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Tag,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Upload,
  Edit2,
  Check,
  Trash,
  X,
} from "lucide-react";
import useUser from "@/utils/useUser";
import useUpload from "@/utils/useUpload";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function HomePage() {
  const { data: user, loading: userLoading } = useUser();
  const queryClient = useQueryClient();
  const [upload, { loading: uploadLoading }] = useUpload();

  // State management
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLink, setNewLink] = useState("");
  const [newTags, setNewTags] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [filterRead, setFilterRead] = useState("all");
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingBookmark, setEditingBookmark] = useState(null);
  const [editTags, setEditTags] = useState("");

  // Fetch bookmarks
  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ["bookmarks", searchQuery, selectedTags, filterRead],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedTags.length > 0) {
        selectedTags.forEach((tag) => params.append("tags", tag));
      }
      if (filterRead !== "all")
        params.append("is_read", filterRead === "read" ? "true" : "false");

      const response = await fetch(`/api/bookmarks?${params}`);
      if (!response.ok) throw new Error("Failed to fetch bookmarks");
      return response.json();
    },
    enabled: !!user,
  });

  // Get all unique tags
  const allTags = [
    ...new Set(
      bookmarks.flatMap((b) => [...(b.tags || []), ...(b.auto_tags || [])])
    ),
  ].sort();

  // Create bookmark mutation
  const createBookmark = useMutation({
    mutationFn: async (bookmarkData) => {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookmarkData),
      });
      if (!response.ok) throw new Error("Failed to create bookmark");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["bookmarks"]);
      setShowAddForm(false);
      setNewLink("");
      setNewTags("");
      setSelectedFile(null);
    },
  });

  // Update bookmark mutation
  const updateBookmark = useMutation({
    mutationFn: async ({ id, ...data }) => {
      const response = await fetch(`/api/bookmarks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update bookmark");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["bookmarks"]);
      setEditingBookmark(null);
      setEditTags("");
    },
  });

  // delete bookmark mutation
  const deleteBookmark = useMutation({
    mutationFn: async ({ id }) => {
      const response = await fetch(`/api/bookmarks/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to delete bookmark");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["bookmarks"]);
      setShowAddForm(false);
      setNewLink("");
      setNewTags("");
      setSelectedFile(null);
    },
  });

  // Toggle read status mutation
  const toggleReadStatus = useMutation({
    mutationFn: async ({ id, is_read }) => {
      const response = await fetch(`/api/bookmarks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: !is_read }),
      });
      if (!response.ok) throw new Error("Failed to update bookmark");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["bookmarks"]);
    },
  });

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file) => {
      try {
        const result = await upload({ reactWebFile: file });
        if (result.error) {
          console.error("Upload failed:", result.error);
          return null;
        }
        return result.url;
      } catch (error) {
        console.error("Upload error:", error);
        return null;
      }
    },
    [upload]
  );

  // Fetch metadata from URL
  const fetchMetadata = useCallback(async (url) => {
    if (!url) return null;

    setIsLoadingMetadata(true);
    try {
      const response = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error("Failed to fetch metadata");
      return await response.json();
    } catch (error) {
      console.error("Metadata fetch failed:", error);
      return null;
    } finally {
      setIsLoadingMetadata(false);
    }
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    let bookmarkData = {
      tags: newTags
        ? newTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    };

    if (selectedFile) {
      // Handle image upload
      const imageUrl = await handleFileUpload(selectedFile);
      if (imageUrl) {
        bookmarkData.url = imageUrl;
        bookmarkData.title = selectedFile.name;
        bookmarkData.content_type = "image";
        bookmarkData.thumbnail_url = imageUrl;
      }
    } else if (newLink) {
      // Handle URL
      const metadata = await fetchMetadata(newLink);
      bookmarkData = {
        ...bookmarkData,
        url: newLink,
        title: metadata?.title || newLink,
        description: metadata?.description,
        thumbnail_url: metadata?.image,
        content_type: metadata?.type || "article",
      };
    }

    if (bookmarkData.url) {
      createBookmark.mutate(bookmarkData);
    }
  };

  // Handle tag editing
  const handleEditTags = (bookmark) => {
    setEditingBookmark(bookmark.id);
    setEditTags((bookmark.tags || []).join(", "));
  };

  const handleSaveEditTags = () => {
    const tags = editTags
      .split(",")
      .map(
        (tag) =>
          tag
            .trim() // Remove leading/trailing spaces from the tag
            .toLowerCase() // Make everything lowercase first for consistency
            .split(/\s+/) // Split by any amount of spaces between words
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
            .join(" ") // Join words back together
      )
      .filter(Boolean);
    updateBookmark.mutate({ id: editingBookmark, tags });
  };

  const deleteId = (bookmark) => {
    deleteBookmark.mutate({ id: bookmark.id });
  };

  // Handle multiple tag selection
  const handleTagSelect = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Welcome to BookmarkHub
            </h1>
            <p className="text-gray-600 mb-8">
              Save and organize your favorite articles, videos, and content all
              in one place.
            </p>
            <div className="space-y-4">
              <a
                href="/account/signin"
                className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-md"
              >
                Sign In
              </a>
              <a
                href="/account/signup"
                className="block w-full border-2 border-blue-200 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-all transform hover:scale-105"
              >
                Create Account
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 font-inter text-[#1a1a1a]">
      <div className="container mx-auto px-4 py-8">
        <section className="w-full max-w-screen-2xl mx-auto rounded-2xl border border-blue-100 shadow-xl bg-white/80 backdrop-blur-sm flex flex-col overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between gap-6 px-6 py-5 border-b border-blue-100 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">📚 BookmarkHub</h1>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                {bookmarks.length} saved
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm font-medium">
                Hello, {user.name || user.email}
              </div>
              <a
                href="/account/logout"
                className="text-sm text-blue-100 hover:text-white transition-colors"
              >
                Sign Out
              </a>
            </div>
          </header>

          {/* Search and Filters */}
          <div className="px-6 py-6 border-b border-blue-100 space-y-4 bg-gradient-to-r from-blue-50 to-purple-50">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition-all shadow-sm"
              />
            </div>

            {/* Selected Tags Display */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-600">
                  Active filters:
                </span>
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium cursor-pointer hover:from-blue-600 hover:to-purple-600 transition-all"
                    onClick={() => handleTagSelect(tag)}
                  >
                    {tag}
                    <X className="w-3 h-3" />
                  </span>
                ))}
              </div>
            )}

            {/* Filters and Controls */}
            <div className="flex flex-wrap items-center gap-4">
              <select
                value={filterRead}
                onChange={(e) => setFilterRead(e.target.value)}
                className="px-4 py-2 border-2 border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 outline-none bg-white/80 backdrop-blur-sm hover:border-blue-300 transition-all"
              >
                <option value="all">📋 All Items</option>
                <option value="unread">👁️ Unread</option>
                <option value="read">✅ Read</option>
              </select>

              {/* All Tags Display */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium text-gray-600">Tags:</span>
                {allTags.slice(0, 8).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagSelect(tag)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-all hover:scale-105 ${
                      selectedTags.includes(tag)
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md"
                        : "bg-white/80 text-gray-700 border border-blue-200 hover:border-blue-300"
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </button>
                ))}
                {allTags.length > 8 && (
                  <span className="text-xs text-gray-500">
                    +{allTags.length - 8} more
                  </span>
                )}
              </div>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                Add Bookmark
              </button>
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="px-6 py-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-100">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      URL or Upload Image
                    </label>
                    <input
                      type="text"
                      placeholder="Paste a link here..."
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      disabled={!!selectedFile}
                      className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-300 outline-none disabled:bg-gray-100 transition-all"
                    />

                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-sm text-gray-500">or</span>
                      <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                        <Upload className="w-4 h-4" />
                        Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            setSelectedFile(e.target.files[0]);
                            setNewLink("");
                          }}
                          className="hidden"
                        />
                      </label>
                      {selectedFile && (
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {selectedFile && (
                      <div className="mt-2 text-sm text-blue-600 font-medium">
                        Selected: {selectedFile.name}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="AI, Tech, Article..."
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-300 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={
                      (!newLink && !selectedFile) ||
                      createBookmark.isPending ||
                      isLoadingMetadata ||
                      uploadLoading
                    }
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
                  >
                    {createBookmark.isPending ||
                    isLoadingMetadata ||
                    uploadLoading
                      ? "Adding..."
                      : "Add Bookmark"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewLink("");
                      setNewTags("");
                      setSelectedFile(null);
                    }}
                    className="text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Bookmarks Grid */}
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading bookmarks...</p>
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No bookmarks found</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Add your first bookmark
                </button>
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="border-2 border-blue-100 rounded-2xl overflow-hidden hover:shadow-xl transition-all bg-white/90 backdrop-blur-sm hover:border-blue-200 transform hover:scale-105"
                  >
                    {bookmark.thumbnail_url && (
                      <img
                        src={bookmark.thumbnail_url}
                        alt={bookmark.title}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
                          {bookmark.title || bookmark.url}
                        </h3>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditTags(bookmark)}
                            className="text-blue-400 hover:text-blue-600 flex-shrink-0 p-1 rounded-lg hover:bg-blue-50 transition-all"
                            title="Edit tags"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              toggleReadStatus.mutate({
                                id: bookmark.id,
                                is_read: bookmark.is_read,
                              })
                            }
                            className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1 rounded-lg hover:bg-gray-50 transition-all"
                            title={
                              bookmark.is_read
                                ? "Mark as unread"
                                : "Mark as read"
                            }
                          >
                            {bookmark.is_read ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteId(bookmark)}
                            className="text-blue-400 hover:text-blue-600 flex-shrink-0 p-1 rounded-lg hover:bg-blue-50 transition-all"
                            title="Delete bookmark"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {bookmark.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {bookmark.description}
                        </p>
                      )}

                      {bookmark.summary && (
                        <p className="text-sm text-blue-600 mb-3 italic line-clamp-2 bg-blue-50 p-2 rounded-lg">
                          {bookmark.summary}
                        </p>
                      )}

                      {/* Tag Editing */}
                      {editingBookmark === bookmark.id ? (
                        <div className="mb-3">
                          <input
                            type="text"
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 outline-none mb-2"
                            placeholder="Enter tags separated by commas"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEditTags}
                              className="inline-flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-green-600 transition-all"
                            >
                              <Check className="w-3 h-3" />
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingBookmark(null);
                                setEditTags("");
                              }}
                              className="inline-flex items-center gap-1 bg-gray-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-gray-600 transition-all"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Tags Display */
                        <div className="flex flex-wrap gap-1 mb-3">
                          {[
                            ...(bookmark.tags || []),
                            ...(bookmark.auto_tags || []),
                          ].map((tag, index) => (
                            <span
                              key={index}
                              onClick={() => handleTagSelect(tag)}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all hover:scale-105 ${
                                bookmark.auto_tags?.includes(tag)
                                  ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-sm"
                                  : selectedTags.includes(tag)
                                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(bookmark.created_at).toLocaleDateString()}
                        </div>
                        <a
                          href={bookmark.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}