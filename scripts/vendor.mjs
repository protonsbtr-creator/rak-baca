// Copies the browser builds of the libraries into web/vendor, so the app works offline and inside the APK.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "web", "vendor");
mkdirSync(out, { recursive: true });

const files = [
  ["node_modules/pdfjs-dist/build/pdf.min.js", "pdf.min.js"],
  ["node_modules/pdfjs-dist/build/pdf.worker.min.js", "pdf.worker.min.js"],
  ["node_modules/jszip/dist/jszip.min.js", "jszip.min.js"],
  ["node_modules/@supabase/supabase-js/dist/umd/supabase.js", "supabase.js"],
];
for (const [from, to] of files) {
  copyFileSync(join(root, from), join(out, to));
  console.log("vendor:", to);
}
