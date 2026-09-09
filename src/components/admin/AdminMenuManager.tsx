"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { createClient } from "@/lib/supabase/client";

// =================================================
// Types
// =================================================

interface MenuCategoryRow {
  id: string;
  category_key: string;
  category_label: string;
  images: string[];
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// =================================================
// Image helpers (เหมือนหน้าโปรโมชั่น/อีเวนต์/แบนเนอร์)
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
  maxDimension = 1280,
  quality = 0.8
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

async function compressImageFile(file: File, maxDimension = 1600, quality = 0.85): Promise<string> {
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

// สร้าง category_key จากภาษาไทย/อังกฤษที่พิมพ์ ให้เป็นรหัสอ้างอิงที่ปลอดภัย
const slugifyKey = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9ก-๙-]/g, "")
    .slice(0, 40) || `cat-${Date.now()}`;

// =================================================
// Main component
// =================================================

export default function AdminMenuManager() {
  const supabase = useMemo(() => createClient(), []);

  const [categories, setCategories] = useState<MenuCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const [newCategoryLabel, setNewCategoryLabel] = useState<string>("");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState<string>("");

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Crop workflow — เพิ่มรูปเข้าไปในหมวดหมู่ที่กำลังเปิดอยู่ (expandedId)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const fetchCategories = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const { data, error } = await supabase.from("menus").select("*").order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching menus:", error);
        setLoadError("ไม่สามารถโหลดข้อมูลเมนูได้ กรุณาตรวจสอบว่าได้สร้างตาราง menus ใน Supabase แล้ว");
        setCategories([]);
      } else {
        setCategories(
          ((data as any[]) || []).map((row) => ({
            ...row,
            images: Array.isArray(row.images) ? row.images : [],
          }))
        );
      }
    } catch (err) {
      console.error(err);
      setLoadError("ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Category CRUD ----------

  const handleAddCategory = async () => {
    const label = newCategoryLabel.trim();
    if (!label) {
      alert("กรุณาตั้งชื่อหมวดหมู่ เช่น อาหาร, เครื่องดื่ม");
      return;
    }
    const key = slugifyKey(label);
    if (categories.some((c) => c.category_key === key)) {
      alert("มีหมวดหมู่ที่ใช้รหัสนี้อยู่แล้ว ลองตั้งชื่อให้ต่างออกไปอีกหน่อยครับ");
      return;
    }

    setIsBusy(true);
    try {
      const nextSortOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;
      const { error } = await supabase.from("menus").insert({
        category_key: key,
        category_label: label,
        images: [],
        sort_order: nextSortOrder,
      });
      if (error) throw error;
      setNewCategoryLabel("");
      await fetchCategories();
    } catch (err) {
      console.error(err);
      alert("เพิ่มหมวดหมู่ไม่สำเร็จ");
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartEditLabel = (cat: MenuCategoryRow) => {
    setEditingLabelId(cat.id);
    setEditingLabelValue(cat.category_label);
  };

  const handleSaveLabel = async (cat: MenuCategoryRow) => {
    const label = editingLabelValue.trim();
    if (!label) {
      setEditingLabelId(null);
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, category_label: label } : c)));
    setEditingLabelId(null);
    const { error } = await supabase
      .from("menus")
      .update({ category_label: label, updated_at: new Date().toISOString() })
      .eq("id", cat.id);
    if (error) {
      console.error(error);
      alert("บันทึกชื่อหมวดหมู่ไม่สำเร็จ");
      fetchCategories();
    }
  };

  const handleDeleteCategory = (cat: MenuCategoryRow) => {
    setConfirmDialog({
      message: `ต้องการลบหมวดหมู่ "${cat.category_label}" พร้อมรูปเมนูทั้งหมด (${cat.images.length} รูป) ใช่หรือไม่?`,
      confirmLabel: "ลบหมวดหมู่",
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await supabase.from("menus").delete().eq("id", cat.id);
        if (error) {
          console.error(error);
          alert("ลบหมวดหมู่ไม่สำเร็จ");
          return;
        }
        if (expandedId === cat.id) setExpandedId(null);
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      },
    });
  };

  const handleMoveCategory = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const current = categories[index];
    const target = categories[targetIndex];

    const reordered = [...categories];
    reordered[index] = target;
    reordered[targetIndex] = current;
    setCategories(reordered);

    const { error: err1 } = await supabase
      .from("menus")
      .update({ sort_order: target.sort_order })
      .eq("id", current.id);
    const { error: err2 } = await supabase
      .from("menus")
      .update({ sort_order: current.sort_order })
      .eq("id", target.id);

    if (err1 || err2) {
      console.error(err1, err2);
      alert("จัดลำดับไม่สำเร็จ");
      fetchCategories();
    }
  };

  // ---------- Images within a category ----------

  const persistImages = async (categoryId: string, images: string[]) => {
    const { error } = await supabase
      .from("menus")
      .update({ images, updated_at: new Date().toISOString() })
      .eq("id", categoryId);
    if (error) {
      console.error(error);
      alert("บันทึกรูปภาพไม่สำเร็จ");
      fetchCategories();
    }
  };

  const handleAddImageClick = (categoryId: string) => {
    setExpandedId(categoryId);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 1400, 0.85);
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
    if (!tempImageSrc || !croppedAreaPixels || !expandedId) return;
    setIsBusy(true);
    try {
      const croppedBase64 = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      const category = categories.find((c) => c.id === expandedId);
      if (!category) return;

      const updatedImages = [...category.images, croppedBase64];
      setCategories((prev) => prev.map((c) => (c.id === expandedId ? { ...c, images: updatedImages } : c)));
      await persistImages(expandedId, updatedImages);
      setTempImageSrc(null);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการครอบตัดรูปภาพ");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteImage = (categoryId: string, imageIndex: number) => {
    setConfirmDialog({
      message: "ต้องการลบรูปเมนูนี้ใช่หรือไม่?",
      confirmLabel: "ลบรูป",
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        const category = categories.find((c) => c.id === categoryId);
        if (!category) return;
        const updatedImages = category.images.filter((_, idx) => idx !== imageIndex);
        setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, images: updatedImages } : c)));
        await persistImages(categoryId, updatedImages);
      },
    });
  };

  const handleMoveImage = async (categoryId: string, imageIndex: number, direction: -1 | 1) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    const targetIndex = imageIndex + direction;
    if (targetIndex < 0 || targetIndex >= category.images.length) return;

    const updatedImages = [...category.images];
    [updatedImages[imageIndex], updatedImages[targetIndex]] = [updatedImages[targetIndex], updatedImages[imageIndex]];

    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, images: updatedImages } : c)));
    await persistImages(categoryId, updatedImages);
  };

  // ---------- Render ----------

  return (
    <div className="w-full">
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />

      <div className="mb-6">
        <p className="text-zinc-400 text-xs md:text-sm mb-3">
          จัดการหมวดหมู่และรูปเมนูที่โชว์ในป๊อปอัพ &quot;รายการอาหาร&quot; หน้าแรก — ทั้งหมด {categories.length} หมวดหมู่
        </p>
        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={newCategoryLabel}
            onChange={(e) => setNewCategoryLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCategory();
            }}
            placeholder="ชื่อหมวดหมู่ใหม่ เช่น ของหวาน"
            className="flex-1 bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-400"
          />
          <button
            onClick={handleAddCategory}
            disabled={isBusy}
            className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-60 text-black font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all whitespace-nowrap"
          >
            ➕ เพิ่มหมวดหมู่
          </button>
        </div>
      </div>

      {isLoading && <div className="text-zinc-400 text-sm">กำลังโหลดข้อมูลเมนู...</div>}

      {!isLoading && loadError && (
        <div className="bg-red-950/40 border border-red-500/40 text-red-300 text-xs rounded-2xl p-4">
          {loadError}
        </div>
      )}

      {!isLoading && !loadError && categories.length === 0 && (
        <div className="w-full py-16 bg-[#111111] flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-white/[0.08] rounded-2xl gap-3">
          <p className="text-sm font-medium">🍽️ ยังไม่มีหมวดหมู่เมนู เพิ่มหมวดหมู่แรก เช่น &quot;อาหาร&quot; ด้านบนได้เลย</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {categories.map((cat, index) => {
          const isExpanded = expandedId === cat.id;
          return (
            <div
              key={cat.id}
              className="bg-[#111111] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl"
            >
              <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleMoveCategory(index, -1)}
                      disabled={index === 0}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#18181b] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveCategory(index, 1)}
                      disabled={index === categories.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#18181b] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                    >
                      ▼
                    </button>
                  </div>

                  {editingLabelId === cat.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingLabelValue}
                      onChange={(e) => setEditingLabelValue(e.target.value)}
                      onBlur={() => handleSaveLabel(cat)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveLabel(cat);
                        if (e.key === "Escape") setEditingLabelId(null);
                      }}
                      className="bg-[#18181b] border border-yellow-400 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none min-w-0"
                    />
                  ) : (
                    <button
                      onClick={() => handleStartEditLabel(cat)}
                      className="text-left min-w-0"
                      title="กดเพื่อแก้ไขชื่อ"
                    >
                      <h3 className="font-bold text-white text-sm truncate hover:text-yellow-400 transition-colors">
                        ✏️ {cat.category_label}
                      </h3>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {cat.category_key} · {cat.images.length} รูป
                      </p>
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                    className="px-3 py-1.5 rounded-lg bg-[#18181b] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800 text-[11px] font-bold"
                  >
                    {isExpanded ? "▲ ย่อ" : "▼ จัดการรูปภาพ"}
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="px-2.5 py-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/40 text-[11px] font-bold"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-white/[0.08] p-4 bg-[#0d0d0d]">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {cat.images.map((img, imgIdx) => (
                      <div
                        key={imgIdx}
                        className="relative group rounded-xl overflow-hidden border border-white/[0.08] aspect-[3/4] bg-[#18181b]"
                      >
                        <img src={img} alt={`เมนู ${imgIdx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleMoveImage(cat.id, imgIdx, -1)}
                              disabled={imgIdx === 0}
                              className="w-6 h-6 flex items-center justify-center rounded bg-black/70 text-white text-[10px] disabled:opacity-30"
                              title="ย้ายไปก่อนหน้า"
                            >
                              ◀
                            </button>
                            <button
                              onClick={() => handleMoveImage(cat.id, imgIdx, 1)}
                              disabled={imgIdx === cat.images.length - 1}
                              className="w-6 h-6 flex items-center justify-center rounded bg-black/70 text-white text-[10px] disabled:opacity-30"
                              title="ย้ายไปถัดไป"
                            >
                              ▶
                            </button>
                          </div>
                          <button
                            onClick={() => handleDeleteImage(cat.id, imgIdx)}
                            className="text-[10px] font-bold text-red-400 bg-black/70 px-2 py-1 rounded"
                          >
                            🗑️ ลบ
                          </button>
                        </div>
                        <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {imgIdx + 1}
                        </span>
                      </div>
                    ))}

                    <button
                      onClick={() => handleAddImageClick(cat.id)}
                      className="aspect-[3/4] rounded-xl border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center text-zinc-400 hover:border-yellow-400 hover:text-yellow-400 transition-all text-xs font-bold gap-1"
                    >
                      <span className="text-lg">➕</span>
                      เพิ่มรูป
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ================= Crop modal ================= */}
      {tempImageSrc && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-white/[0.08] flex justify-between items-center">
              <h3 className="font-bold text-white text-base">✂️ ครอบตัดรูปเมนู</h3>
              <button onClick={() => setTempImageSrc(null)} className="text-zinc-400 hover:text-white text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="relative w-full h-80 bg-black">
              <Cropper
                image={tempImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={3 / 4}
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
                  disabled={isBusy}
                  className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-60 text-black rounded-xl text-xs font-bold shadow-lg"
                >
                  {isBusy ? "กำลังบันทึก..." : "บันทึกรูปภาพ"}
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