"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  function handleClick() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/troupeau");
    }
  }

  return (
    <button
      onClick={handleClick}
      className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50"
    >
      <ArrowLeft size={18} />
    </button>
  );
}
