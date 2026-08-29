import "tldraw/tldraw.css";
import { Tldraw } from "tldraw";
import { seedAllPages } from "./diagrams/pages";

export default function App() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw persistenceKey="system-design-diagrams" onMount={seedAllPages} />
    </div>
  );
}
