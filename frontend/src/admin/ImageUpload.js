import React, { useRef, useState } from "react";
import { UploadCloud, X, Loader2 } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const abs = (u) => (u && u.startsWith("/") ? `${BACKEND}${u}` : u);

async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await adminApi.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return abs(data.url);
}

export function ImageUpload({ value, onChange, testid = "image" }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try { onChange(await uploadFile(f)); toast.success("Image uploaded"); }
    catch (err) { toast.error(apiError(err, "Upload failed")); }
    setBusy(false);
    e.target.value = "";
  };
  return (
    <div className="flex items-center gap-3">
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} data-testid={`upload-${testid}`} />
      {value ? (
        <div className="relative w-20 h-20 rounded-md overflow-hidden border border-gray-200 group">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange("")} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"><X size={12} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="w-20 h-20 rounded-md border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-plum hover:text-plum text-[10px] gap-1" data-testid={`upload-btn-${testid}`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <><UploadCloud size={18} /> Upload</>}
        </button>
      )}
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="text-xs text-plum underline">{value ? "Replace" : "Choose image"}</button>
    </div>
  );
}

export function MultiImageUpload({ value = [], onChange, testid = "images" }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    try {
      const urls = [];
      for (const f of files) urls.push(await uploadFile(f));
      onChange([...(value || []), ...urls]);
      toast.success(`${urls.length} image(s) uploaded`);
    } catch (err) { toast.error(apiError(err, "Upload failed")); }
    setBusy(false);
    e.target.value = "";
  };
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={pick} data-testid={`upload-${testid}`} />
      <div className="flex flex-wrap gap-3">
        {(value || []).map((u, i) => (
          <div key={i} className="relative w-20 h-24 rounded-md overflow-hidden border border-gray-200">
            <img src={u} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => remove(i)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"><X size={12} /></button>
          </div>
        ))}
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="w-20 h-24 rounded-md border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-plum hover:text-plum text-[10px] gap-1" data-testid={`upload-btn-${testid}`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <><UploadCloud size={18} /> Add</>}
        </button>
      </div>
    </div>
  );
}
