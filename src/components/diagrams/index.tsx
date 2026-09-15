import { NotImplemented } from "@/components/ui";
import { SliceAliasingDiagram } from "./slice-aliasing";

const DIAGRAMS: Record<string, () => React.ReactNode> = {
  "slice-aliasing": SliceAliasingDiagram,
};

export function Diagram({ name }: { name: string }) {
  const D = DIAGRAMS[name];
  return D ? <D /> : <NotImplemented what={`diagram "${name}"`} />;
}
