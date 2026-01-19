"use client";

import { useState, useEffect } from "react";

interface TicketComment {
  id: string;
  text: string;
  userId: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  type: "bug" | "feature";
  status: "open" | "in_progress" | "closed";
  priority: "low" | "medium" | "high";
  user: {
    name: string | null;
    email: string;
  };
  comments: TicketComment[];
  createdAt: string;
  updatedAt: string;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<"bug" | "feature">("feature");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Comment state
  const [newComment, setNewComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/tickets");
      const data = await response.json();
      setTickets(data.tickets || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createTicket = async () => {
    if (!newTitle.trim() || !newDescription.trim()) return;

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          type: newType,
          priority: newPriority,
        }),
      });

      const data = await response.json();
      if (data.ticket) {
        setTickets([data.ticket, ...tickets]);
        setShowNewForm(false);
        setNewTitle("");
        setNewDescription("");
        setNewType("feature");
        setNewPriority("medium");
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert("Fehler beim Erstellen des Tickets");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();
      if (data.ticket) {
        setTickets(tickets.map((t) => (t.id === ticketId ? data.ticket : t)));
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(data.ticket);
        }
      }
    } catch (error) {
      console.error("Error updating ticket:", error);
    }
  };

  const addComment = async (ticketId: string) => {
    if (!newComment.trim()) return;

    try {
      setIsAddingComment(true);
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment.trim() }),
      });

      if (response.ok) {
        // Ticket neu laden
        const ticketResponse = await fetch(`/api/tickets/${ticketId}`);
        const data = await ticketResponse.json();
        if (data.ticket) {
          setTickets(tickets.map((t) => (t.id === ticketId ? data.ticket : t)));
          setSelectedTicket(data.ticket);
        }
        setNewComment("");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsAddingComment(false);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!confirm("Ticket wirklich löschen?")) return;

    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTickets(tickets.filter((t) => t.id !== ticketId));
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(null);
        }
      }
    } catch (error) {
      console.error("Error deleting ticket:", error);
    }
  };

  const getTypeLabel = (type: string) => {
    return type === "bug" ? "🐛 Bug" : "✨ Feature";
  };

  const getTypeColor = (type: string) => {
    return type === "bug"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-purple-500/20 text-purple-400 border-purple-500/30";
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Offen";
      case "in_progress":
        return "In Bearbeitung";
      case "closed":
        return "Geschlossen";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "in_progress":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "closed":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Hoch";
      case "medium":
        return "Mittel";
      case "low":
        return "Niedrig";
      default:
        return priority;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-400";
      case "medium":
        return "text-yellow-400";
      case "low":
        return "text-slate-400";
      default:
        return "text-slate-400";
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (filterType !== "all" && ticket.type !== filterType) return false;
    if (filterStatus !== "all" && ticket.status !== filterStatus) return false;
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tickets</h1>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tickets</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Bugs melden und Feature-Wünsche einreichen
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Ticket
        </button>
      </div>

      {/* Neues Ticket Form */}
      {showNewForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Neues Ticket erstellen
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Typ *
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as "bug" | "feature")}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="feature">✨ Feature-Wunsch</option>
                  <option value="bug">🐛 Bug-Report</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Priorität
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as "low" | "medium" | "high")}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Titel *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Kurze Beschreibung des Problems oder Wunsches"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Beschreibung *
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Detaillierte Beschreibung..."
                rows={4}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createTicket}
                disabled={isSubmitting || !newTitle.trim() || !newDescription.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSubmitting ? "Erstelle..." : "Ticket erstellen"}
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  setNewTitle("");
                  setNewDescription("");
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Typ
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            <option value="bug">🐛 Bugs</option>
            <option value="feature">✨ Features</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            <option value="open">Offen</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="closed">Geschlossen</option>
          </select>
        </div>
      </div>

      {/* Tickets Liste und Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets Liste */}
        <div className="space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                {tickets.length === 0
                  ? "Noch keine Tickets vorhanden"
                  : "Keine Tickets mit diesen Filtern"}
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`bg-white dark:bg-slate-800 rounded-xl p-4 border cursor-pointer transition-all ${
                  selectedTicket?.id === ticket.id
                    ? "border-blue-500 ring-2 ring-blue-500/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${getTypeColor(
                          ticket.type
                        )}`}
                      >
                        {getTypeLabel(ticket.type)}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(
                          ticket.status
                        )}`}
                      >
                        {getStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <h3 className="font-medium text-slate-900 dark:text-white truncate">
                      {ticket.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-500">
                      <span>{ticket.user.name || ticket.user.email}</span>
                      <span>•</span>
                      <span>{formatDate(ticket.createdAt)}</span>
                      {ticket.comments && ticket.comments.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{ticket.comments.length} Kommentare</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                    {getPriorityLabel(ticket.priority)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ticket Detail */}
        {selectedTicket && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full border ${getTypeColor(
                        selectedTicket.type
                      )}`}
                    >
                      {getTypeLabel(selectedTicket.type)}
                    </span>
                    <span className={`text-sm ${getPriorityColor(selectedTicket.priority)}`}>
                      Priorität: {getPriorityLabel(selectedTicket.priority)}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {selectedTicket.title}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Erstellt von {selectedTicket.user.name || selectedTicket.user.email} am{" "}
                    {formatDate(selectedTicket.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => deleteTicket(selectedTicket.id)}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Ticket löschen"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>

              {/* Status ändern */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Status ändern
                </label>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => updateTicketStatus(selectedTicket.id, e.target.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${getStatusColor(
                    selectedTicket.status
                  )} bg-transparent`}
                >
                  <option value="open">Offen</option>
                  <option value="in_progress">In Bearbeitung</option>
                  <option value="closed">Geschlossen</option>
                </select>
              </div>
            </div>

            {/* Beschreibung */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Beschreibung
              </h3>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {selectedTicket.description}
              </p>
            </div>

            {/* Kommentare */}
            <div className="p-6">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                Kommentare ({selectedTicket.comments?.length || 0})
              </h3>

              {selectedTicket.comments && selectedTicket.comments.length > 0 && (
                <div className="space-y-3 mb-4">
                  {selectedTicket.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3"
                    >
                      <p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap">
                        {comment.text}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                        {formatDate(comment.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Neuer Kommentar */}
              <div className="space-y-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Kommentar hinzufügen..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                />
                <button
                  onClick={() => addComment(selectedTicket.id)}
                  disabled={isAddingComment || !newComment.trim()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                >
                  {isAddingComment ? "Sende..." : "Kommentar senden"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
