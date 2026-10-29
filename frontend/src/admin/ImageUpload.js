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
      <p className="text-xs text-gray-500 mb-2">Drag thumbnails to change display order. The first image is the primary image.</p>
      <div className="flex flex-wrap gap-3">
        {(value || []).map((u, i) => (
          <div key={`${u}-${i}`} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={(e) => { e.preventDefault(); const from = Number(e.dataTransfer.getData("text/plain")); if (!Number.isInteger(from) || from < 0 || from >= value.length || from === i) return; const next = [...value]; const [item] = next.splice(from, 1); next.splice(i, 0, item); onChange(next); }} className="relative w-20 h-24 rounded-md overflow-hidden border border-gray-200 cursor-grab active:cursor-grabbing" title="Drag to reorder">
            <img src={u} alt={`Product image ${i + 1}`} className="w-full h-full object-cover" />
            {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-plum text-white text-[9px] text-center py-1">Primary</span>}
            <span className="absolute top-0.5 left-0.5 bg-black/60 text-white rounded px-1 text-[9px]">{i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5" aria-label={`Remove image ${i + 1}`}><X size={12} /></button>
          </div>
        ))}
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="w-20 h-24 rounded-md border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-plum hover:text-plum text-[10px] gap-1" data-testid={`upload-btn-${testid}`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <><UploadCloud size={18} /> Add</>}
        </button>
      </div>
    </div>
  );
}


export function VideoUpload({ value, onChange, testid = "video" }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    if (!f.type.startsWith("video/")) { setError("Please choose a video file."); e.target.value = ""; return; }
    if (f.size > 50 * 1024 * 1024) { setError("Video must be 100MB or smaller."); e.target.value = ""; return; }
    const fd = new FormData();
    fd.append("file", f);
    setBusy(true);
    try {
      const { data } = await adminApi.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url);
      toast.success("Video uploaded");
    } catch (err) { setError(apiError(err, "Video upload failed")); }
    setBusy(false);
    e.target.value = "";
  };
  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg" hidden onChange={pick} data-testid={`upload-${testid}`} />
      {value ? (
        <div className="space-y-2">
          <video src={value} controls className="w-full max-w-md max-h-56 rounded-md border border-gray-200 bg-black" />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="text-xs text-plum underline">Replace video</button>
            <button type="button" onClick={() => onChange("")} className="text-xs text-red-600 underline">Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="w-full max-w-md rounded-md border-2 border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500 hover:border-plum hover:text-plum text-center" data-testid={`upload-btn-${testid}`}>
          {busy ? "Uploading video…" : "Upload product video"}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">Optional · MP4/WebM/MOV · max 50MB</p>
    </div>
  );
}
