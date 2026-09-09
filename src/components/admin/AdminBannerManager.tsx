"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { createClient } from "@/lib/supabase/client";

// =================================================
// Types
// =================================================

interface BannerRow {
  id: string;
  image_url: string;
  is_active: boolean;
  order_index: number;
  created_at?: string;
  updated_at?: string;
}

// =================================================
// Image helpers (เหมือนหน้าโปรโมชั่น/อีเวนต์)
// =================================================

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  maxDimension = 1920,
  quality = 0.82
): Promise<string> {
  const image = await createImage(imageSrc);

  let outWidth = pixelCrop.width;
  let outHeight = pixelCrop.height;
  if (outWidth > maxDimension || outHeight > maxDimension) {
    const scale = maxDimension / Math.max(outWidth, outHeight);
    outWidth = Math.round(outWidth * scale);
    outHeight = Math.round(outHeight * scale);
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  canvas.width = outWidth;
  canvas.height = outHeight;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outWidth,
    outHeight
  );

  return canvas.toDataURL("image/jpeg", quality);
}

async function compressImageFile(file: File, maxDimension = 1920, quality = 0.85): Promise<string> {
  const rawDataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const image = await createImage(rawDataUrl);

  let width = image.width;
  let height = image.height;
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return rawDataUrl;

  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

// =================================================
// Main component
// =================================================

export default function AdminBannerManager() {
  const supabase = useMemo(() => createClient(), []);

  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>("");

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Crop workflow state — สำหรับ "เพิ่มใหม่" กับ "เปลี่ยนรูปของอันเดิม"
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editingBannerIdRef = useRef<string | null>(null); // null = กำลังเพิ่มแบนเนอร์ใหม่, มีค่า = กำลังเปลี่ยนรูปของอันนี้
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const fetchBanners = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const { data, error } = await supabase.from("banners").select("*").order("order_index", { ascending: true });

      if (error) {
        console.error("Error fetching banners:", error);
        setLoadError("ไม่สามารถโหลดข้อมูล Banner ได้ กรุณาตรวจสอบว่าได้สร้างตาราง banners ใน Supabase แล้ว");
        setBanners([]);
      } else {
        setBanners((data as BannerRow[]) || []);
      }
    } catch (err) {
      console.error(err);
      setLoadError("ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Delete / toggle / reorder ----------

  const handleDelete = (banner: BannerRow) => {
    setConfirmDialog({
      message: "ต้องการลบ Banner นี้ใช่หรือไม่? การลบไม่สามารถกู้คืนได้",
      confirmLabel: "ลบ Banner",
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await supabase.from("banners").delete().eq("id", banner.id);
        if (error) {
          console.error(error);
          alert("ลบ Banner ไม่สำเร็จ");
          return;
        }
        setBanners((prev) => prev.filter((b) => b.id !== banner.id));
      },
    });
  };

  const handleToggleActive = async (banner: BannerRow) => {
    const nextValue = !banner.is_active;
    setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, is_active: nextValue } : b)));
    const { error } = await supabase
      .from("banners")
      .update({ is_active: nextValue, updated_at: new Date().toISOString() })
      .eq("id", banner.id);
    if (error) {
      console.error(error);
      alert("อัปเดตสถานะไม่สำเร็จ");
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, is_active: !nextValue } : b)));
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const current = banners[index];
    const target = banners[targetIndex];

    const reordered = [...banners];
    reordered[index] = target;
    reordered[targetIndex] = current;
    setBanners(reordered);

    const { error: err1 } = await supabase
      .from("banners")
      .update({ order_index: target.order_index })
      .eq("id", current.id);
    const { error: err2 } = await supabase
      .from("banners")
      .update({ order_index: current.order_index })
      .eq("id", target.id);

    if (err1 || err2) {
      console.error(err1, err2);
      alert("จัดลำดับไม่สำเร็จ");
      fetchBanners();
    }
  };

  // ---------- Image crop workflow ----------

  const handleOpenAddNew = () => {
    editingBannerIdRef.current = null;
    fileInputRef.current?.click();
  };

  const handleOpenReplace = (banner: BannerRow) => {
    editingBannerIdRef.current = banner.id;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 1920, 0.85);
      setTempImageSrc(compressed);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถโหลดรูปภาพนี้ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      e.target.value = "";
    }
  };

  const onCropComplete = (_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleSaveCrop = async () => {
    if (!tempImageSrc || !croppedAreaPixels) return;
    setIsSaving(true);
    try {
      const croppedBase64 = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      const editingId = editingBannerIdRef.current;

      if (editingId) {
        // เปลี่ยนรูปของแบนเนอร์เดิม
        const { error } = await supabase
          .from("banners")
          .update({ image_url: croppedBase64, updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        // เพิ่มแบนเนอร์ใหม่ ต่อท้ายลำดับปัจจุบัน
        const nextOrderIndex = banners.length > 0 ? Math.max(...banners.map((b) => b.order_index)) + 1 : 0;
        const { error } = await supabase.from("banners").insert({
          image_url: croppedBase64,
          is_active: true,
          order_index: nextOrderIndex,
        });
        if (error) throw error;
      }

      await fetchBanners();
      setTempImageSrc(null);
    } catch (err) {
      console.error("Save banner failed:", err);
      alert("เกิดข้อผิดพลาดในการบันทึก Banner กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Render ----------

  return (
    <div className="w-full">
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />

      <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
        <p className="text-zinc-400 text-xs md:text-sm">
          จัดการรูปภาพ Carousel บนสุดของหน้าแรก — ทั้งหมด {banners.length} รูป (แนะนำอัตราส่วนแนวนอนกว้าง เช่น 21:9)
        </p>
        <button
          onClick={handleOpenAddNew}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1 whitespace-nowrap"
        >
          ➕ เพิ่ม Banner ใหม่
        </button>
      </div>

      {isLoading && <div className="text-zinc-400 text-sm">กำลังโหลดข้อมูล Banner...</div>}

      {!isLoading && loadError && (
        <div className="bg-red-950/40 border border-red-500/40 text-red-300 text-xs rounded-2xl p-4">
          {loadError}
        </div>
      )}

      {!isLoading && !loadError && banners.length === 0 && (
        <div className="w-full py-16 bg-[#111111] flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-white/[0.08] rounded-2xl gap-3">
          <p className="text-sm font-medium">🖼️ ยังไม่มี Banner กดปุ่ม &quot;เพิ่ม Banner ใหม่&quot; เพื่อเริ่มต้น</p>
        </div>
      )}

      {!isLoading && !loadError && banners.length > 0 && (
        <div className="flex flex-col gap-4">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`bg-[#111111] border rounded-2xl overflow-hidden shadow-xl flex flex-col sm:flex-row transition-all ${
                banner.is_active ? "border-white/[0.08]" : "border-white/[0.08] opacity-50"
              }`}
            >
              <div className="relative w-full sm:w-72 aspect-[21/9] sm:aspect-auto sm:h-40 bg-[#18181b] shrink-0">
                <img src={banner.image_url} alt={`Banner ${index + 1}`} className="w-full h-full object-cover" />
                <span
                  className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-lg shadow ${
                    banner.is_active ? "bg-emerald-500 text-black" : "bg-zinc-700 text-zinc-300"
                  }`}
                >
                  {banner.is_active ? "กำลังแสดง" : "ปิดการแสดง"}
                </span>
              </div>

              <div className="p-4 flex flex-col justify-between flex-1 gap-3">
                <p className="text-zinc-400 text-xs">ลำดับที่ {index + 1} จากทั้งหมด {banners.length}</p>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#18181b] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                      title="เลื่อนขึ้น"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMove(index, 1)}
                      disabled={index === banners.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#18181b] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                      title="เลื่อนลง"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleToggleActive(banner)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#18181b] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800 text-[11px] font-bold"
                    >
                      {banner.is_active ? "🙈 ซ่อน" : "👁️ แสดง"}
                    </button>
                    <button
                      onClick={() => handleOpenReplace(banner)}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/40 text-[11px] font-bold"
                    >
                      ✂️ เปลี่ยนรูป
                    </button>
                    <button
                      onClick={() => handleDelete(banner)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/40 text-[11px] font-bold"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= Crop modal ================= */}
      {tempImageSrc && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl w-full max-w-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-white/[0.08] flex justify-between items-center">
              <h3 className="font-bold text-white text-base">
                ✂️ ครอบตัดรูปภาพ {editingBannerIdRef.current ? "(เปลี่ยนรูป Banner)" : "(Banner ใหม่)"}
              </h3>
              <button onClick={() => setTempImageSrc(null)} className="text-zinc-400 hover:text-white text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="relative w-full h-80 bg-black">
              <Cropper
                image={tempImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={21 / 9}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-4 flex flex-col gap-4 bg-[#111111]">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400">ซูม:</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-yellow-400"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTempImageSrc(null)}
                  className="px-4 py-2 bg-[#18181b] hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveCrop}
                  disabled={isSaving}
                  className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-60 text-black rounded-xl text-xs font-bold shadow-lg"
                >
                  {isSaving ? "กำลังบันทึก..." : "บันทึกรูปภาพ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= Confirm dialog ================= */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
          <div
            className={`bg-[#111111] border rounded-2xl p-6 w-full max-w-sm shadow-2xl relative text-center ${
              confirmDialog.danger ? "border-red-500/60" : "border-yellow-400/60"
            }`}
          >
            <p className="text-sm text-white mb-6 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-5 py-2 rounded-xl text-sm font-bold shadow-lg text-white ${
                  confirmDialog.danger ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {confirmDialog.confirmLabel || "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}