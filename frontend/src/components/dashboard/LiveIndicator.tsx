import { Dot } from "lucide-react";

export function LiveIndicator() {
  return (
    <span className="flex items-center gap-1 text-green-600 font-medium animate-pulse select-none">
      <Dot className="w-4 h-4 fill-green-500 stroke-none" />
      Live
    </span>
  );
}