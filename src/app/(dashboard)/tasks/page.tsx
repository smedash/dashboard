"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { canEdit } from "@/lib/rbac";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TaskUser {
  id: string;
  name: string | null;
  email: string;
}

interface TaskComment {
  id: string;
  text: string;
  userId: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  order: number;
  dueDate: string | null;
  category: string | null;
  labels: string[];
  creator: TaskUser;
  assignees: TaskUser[];
  comments: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

interface Column {
  id: string;
  title: string;
  color: string;
  bgColor: string;
}

const COLUMNS: Column[] = [
  { id: "backlog", title: "Backlog", color: "text-slate-400", bgColor: "bg-slate-500/20" },
  { id: "todo", title: "To Do", color: "text-blue-400", bgColor: "bg-blue-500/20" },
  { id: "in_progress", title: "In Arbeit", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
  { id: "review", title: "Review", color: "text-purple-400", bgColor: "bg-purple-500/20" },
  { id: "done", title: "Erledigt", color: "text-green-400", bgColor: "bg-green-500/20" },
];

const PRIORITIES = [
  { id: "low", label: "Niedrig", color: "text-slate-400", bgColor: "bg-slate-500/20" },
  { id: "medium", label: "Mittel", color: "text-blue-400", bgColor: "bg-blue-500/20" },
  { id: "high", label: "Hoch", color: "text-orange-400", bgColor: "bg-orange-500/20" },
  { id: "urgent", label: "Dringend", color: "text-red-400", bgColor: "bg-red-500/20" },
];

const CATEGORIES = [
  "Mortgages",
  "Accounts&Cards", 
  "Investing",
  "Pension",
  "Digital Banking",
];

// Sortable Task Card Component
function SortableTaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm"
    >
      <TaskCardContent task={task} />
    </div>
  );
}

