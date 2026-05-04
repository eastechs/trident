import { useDocumentTitle } from "@/hooks/use-document-title";

export default function Main() {
  useDocumentTitle("Menubar");
  return (
    <div className="flex h-screen flex-col">
      <h1>Menubar</h1>
    </div>
  );
}
