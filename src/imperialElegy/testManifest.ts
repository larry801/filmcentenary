import fs from "fs";
import path from "path";
export const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, "../../public/imperial-elegy/manifest.json"), "utf8"));
