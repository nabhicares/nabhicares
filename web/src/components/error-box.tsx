"use client";

import { AlertCircle } from "lucide-react";

export default function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <AlertCircle size={40} className="text-[#DC2626]" />
      <p className="text-[#DC2626] font-medium">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="text-sm text-[#0C6EFD] hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
