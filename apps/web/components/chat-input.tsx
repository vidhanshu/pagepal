"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";

type Props = {
  disabled?: boolean;
  placeholder?: string;
  onSend: (message: string) => void;
};

export function ChatInput({ disabled, placeholder, onSend }: Props) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#212121] px-4 py-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-3xl items-end gap-3 rounded-2xl border border-white/10 bg-[#2f2f2f] px-4 py-3 shadow-lg"
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={placeholder}
          className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          ↑
        </button>
      </form>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-zinc-600">
        PagePal answers from your uploaded PDF only. Processing may take a
        moment after upload.
      </p>
    </div>
  );
}
