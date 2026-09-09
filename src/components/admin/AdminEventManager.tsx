"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { createClient } from "@/lib/supabase/client";

// =================================================
// Types
// =================================================

interface EventRow {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  display_date: string;
  image: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface EventFormState {
  id: string | null; // null = สร้างใหม่
  title: string;
  date: string;
  image: string;
  is_active: boolean;
}

const BLANK_FORM: EventFormState = {
  id: null,
  title: "",
  date: "",
  image: "",
  is_active: true,
};

// =================================================
// Image helpers (เหมือนหน้าจัดการโปรโมชั่น: ย่อ+บีบอัดรูป แล้วเก็บเป็น base64 data URL)
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

// แปลง "2026-10-02" -> "2 ต.ค. 69" แบบเดียวกับที่หน้าแรกใช้แสดงป้ายวันที่
const toDisplayDate = (isoDate: string) => {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
};

// =================================================
// Main component
// =================================================

export default function AdminEventManager() {
  const supabase = useMemo(() => createClient(), []);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>("");

  const [formModal, setFormModal] = useState<EventFormState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Crop workflow state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const fetchEvents = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const { data, error } = await supabase.from("events").select("*").order("date", { ascending: true });

      if (error) {
        console.error("Error fetching events:", error);
        setLoadError("ไม่สามารถโหลดข้อมูลกิจกรรมได้ กรุณาตรวจสอบว่าได้สร้างตาราง events ใน Supabase แล้ว");
        setEvents([]);
      } else {
        setEvents((data as EventRow[]) || []);
      }
    } catch (err) {
      console.error(err);
      setLoadError("ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Form modal ----------

  const handleOpenCreate = () => {
    setFormModal({ ...BLANK_FORM });
  };

  const handleOpenEdit = (ev: EventRow) => {
    setFormModal({
      id: ev.id,
      title: ev.title,
      date: ev.date,
      image: ev.image || "",
      is_active: ev.is_active,
    });
  };

  const handleCloseForm = () => {
    setFormModal(null);
    setTempImageSrc(null);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formModal) return;

    const title = formModal.title.trim();
    if (!title) {
      alert("กรุณากรอกชื่อการแสดง / คอนเสิร์ต");
      return;
    }
    if (!formModal.date) {
      alert("กรุณาเลือกวันที่จัดงาน");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title,
        date: formModal.date,
        display_date: toDisplayDate(formModal.date),
        image: formModal.image || null,
        is_active: formModal.is_active,
        updated_at: new Date().toISOString(),
      };

      if (formModal.id) {
        const { error } = await supabase.from("events").update(payload).eq("id", formModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert(payload);
        if (error) throw error;
      }

      await fetchEvents();
      handleCloseForm();
    } catch (err) {
      console.error("Save event failed:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกกิจกรรม กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Delete / toggle ----------

  const handleDelete = (ev: EventRow) => {
    setConfirmDialog({
      message: `ต้องการลบกิจกรรม "${ev.title}" ใช่หรือไม่? การลบไม่สามารถกู้คืนได้`,
      confirmLabel: "ลบกิจกรรม",
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await supabase.from("events").delete().eq("id", ev.id);
        if (error) {
          console.error(error);
          alert("ลบกิจกรรมไม่สำเร็จ");
          return;
        }
        setEvents((prev) => prev.filter((p) => p.id !== ev.id));
      },
    });
  };

  const handleToggleActive = async (ev: EventRow) => {
    const nextValue = !ev.is_active;
    setEvents((prev) => prev.map((p) => (p.id === ev.id ? { ...p, is_active: nextValue } : p)));
    const { error } = await supabase
      .from("events")
      .update({ is_active: nextValue, updated_at: new Date().toISOString() })
      .eq("id", ev.id);
    if (error) {
      console.error(error);
      alert("อัปเดตสถานะไม่สำเร็จ");
      setEvents((prev) => prev.map((p) => (p.id === ev.id ? { ...p, is_active: !nextValue } : p)));
    }
  };

  // ---------- Image crop workflow ----------

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 1600, 0.85);
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
    if (!tempImageSrc || !croppedAreaPixels || !formModal) return;
    try {
      const croppedBase64 = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      setFormModal({ ...formModal, image: croppedBase64 });
      setTempImageSrc(null);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการครอบตัดรูปภาพ");
    }
  };

  const handleRemoveFormImage = () => {
    if (!formModal) return;
    setFormModal({ ...formModal, image: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---------- Render ----------

  return (
    <div className="w-full">
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />

      <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
        <p className="text-zinc-400 text-xs md:text-sm">
          จัดการรอบการแสดง/คอนเสิร์ตที่จะขึ้นในหน้าแรก — ทั้งหมด {events.length} รายการ
        </p>
        <button
          onClick={handleOpenCreate}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1 whitespace-nowrap"
        >
          ➕ เพิ่มรอบการแสดงใหม่
        </button>
      </div>

      {isLoading && <div className="text-zinc-400 text-sm">กำลังโหลดข้อมูลกิจกรรม...</div>}

      {!isLoading && loadError && (
        <div className="bg-red-950/40 border border-red-500/40 text-red-300 text-xs rounded-2xl p-4">
          {loadError}
        </div>
      )}

      {!isLoading && !loadError && events.length === 0 && (
        <div className="w-full py-16 bg-[#111111] flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-white/[0.08] rounded-2xl gap-3">
          <p className="text-sm font-medium">🎤 ยังไม่มีรอบการแสดง กดปุ่ม &quot;เพิ่มรอบการแสดงใหม่&quot; เพื่อเริ่มต้น</p>
        </div>
      )}

      {!isLoading && !loadError && events.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {events.map((ev) => (
            <div
              key={ev.id}
              className={`bg-[#111111] border rounded-2xl overflow-hidden shadow-xl flex flex-col transition-all ${
                ev.is_active ? "border-white/[0.08]" : "border-white/[0.08] opacity-50"
              }`}
            >
              <div className="relative w-full aspect-[3/4] bg-[#18181b]">
                {ev.image ? (
                  <img src={ev.image} alt={ev.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                    ไม่มีรูปภาพ
                  </div>
                )}
                <span className="absolute top-2 left-2 bg-[#E8A33D] text-[#19160F] text-[10px] font-black px-2.5 py-1 rounded-full shadow">
                  {ev.display_date}
                </span>
                <span
                  className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-lg shadow ${
                    ev.is_active ? "bg-emerald-500 text-black" : "bg-zinc-700 text-zinc-300"
                  }`}
                >
                  {ev.is_active ? "กำลังแสดง" : "ปิดการแสดง"}
                </span>
              </div>

              <div className="p-4 flex flex-col gap-2 flex-1">
                <h3 className="font-bold text-white text-sm line-clamp-2">{ev.title}</h3>

                <div className="mt-auto pt-3 flex flex-wrap items-center justify-end gap-1.5">
                  <button
                    onClick={() => handleToggleActive(ev)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#18181b] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800 text-[11px] font-bold"
                  >
                    {ev.is_active ? "🙈 ซ่อน" : "👁️ แสดง"}
                  </button>
                  <button
                    onClick={() => handleOpenEdit(ev)}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/40 text-[11px] font-bold"
                  >
                    ✏️ แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(ev)}
                    className="px-2.5 py-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/40 text-[11px] font-bold"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= Form modal (สร้าง/แก้ไข) ================= */}
      {formModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-white/[0.08] flex justify-between items-center sticky top-0 bg-[#111111]">
              <h3 className="font-bold text-white text-base">
                {formModal.id ? "✏️ แก้ไขรอบการแสดง" : "➕ เพิ่มรอบการแสดงใหม่"}
              </h3>
              <button onClick={handleCloseForm} className="text-zinc-400 hover:text-white text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 flex flex-col gap-4">
              {/* รูปภาพ */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">โปสเตอร์การแสดง (แนวตั้ง)</label>
                {formModal.image ? (
                  <div className="relative group rounded-xl overflow-hidden border border-white/[0.08] w-40 mx-auto">
                    <img
                      src={formModal.image}
                      alt="ตัวอย่างโปสเตอร์"
                      className="w-full aspect-[3/4] object-cover"
                    />
                    <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-black/60 hover:bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-white/[0.08]"
                      >
                        ✂️ เปลี่ยน
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveFormImage}
                        className="bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-red-500"
                      >
                        🗑️ ลบ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-40 mx-auto aspect-[3/4] flex bg-[#18181b] flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-white/[0.08] rounded-xl gap-1 hover:border-yellow-400 hover:text-yellow-400 transition-all text-xs font-bold"
                  >
                    ➕ อัปโหลด
                    <br />
                    โปสเตอร์
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">ชื่อการแสดง / คอนเสิร์ต *</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={formModal.title}
                  onChange={(e) => setFormModal({ ...formModal, title: e.target.value })}
                  placeholder="เช่น Boy Imagine Exclusive Music"
                  className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">วันที่จัดงาน *</label>
                <input
                  type="date"
                  required
                  value={formModal.date}
                  onChange={(e) => setFormModal({ ...formModal, date: e.target.value })}
                  className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                />
                {formModal.date && (
                  <p className="text-[11px] text-zinc-500 mt-1">
                    ป้ายที่จะแสดง: <span className="text-yellow-400">{toDisplayDate(formModal.date)}</span>
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formModal.is_active}
                  onChange={(e) => setFormModal({ ...formModal, is_active: e.target.checked })}
                  className="w-4 h-4 accent-yellow-400"
                />
                <span className="text-xs text-zinc-300">แสดงรอบการแสดงนี้บนหน้าแรกทันที</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 mt-1 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-60 text-black rounded-xl text-sm font-bold shadow-lg"
                >
                  {isSaving ? "กำลังบันทึก..." : formModal.id ? "บันทึกการแก้ไข" : "เพิ่มรอบการแสดง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= Crop modal ================= */}
      {tempImageSrc && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-white/[0.08] flex justify-between items-center">
              <h3 className="font-bold text-white text-base">✂️ ครอบตัดโปสเตอร์การแสดง</h3>
              <button onClick={() => setTempImageSrc(null)} className="text-zinc-400 hover:text-white text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="relative w-full h-96 bg-black">
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
                  className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-xl text-xs font-bold shadow-lg"
                >
                  บันทึกรูปภาพ
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