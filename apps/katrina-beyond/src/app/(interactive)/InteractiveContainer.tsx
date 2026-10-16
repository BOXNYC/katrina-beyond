import type { InteractiveKey } from "@/lib/interactives";
import { interactives } from "@/lib/interactives";
export default function InteractiveContainer({ name }: { name: InteractiveKey }) {
  const { title } = interactives[name].info;
  
  return (
    <div className="flex flex-1 items-center justify-center p-8 bg-linear bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
      <h1 className="text-3xl font-semibold">{title}</h1>
    </div>
  );
}
