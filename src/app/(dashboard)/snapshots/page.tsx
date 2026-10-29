"use client";

import { useState, useEffect } from "react";
import { PropertySelector } from "@/components/ui/PropertySelector";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { snapshotsMessages } from "@/i18n/messages/snapshots";

interface Snapshot {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
  property: {
    siteUrl: string;
  };
}

export default function SnapshotsPage() {
  const t = useMessages(snapshotsMessages);
  const { intlLocale } = useLocale();
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [period, setPeriod] = useState("28d");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState("");
  const [newSnapshotDescription, setNewSnapshotDescription] = useState("");
  const [newSnapshotUrlPath, setNewSnapshotUrlPath] = useState("");
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [originalName, setOriginalName] = useState("");

  useEffect(() => {
    fetchSnapshots();
  }, []);

  async function fetchSnapshots() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/snapshots");
      const data = await response.json();
      setSnapshots(data.snapshots || []);
    } catch (error) {
      console.error("Error fetching snapshots:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function createSnapshot() {
    if (!selectedProperty || !newSnapshotName) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSnapshotName,
          description: newSnapshotDescription,
          siteUrl: selectedProperty,
          period,
          urlPathFilter: newSnapshotUrlPath.trim() || undefined,
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewSnapshotName("");
        setNewSnapshotDescription("");
        setNewSnapshotUrlPath("");
        fetchSnapshots();
      }
    } catch (error) {
      console.error("Error creating snapshot:", error);
    } finally {
      setIsCreating(false);
    }
  }

  async function deleteSnapshot(id: string) {
    if (!confirm(t.confirmDelete)) return;

    try {
      await fetch(`/api/snapshots/${id}`, { method: "DELETE" });
      fetchSnapshots();
    } catch (error) {
      console.error("Error deleting snapshot:", error);
    }
  }

  function startEditing(snapshot: Snapshot) {
    setEditingSnapshotId(snapshot.id);
    setEditingName(snapshot.name);
    setOriginalName(snapshot.name);
  }

  function cancelEditing() {
    setEditingSnapshotId(null);
    setEditingName("");
    setOriginalName("");
  }

  function handleBlur(id: string) {
    // Nur speichern wenn sich der Name geändert hat
    if (editingName.trim() !== originalName.trim() && editingName.trim()) {
      saveSnapshotName(id);
    } else {
      cancelEditing();
    }
  }


  async function saveSnapshotName(id: string) {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      cancelEditing();
      return;
    }

    try {
      const response = await fetch(`/api/snapshots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (response.ok) {
        setEditingSnapshotId(null);
        setEditingName("");
        setOriginalName("");
        fetchSnapshots();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Error updating snapshot name:", errorData.error || `HTTP ${response.status}`);
        alert(t.saveError(errorData.error || t.unknownError));
      }
    } catch (error) {
      console.error("Error updating snapshot name:", error);
      alert(t.saveErrorRetry);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === "Enter") {
      saveSnapshotName(id);
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t.newSnapshot}
        </button>
      </div>

      {/* Snapshot Liste */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">{t.empty.title}</h3>
            <p className="text-slate-400 mb-4">{t.empty.description}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="p-6 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {editingSnapshotId === snapshot.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleBlur(snapshot.id)}
                          onKeyDown={(e) => handleKeyDown(e, snapshot.id)}
                          autoFocus
                          className="text-lg font-medium bg-slate-700 border border-blue-500 rounded px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <h3
                          className="text-lg font-medium text-white cursor-pointer hover:text-blue-400 transition-colors"
                          onClick={() => startEditing(snapshot)}
                          title={t.clickToEdit}
                        >
                          {snapshot.name}
                        </h3>
                      )}
                      <span className="px-2 py-0.5 text-xs bg-slate-600 text-slate-300 rounded">
                        {formatDate(snapshot.startDate)} - {formatDate(snapshot.endDate)}
                      </span>
                    </div>
                    {snapshot.description && (
                      <p className="text-slate-400 text-sm mb-3">{snapshot.description}</p>
                    )}
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div>
                        <span className="text-slate-400">{t.metrics.clicks}</span>{" "}
                        <span className="text-white font-medium">
                          {snapshot.totals.clicks.toLocaleString(intlLocale)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">{t.metrics.impressions}</span>{" "}
                        <span className="text-white font-medium">
                          {snapshot.totals.impressions.toLocaleString(intlLocale)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">{t.metrics.ctr}</span>{" "}
                        <span className="text-white font-medium">
                          {(snapshot.totals.ctr * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">{t.metrics.position}</span>{" "}
                        <span className="text-white font-medium">
                          {snapshot.totals.position.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      {t.createdOnBy(formatDate(snapshot.createdAt), snapshot.user.name || snapshot.user.email)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingSnapshotId !== snapshot.id && (
                      <>
                        <a
                          href={`/snapshots/${snapshot.id}`}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                          title={t.showDetails}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </a>
                        <button
                          onClick={() => deleteSnapshot(snapshot.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded-lg transition-colors"
                          title={t.delete}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                    {editingSnapshotId === snapshot.id && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveSnapshotName(snapshot.id)}
                          className="p-2 text-green-400 hover:text-green-300 hover:bg-slate-600 rounded-lg transition-colors"
                          title={t.save}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                          title={t.cancel}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">{t.modal.title}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.modal.name}</label>
                <input
                  type="text"
                  value={newSnapshotName}
                  onChange={(e) => setNewSnapshotName(e.target.value)}
                  placeholder={t.modal.namePlaceholder}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.modal.description}</label>
                <textarea
                  value={newSnapshotDescription}
                  onChange={(e) => setNewSnapshotDescription(e.target.value)}
                  placeholder={t.modal.descriptionPlaceholder}
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.modal.property}</label>
                <PropertySelector value={selectedProperty} onChange={setSelectedProperty} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.modal.period}</label>
                <PeriodSelector value={period} onChange={setPeriod} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t.modal.urlPath}
                </label>
                <input
                  type="text"
                  value={newSnapshotUrlPath}
                  onChange={(e) => setNewSnapshotUrlPath(e.target.value)}
                  placeholder={t.modal.urlPathPlaceholder}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  {t.modal.urlPathHint}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={createSnapshot}
                disabled={isCreating || !selectedProperty || !newSnapshotName}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    {t.modal.creating}
                  </>
                ) : (
                  t.modal.create
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


