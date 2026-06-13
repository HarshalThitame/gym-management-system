"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type MentionUser = { id: string; name: string };

export function SupportMentionInput({
  placeholder,
  rows,
  onSubmit,
  users,
}: {
  placeholder?: string;
  rows?: number;
  onSubmit?: (text: string, mentions: string[]) => void;
  users: MentionUser[];
}) {
  const [text, setText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const pos = e.target.selectionStart ?? 0;
    setCursorPos(pos);

    const beforeCursor = val.slice(0, pos);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionSearch(atMatch[1] ?? "");
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  }, []);

  const insertMention = useCallback((user: MentionUser) => {
    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    const atIndex = before.lastIndexOf("@");
    const newText = before.slice(0, atIndex) + `@${user.name} ` + after;
    setText(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  }, [text, cursorPos]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && onSubmit && text.trim()) {
      e.preventDefault();
      const mentions = users
        .filter((u) => text.includes(`@${u.name}`))
        .map((u) => u.id);
      onSubmit(text, mentions);
      setText("");
    }
  }, [text, users, onSubmit]);

  useEffect(() => {
    const handleClickOutside = () => setShowMentions(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows ?? 3}
        placeholder={placeholder ?? "Type a message... Use @ to mention someone"}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-60 rounded-md border border-border bg-card shadow-lg overflow-hidden z-20">
          <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/50">Mentions</p>
          {filteredUsers.slice(0, 5).map((user) => (
            <button
              key={user.id}
              onClick={(e) => { e.stopPropagation(); insertMention(user); }}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              {user.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
