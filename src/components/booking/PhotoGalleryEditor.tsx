"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_PHOTOS, PHOTO_BUCKET } from "@/lib/booking-profile";
import { toast } from "@/stores/toastStore";

/**
 * Upload / remove work photos shown on the public booking page. Images are
 * shrunk in the browser (max 1600px, JPEG) before upload so they load fast
 * on mobile data, then stored in the public `business-photos` bucket under
 * the owner's own folder.
 */
export function PhotoGalleryEditor({
  userId, photos, onChange,
}: { userId: string; photos: string[]; onChange: (photos: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (picked.length < files.length) toast(`You can show up to ${MAX_PHOTOS} photos.`, "danger");
    if (!picked.length) return;

    const supabase = createClient();
    setUploading(picked.length);
    const added: string[] = [];
    for (const file of picked) {
      try {
        const blob = await shrink(file, 1600);
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
        });
        if (error) throw error;
        added.push(supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast(
          msg.toLowerCase().includes("bucket")
            ? "Photo storage isn't set up yet - run migration 017 in Supabase."
            : `Couldn't upload ${file.name}: ${msg}`,
          "danger",
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length) onChange([...photos, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(url: string) {
    onChange(photos.filter((p) => p !== url));
    const marker = `/${PHOTO_BUCKET}/`;
    const path = url.includes(marker) ? decodeURIComponent(url.split(marker)[1]) : null;
    if (path) await createClient().storage.from(PHOTO_BUCKET).remove([path]);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="block text-small font-semibold">Photos of your work</label>
        <span className="text-tiny text-[var(--color-muted)]">{photos.length}/{MAX_PHOTOS}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
        {photos.map((url) => (
          <div key={url} className="relative aspect-square rounded-[var(--radius-lg)] overflow-hidden bg-[var(--color-canvas)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            <button
              type="button"
              onClick={() => remove(url)}
              aria-label="Remove photo"
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className="aspect-square rounded-[var(--radius-lg)] skeleton flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-muted)]" />
          </div>
        ))}
        {photos.length + uploading < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)]/50 text-[var(--color-muted)] hover:text-[var(--color-primary)] flex flex-col items-center justify-center gap-1 transition-colors"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-tiny font-semibold">Add</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-tiny text-[var(--color-muted)]">
        Show your best work - clients book more when they can see it.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

async function shrink(file: File, maxDim: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.85),
  );
}
