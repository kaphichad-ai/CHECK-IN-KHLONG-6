"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { createClient } from "@/lib/supabase/client";

// =================================================
// Types
// =================================================

interface ContactRow {
  id: string;
  category_key: string;
  category_label: string;
  icon: string | null;
  image: string | null;
  link_url: string;
  button_label: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// =================================================
// Image helpers (เหมือนหน้าเมนู/โปรโมชั่น/อีเวนต์/แบนเนอร์)
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
  maxDimension = 1080,
  quality = 0.85
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

async function compressImageFile(file: File, maxDimension = 1400, quality = 0.85): Promise<string> {
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
//
// เวอร์ชันนี้ตัดฟิลด์ ชื่อช่องทาง/ไอคอน/ข้อความปุ่ม ออกจากหน้าจอ (ยังคงมีอยู่ในฐานข้อมูล
// เพื่อความเข้ากันได้ แต่ระบบจะตั้งค่าอัตโนมัติให้) เหลือแค่สิ่งที่ต้องจัดการจริง ๆ คือ
// "รูปภาพ" กับ "ลิงก์ปลายทาง" ต่อช่องทาง เหมือนวิธีจัดการรูปในหน้าเมนู/แบนเนอร์

export default function AdminContactManager() {
  const supabase = useMemo(() => createClient(), []);

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // แก้ไขลิงก์แบบ inline
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkValue, setEditingLinkValue] = useState<string>("");

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Crop workflow — ใช้ทั้งตอน "เพิ่มรูปใหม่" และ "เปลี่ยนรูปของช่องทางเดิม"
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadMode, setUploadMode] = useState<"new" | "replace">("new");
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const fetchContacts = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const { data, error } = await supabase.from("contacts").select("*").order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching contacts:", error);
        setLoadError("ไม่สามารถโหลดข้อมูลช่องทางติดต่อได้ กรุณาตรวจสอบว่าได้สร้างตาราง contacts ใน Supabase แล้ว");
        setContacts([]);
      } else {
        setContacts((data as ContactRow[]) || []);
      }
    } catch (err) {
      console.error(err);
      setLoadError("ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- เพิ่ม/เปลี่ยน/ลบรูปภาพ ----------

  const handleAddImageClick = () => {
    setUploadMode("new");
    setUploadTargetId(null);
    fileInputRef.current?.click();
  };

  const handleChangeImageClick = (contactId: string) => {
    setUploadMode("replace");
    setUploadTargetId(contactId);
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
    if (!tempImageSrc || !croppedAreaPixels) return;
    setIsBusy(true);
    try {
      const croppedBase64 = await getCroppedImg(tempImageSrc, croppedAreaPixels);

      if (uploadMode === "new") {
        const key = `contact-${Date.now()}`;
        const nextSortOrder = contacts.length > 0 ? Math.max(...contacts.map((c) => c.sort_order)) + 1 : 0;
        const { error } = await supabase.from("contacts").insert({
          category_key: key,
          category_label: `ช่องทางที่ ${contacts.length + 1}`,
          icon: "💬",
          image: croppedBase64,
          link_url: "",
          button_label: "ติดต่อ",
          is_active: true,
          sort_order: nextSortOrder,
        });
        if (error) throw error;
      } else if (uploadTargetId) {
        setContacts((prev) => prev.map((c) => (c.id === uploadTargetId ? { ...c, image: croppedBase64 } : c)));
        const { error } = await supabase
          .from("contacts")
          .update({ image: croppedBase64, updated_at: new Date().toISOString() })
          .eq("id", uploadTargetId);
        if (error) throw error;
      }

      setTempImageSrc(null);
      setUploadTargetId(null);
      await fetchContacts();
    } catch (err) {
      console.error(err);
      alert("บันทึกรูปภาพไม่สำเร็จ");
    } finally {
      setIsBusy(false);
    }
  };

  // ---------- ลิงก์ปลายทาง ----------

  const handleStartEditLink = (contact: ContactRow) => {
    setEditingLinkId(contact.id);
    setEditingLinkValue(contact.link_url || "");
  };

  const handleSaveLink = async (contact: ContactRow) => {
    const value = editingLinkValue.trim();
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, link_url: value } : c)));
    setEditingLinkId(null);

    const { error } = await supabase
      .from("contacts")
      .update({ link_url: value, updated_at: new Date().toISOString() })
      .eq("id", contact.id);
    if (error) {
      console.error(error);
      alert("บันทึกลิงก์ไม่สำเร็จ");
      fetchContacts();
    }
  };

  // ---------- สถานะ / ลำดับ / ลบ ----------

  const handleToggleActive = async (contact: ContactRow) => {
    const nextValue = !contact.is_active;
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, is_active: nextValue } : c)));
    const { error } = await supabase
      .from("contacts")
      .update({ is_active: nextValue, updated_at: new Date().toISOString() })
      .eq("id", contact.id);
    if (error) {
      console.error(error);
      alert("เปลี่ยนสถานะไม่สำเร็จ");
      fetchContacts();
    }
  };

  const handleDeleteContact = (contact: ContactRow) => {
    setConfirmDialog({
      message: "ต้องการลบช่องทางติดต่อนี้ใช่หรือไม่?",
      confirmLabel: "ลบช่องทาง",
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
        if (error) {
          console.error(error);
          alert("ลบช่องทางไม่สำเร็จ");
          return;
        }
        setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      },
    });
  };

  const handleMoveContact = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= contacts.length) return;

    const current = contacts[index];
    const target = contacts[targetIndex];

    const reordered = [...contacts];
    reordered[index] = target;
    reordered[targetIndex] = current;
    setContacts(reordered);

    const { error: err1 } = await supabase
      .from("contacts")
      .update({ sort_order: target.sort_order })
      .eq("id", current.id);
    const { error: err2 } = await supabase
      .from("contacts")
      .update({ sort_order: current.sort_order })
      .eq("id", target.id);

    if (err1 || err2) {
      console.error(err1, err2);
      alert("จัดลำดับไม่สำเร็จ");
      fetchContacts();
    }
  };

  // ---------- Render ----------

  return (
    <div className="w-full">
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-zinc-400 text-xs md:text-sm">
          จัดการรูปช่องทางติดต่อแอดมิน (LINE, Facebook ฯลฯ) ที่แสดงในหน้า &quot;ติดต่อแอดมิน&quot; — แต่ละรูปตั้งลิงก์ปลายทางของตัวเอง
          ได้ — ทั้งหมด {contacts.length} ช่องทาง
        </p>

        <button
          onClick={handleAddImageClick}
          className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-60 text-black font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all whitespace-nowrap self-start sm:self-auto"
        >
          ➕ เพิ่มรูปช่องทางใหม่
        </button>
      </div>

      {isLoading && <div className="text-zinc-400 text-sm">กำลังโหลดข้อมูลช่องทางติดต่อ...</div>}

      {!isLoading && loadError && (
        <div className="bg-red-950/40 border border-red-500/40 text-red-300 text-xs rounded-2xl p-4">
          {loadError}
        </div>
      )}

      {!isLoading && !loadError && contacts.length === 0 && (
        <div className="w-full py-16 bg-[#111111] flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-white/[0.08] rounded-2xl gap-3">
          <p className="text-sm font-medium">💬 ยังไม่มีช่องทางติดต่อ กด &quot;เพิ่มรูปช่องทางใหม่&quot; ด้านบนได้เลย</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {contacts.map((contact, index) => (
          <div
            key={contact.id}
            className="bg-[#111111] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl flex flex-col"
          >
            {/* รูปภาพ */}
            <div className="relative w-full aspect-square bg-[#18181b] group">
              {contact.image ? (
                <img src={contact.image} alt="ช่องทางติดต่อ" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-[11px] text-center px-2">
                  ยังไม่มีรูป
                </div>
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => handleChangeImageClick(contact.id)}
                  className="text-[10px] font-bold text-white bg-black/70 px-2.5 py-1.5 rounded-lg"
                >
                  🖼️ {contact.image ? "เปลี่ยนรูป" : "เพิ่มรูป"}
                </button>
              </div>

              <button
                onClick={() => handleToggleActive(contact)}
                className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm transition-colors ${
                  contact.is_active
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                    : "bg-black/50 border-white/[0.15] text-zinc-400"
                }`}
              >
                {contact.is_active ? "🟢 แสดงอยู่" : "⚪ ซ่อนอยู่"}
              </button>

              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => handleMoveContact(index, -1)}
                  disabled={index === 0}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-black/60 hover:bg-black/80 text-white disabled:opacity-30 disabled:cursor-not-allowed text-[10px]"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMoveContact(index, 1)}
                  disabled={index === contacts.length - 1}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-black/60 hover:bg-black/80 text-white disabled:opacity-30 disabled:cursor-not-allowed text-[10px]"
                >
                  ▼
                </button>
              </div>
            </div>

            {/* ลิงก์ปลายทาง */}
            <div className="p-3 flex flex-col gap-2 flex-1">
              <label className="text-[10px] text-zinc-500">ลิงก์ปลายทาง</label>
              {editingLinkId === contact.id ? (
                <input
                  type="text"
                  autoFocus
                  value={editingLinkValue}
                  onChange={(e) => setEditingLinkValue(e.target.value)}
                  onBlur={() => handleSaveLink(contact)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveLink(contact);
                    if (e.key === "Escape") setEditingLinkId(null);
                  }}
                  placeholder="https://line.me/ti/p/..."
                  className="w-full bg-[#18181b] border border-yellow-400 rounded-lg px-2.5 py-1.5 text-white text-[11px] focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => handleStartEditLink(contact)}
                  className="w-full text-left bg-[#18181b] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-zinc-300 text-[11px] truncate hover:border-yellow-400/60 transition-colors"
                  title="กดเพื่อแก้ไขลิงก์"
                >
                  {contact.link_url || "— ยังไม่ได้ใส่ลิงก์ —"}
                </button>
              )}

              <button
                onClick={() => handleDeleteContact(contact)}
                className="mt-auto px-2.5 py-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/40 text-[10px] font-bold self-start"
              >
                🗑️ ลบช่องทางนี้
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ================= Crop modal ================= */}
      {tempImageSrc && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-white/[0.08] flex justify-between items-center">
              <h3 className="font-bold text-white text-base">
                ✂️ {uploadMode === "new" ? "ครอบตัดรูปช่องทางใหม่" : "ครอบตัดรูปช่องทางติดต่อ"}
              </h3>
              <button
                onClick={() => {
                  setTempImageSrc(null);
                  setUploadTargetId(null);
                }}
                className="text-zinc-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="relative w-full h-80 bg-black">
              <Cropper
                image={tempImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
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
                  onClick={() => {
                    setTempImageSrc(null);
                    setUploadTargetId(null);
                  }}
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