// Task Card Content (shared between sortable and overlay)
function TaskCardContent({ task }: { task: Task }) {
  const priority = PRIORITIES.find((p) => p.id === task.priority);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-slate-900 dark:text-white text-sm line-clamp-2">
          {task.title}
        </h4>
        {priority && (
          <span className={`px-1.5 py-0.5 text-xs rounded ${priority.bgColor} ${priority.color} shrink-0`}>
            {priority.label}
          </span>
        )}
      </div>
      
      {task.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {task.category && (
            <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
              {task.category}
            </span>
          )}
          {task.labels?.slice(0, 2).map((label) => (
            <span
              key={label}
              className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded"
            >
              {label}
            </span>
          ))}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {task.dueDate && (
            <span className={`text-xs ${isOverdue ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}>
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.comments.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {task.comments.length}
            </span>
          )}
          {/* Multiple Assignees */}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {task.assignees.slice(0, 3).map((assignee) => (
                <div
                  key={assignee.id}
                  className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium border border-white dark:border-slate-800"
                  title={assignee.name || assignee.email}
                >
                  {(assignee.name || assignee.email).charAt(0).toUpperCase()}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-5 h-5 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-medium border border-white dark:border-slate-800">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Droppable Column Component
function DroppableColumn({
  column,
  tasks,
  onTaskClick,
  onAddTask,
  canEditData,
}: {
  column: Column;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (status: string) => void;
  canEditData: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-slate-100 dark:bg-slate-900/50 rounded-xl">
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${column.bgColor}`}></span>
            <h3 className={`font-medium ${column.color}`}>{column.title}</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </div>
          {canEditData && (
            <button
              onClick={() => onAddTask(column.id)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
              title="Task hinzufügen"
            >
              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] transition-colors ${
          isOver ? "bg-blue-50 dark:bg-blue-900/20" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className={`h-20 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${
            isOver 
              ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" 
              : "border-slate-300 dark:border-slate-700"
          }`}>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {isOver ? "Hier ablegen" : "Keine Tasks"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Task Detail Modal
function TaskDetailModal({
  task,
  users,
  onClose,
  onUpdate,
  onDelete,
  canEditData,
}: {
  task: Task;
  users: TaskUser[];
  onClose: () => void;
  onUpdate: (updates: Partial<Task> & { assigneeIds?: string[] }) => void;
  onDelete: () => void;
  canEditData: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(
    task.assignees?.map((a) => a.id) || []
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate({
      ...editedTask,
      assigneeIds: selectedAssigneeIds,
    });
    setIsEditing(false);
    setIsSaving(false);
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-4">
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editedTask.title}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                className="w-full text-xl font-semibold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none text-slate-900 dark:text-white"
              />
            ) : (
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{task.title}</h2>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Erstellt von {task.creator.name || task.creator.email} am {formatDate(task.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEditData && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {canEditData && (
              <button
                onClick={onDelete}
                className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              {isEditing ? (
                <select
                  value={editedTask.status}
                  onChange={(e) => setEditedTask({ ...editedTask, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  {COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>{col.title}</option>
                  ))}
                </select>
              ) : (
                <span className={`inline-block px-2 py-1 rounded text-sm ${COLUMNS.find((c) => c.id === task.status)?.bgColor} ${COLUMNS.find((c) => c.id === task.status)?.color}`}>
                  {COLUMNS.find((c) => c.id === task.status)?.title}
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priorität</label>
              {isEditing ? (
                <select
                  value={editedTask.priority}
                  onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              ) : (
                <span className={`inline-block px-2 py-1 rounded text-sm ${PRIORITIES.find((p) => p.id === task.priority)?.bgColor} ${PRIORITIES.find((p) => p.id === task.priority)?.color}`}>
                  {PRIORITIES.find((p) => p.id === task.priority)?.label}
                </span>
              )}
            </div>
          </div>

          {/* Assignees (Multi-Select) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Zugewiesen an ({selectedAssigneeIds.length} ausgewählt)
            </label>
            {isEditing ? (
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssigneeIds.includes(user.id)}
                      onChange={() => toggleAssignee(user.id)}
                      className="rounded border-slate-300 dark:border-slate-600"
                    />
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {user.name || user.email}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {task.assignees && task.assignees.length > 0 ? (
                  task.assignees.map((assignee) => (
                    <div key={assignee.id} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-full px-2 py-1">
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                        {(assignee.name || assignee.email).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {assignee.name || assignee.email}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">Nicht zugewiesen</span>
                )}
              </div>
            )}
          </div>

          {/* Due Date & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fälligkeitsdatum</label>
              {isEditing ? (
                <input
                  type="date"
                  value={editedTask.dueDate?.split("T")[0] || ""}
                  onChange={(e) => setEditedTask({ ...editedTask, dueDate: e.target.value || null })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              ) : (
                <span className="text-slate-600 dark:text-slate-400">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString("de-DE") : "Kein Datum"}
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategorie</label>
              {isEditing ? (
                <select
                  value={editedTask.category || ""}
                  onChange={(e) => setEditedTask({ ...editedTask, category: e.target.value || null })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Keine Kategorie</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              ) : (
                <span className="text-slate-600 dark:text-slate-400">{task.category || "Keine Kategorie"}</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Beschreibung</label>
            {isEditing ? (
              <textarea
                value={editedTask.description || ""}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value || null })}
                rows={4}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                placeholder="Beschreibung hinzufügen..."
              />
            ) : (
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {task.description || "Keine Beschreibung"}
              </p>
            )}
          </div>

          {/* Comments */}
          {task.comments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Kommentare ({task.comments.length})
              </label>
              <div className="space-y-2">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{comment.text}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {formatDate(comment.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isEditing && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
            <button
              onClick={() => {
                setEditedTask(task);
                setSelectedAssigneeIds(task.assignees?.map((a) => a.id) || []);
                setIsEditing(false);
              }}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition-colors"
            >
              {isSaving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// New Task Modal
function NewTaskModal({
  status,
  users,
  onClose,
  onCreate,
}: {
  status: string;
  users: TaskUser[];
  onClose: () => void;
  onCreate: (task: { title: string; description: string | null; status: string; priority: string; category: string | null; dueDate: string | null; assigneeIds: string[] }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const toggleAssignee = (userId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    
    setIsCreating(true);
    await onCreate({
      title,
      description: description || null,
      status,
      priority,
      category: category || null,
      dueDate: dueDate || null,
      assigneeIds,
    });
    setIsCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Neuen Task erstellen
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            In Spalte: {COLUMNS.find((c) => c.id === status)?.title}
          </p>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Titel *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task-Titel eingeben..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Beschreibung
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung hinzufügen..."
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Priorität
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Kategorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="">Keine Kategorie</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Multi-Select Assignees */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Zuweisen an ({assigneeIds.length} ausgewählt)
            </label>
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(user.id)}
                    onChange={() => toggleAssignee(user.id)}
                    className="rounded border-slate-300 dark:border-slate-600"
                  />
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {user.name || user.email}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Fälligkeitsdatum
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition-colors"
          >
            {isCreating ? "Erstelle..." : "Task erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function TasksPage() {
  const { data: session } = useSession();
  const canEditData = canEdit(session?.user?.role);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Filter states
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch("/api/tasks");
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, [fetchTasks, fetchUsers]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;

    if (!over) return;

    const activeTaskId = active.id as string;
    const activeTask = tasks.find((t) => t.id === activeTaskId);
    if (!activeTask) return;

    // Determine target status - could be dropping on a column or on another task
    let targetStatus: string;
    let targetOrder: number;

    const overTask = tasks.find((t) => t.id === over.id);
    
    if (overTask) {
      // Dropped on another task
      targetStatus = overTask.status;
      const columnTasks = tasks.filter((t) => t.status === targetStatus);
      targetOrder = columnTasks.findIndex((t) => t.id === over.id);
    } else {
      // Dropped on a column
      targetStatus = over.id as string;
      const columnTasks = tasks.filter((t) => t.status === targetStatus);
      targetOrder = columnTasks.length; // Add at the end
    }

    // Optimistically update the UI
    setTasks((prevTasks) => {
      const updatedTasks = prevTasks.map((t) => {
        if (t.id === activeTaskId) {
          return { ...t, status: targetStatus };
        }
        return t;
      });
      
      // Reorder within the column
      const columnTasks = updatedTasks.filter((t) => t.status === targetStatus);
      const otherTasks = updatedTasks.filter((t) => t.status !== targetStatus);
      
      const movedTask = columnTasks.find((t) => t.id === activeTaskId);
      const remainingColumnTasks = columnTasks.filter((t) => t.id !== activeTaskId);
      
      if (movedTask) {
        remainingColumnTasks.splice(targetOrder, 0, movedTask);
      }
      
      // Update order numbers
      const reorderedColumnTasks = remainingColumnTasks.map((t, idx) => ({
        ...t,
        order: idx,
      }));
      
      return [...otherTasks, ...reorderedColumnTasks];
    });

    // Send update to server
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: activeTaskId,
          newStatus: targetStatus,
          newOrder: targetOrder,
        }),
      });
    } catch (error) {
      console.error("Error reordering task:", error);
      // Reload on error to sync with server
      fetchTasks();
    }
  };

  const handleCreateTask = async (taskData: { title: string; description: string | null; status: string; priority: string; category: string | null; dueDate: string | null; assigneeIds: string[] }) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleUpdateTask = async (updates: Partial<Task> & { assigneeIds?: string[] }) => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setTasks((prev) => prev.map((t) => (t.id === data.task.id ? data.task : t)));
        setSelectedTask(data.task);
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    if (!confirm("Task wirklich löschen?")) return;

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
        setSelectedTask(null);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterPriority !== "all" && task.priority !== filterPriority) return false;
    if (filterCategory !== "all" && task.category !== filterCategory) return false;
    if (filterAssignee !== "all") {
      if (filterAssignee === "unassigned" && task.assignees?.length > 0) return false;
      if (filterAssignee !== "unassigned" && !task.assignees?.some((a) => a.id === filterAssignee)) return false;
    }
    return true;
  });

  // Group tasks by column
  const tasksByColumn = COLUMNS.reduce((acc, column) => {
    acc[column.id] = filteredTasks
      .filter((task) => task.status === column.id)
      .sort((a, b) => a.order - b.order);
    return acc;
  }, {} as Record<string, Task[]>);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tasks</h1>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tasks</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Kanban Board für Aufgabenverwaltung
          </p>
        </div>
        {canEditData && (
          <button
            onClick={() => setNewTaskStatus("backlog")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neuer Task
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Priorität</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Kategorie</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Zugewiesen</label>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            <option value="unassigned">Nicht zugewiesen</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name || user.email}</option>
            ))}
          </select>
        </div>
        <div className="flex-1"></div>
        <div className="self-end">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {filteredTasks.length} von {tasks.length} Tasks
          </span>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
          {COLUMNS.map((column) => (
            <DroppableColumn
              key={column.id}
              column={column}
              tasks={tasksByColumn[column.id]}
              onTaskClick={setSelectedTask}
              onAddTask={setNewTaskStatus}
              canEditData={canEditData}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-blue-500 shadow-lg w-72 opacity-90">
              <TaskCardContent task={activeTask} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          canEditData={canEditData}
        />
      )}

      {/* New Task Modal */}
      {newTaskStatus && (
        <NewTaskModal
          status={newTaskStatus}
          users={users}
          onClose={() => setNewTaskStatus(null)}
          onCreate={handleCreateTask}
        />
      )}
    </div>
  );
}
