"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { createClient } from "@/lib/supabase/client";

// =================================================
// Types
// =================================================

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

interface PromoFormState {
  id: string | null;
  title: string;
  description: string;
  image: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const BLANK_FORM: PromoFormState = {
  id: null,
  title: "",
  description: "",
  image: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

// =================================================
// Image helpers
// =================================================

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();

    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));

    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

// =================================================
// Crop image
// =================================================

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  maxDimension = 1280,
  quality = 0.85
): Promise<string> {
  const image = await createImage(imageSrc);

  let outWidth = pixelCrop.width;
  let outHeight = pixelCrop.height;

  if (outWidth > maxDimension || outHeight > maxDimension) {
    const scale =
      maxDimension / Math.max(outWidth, outHeight);

    outWidth = Math.round(outWidth * scale);
    outHeight = Math.round(outHeight * scale);
  }

  const canvas = document.createElement("canvas");

  canvas.width = outWidth;
  canvas.height = outHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return "";
  }

  // ทำพื้นหลังสีขาว ป้องกันปัญหารูปบางชนิด
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outWidth, outHeight);

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

// =================================================
// Compress original image
// =================================================

async function compressImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<string> {
  const rawDataUrl: string = await new Promise(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () =>
        resolve(reader.result as string);

      reader.onerror = () =>
        reject(reader.error);

      reader.readAsDataURL(file);
    }
  );

  const image = await createImage(rawDataUrl);

  let width = image.width;
  let height = image.height;

  if (
    width > maxDimension ||
    height > maxDimension
  ) {
    const scale =
      maxDimension / Math.max(width, height);

    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return rawDataUrl;
  }

  ctx.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  return canvas.toDataURL(
    "image/jpeg",
    quality
  );
}

// =================================================
// Date helpers
// =================================================

const formatDateShort = (
  dateStr: string | null
) => {
  if (!dateStr) return "";

  const d = new Date(dateStr);

  return d.toLocaleDateString(
    "th-TH",
    {
      day: "numeric",
      month: "short",
      year: "2-digit",
    }
  );
};

const todayStr = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

// =================================================
// Main component
// =================================================

export default function AdminPromoManager() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  // =================================================
  // State
  // =================================================

  const [promotions, setPromotions] =
    useState<Promotion[]>([]);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [isSaving, setIsSaving] =
    useState<boolean>(false);

  const [loadError, setLoadError] =
    useState<string>("");

  const [formModal, setFormModal] =
    useState<PromoFormState | null>(null);

  const [confirmDialog, setConfirmDialog] =
    useState<{
      message: string;
      confirmLabel?: string;
      danger?: boolean;
      onConfirm: () => void;
    } | null>(null);

  // =================================================
  // Crop workflow state
  // =================================================

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [tempImageSrc, setTempImageSrc] =
    useState<string | null>(null);

  const [crop, setCrop] = useState({
    x: 0,
    y: 0,
  });

  const [zoom, setZoom] =
    useState(1);

  const [
    croppedAreaPixels,
    setCroppedAreaPixels,
  ] = useState<Area | null>(null);

  // =================================================
  // Fetch promotions
  // =================================================

  const fetchPromotions = async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const { data, error } =
        await supabase
          .from("promotions")
          .select("*")
          .order("sort_order", {
            ascending: true,
          })
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        console.error(
          "Error fetching promotions:",
          error
        );

        setLoadError(
          "ไม่สามารถโหลดข้อมูลโปรโมชั่นได้ กรุณาตรวจสอบว่าได้สร้างตาราง promotions ใน Supabase แล้ว"
        );

        setPromotions([]);
      } else {
        setPromotions(
          (data as Promotion[]) || []
        );
      }
    } catch (err) {
      console.error(err);

      setLoadError(
        "ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =================================================
  // Form modal
  // =================================================

  const handleOpenCreate = () => {
    setFormModal({
      ...BLANK_FORM,
      start_date: todayStr(),
    });
  };

  const handleOpenEdit = (
    promo: Promotion
  ) => {
    setFormModal({
      id: promo.id,
      title: promo.title,
      description:
        promo.description || "",
      image: promo.image || "",
      start_date:
        promo.start_date || "",
      end_date:
        promo.end_date || "",
      is_active: promo.is_active,
    });
  };

  const handleCloseForm = () => {
    setFormModal(null);
    setTempImageSrc(null);
    setCroppedAreaPixels(null);
    setZoom(1);
    setCrop({
      x: 0,
      y: 0,
    });
  };

  // =================================================
  // Submit form
  // =================================================

  const handleSubmitForm = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!formModal) return;

    const title =
      formModal.title.trim();

    if (!title) {
      alert(
        "กรุณากรอกชื่อโปรโมชั่น"
      );
      return;
    }

    if (
      formModal.start_date &&
      formModal.end_date &&
      formModal.start_date >
        formModal.end_date
    ) {
      alert(
        "วันที่เริ่มต้องไม่มากกว่าวันที่สิ้นสุด"
      );
      return;
    }

    setIsSaving(true);

    try {
      if (formModal.id) {
        // =============================================
        // Update
        // =============================================

        const { error } =
          await supabase
            .from("promotions")
            .update({
              title,
              description:
                formModal.description.trim() ||
                null,
              image:
                formModal.image || null,
              start_date:
                formModal.start_date ||
                null,
              end_date:
                formModal.end_date ||
                null,
              is_active:
                formModal.is_active,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              formModal.id
            );

        if (error) {
          throw error;
        }
      } else {
        // =============================================
        // Create
        // =============================================

        const nextSortOrder =
          promotions.length > 0
            ? Math.max(
                ...promotions.map(
                  (p) => p.sort_order
                )
              ) + 1
            : 0;

        const { error } =
          await supabase
            .from("promotions")
            .insert({
              title,
              description:
                formModal.description.trim() ||
                null,
              image:
                formModal.image || null,
              start_date:
                formModal.start_date ||
                null,
              end_date:
                formModal.end_date ||
                null,
              is_active:
                formModal.is_active,
              sort_order:
                nextSortOrder,
            });

        if (error) {
          throw error;
        }
      }

      await fetchPromotions();

      handleCloseForm();
    } catch (err) {
      console.error(
        "Save promotion failed:",
        err
      );

      alert(
        "เกิดข้อผิดพลาดในการบันทึกโปรโมชั่น กรุณาลองใหม่อีกครั้ง"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // =================================================
  // Delete
  // =================================================

  const handleDelete = (
    promo: Promotion
  ) => {
    setConfirmDialog({
      message: `ต้องการลบโปรโมชั่น "${promo.title}" ใช่หรือไม่? การลบไม่สามารถกู้คืนได้`,
      confirmLabel:
        "ลบโปรโมชั่น",
      danger: true,

      onConfirm: async () => {
        setConfirmDialog(null);

        const { error } =
          await supabase
            .from("promotions")
            .delete()
            .eq(
              "id",
              promo.id
            );

        if (error) {
          console.error(error);

          alert(
            "ลบโปรโมชั่นไม่สำเร็จ"
          );

          return;
        }

        setPromotions(
          (prev) =>
            prev.filter(
              (p) =>
                p.id !== promo.id
            )
        );
      },
    });
  };

  // =================================================
  // Toggle active
  // =================================================

  const handleToggleActive =
    async (
      promo: Promotion
    ) => {
      const nextValue =
        !promo.is_active;

      setPromotions(
        (prev) =>
          prev.map((p) =>
            p.id === promo.id
              ? {
                  ...p,
                  is_active:
                    nextValue,
                }
              : p
          )
      );

      const { error } =
        await supabase
          .from("promotions")
          .update({
            is_active:
              nextValue,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            promo.id
          );

      if (error) {
        console.error(error);

        alert(
          "อัปเดตสถานะไม่สำเร็จ"
        );

        setPromotions(
          (prev) =>
            prev.map((p) =>
              p.id === promo.id
                ? {
                    ...p,
                    is_active:
                      !nextValue,
                  }
                : p
            )
        );
      }
    };

  // =================================================
  // Reorder
  // =================================================

  const handleMove = async (
    index: number,
    direction: -1 | 1
  ) => {
    const targetIndex =
      index + direction;

    if (
      targetIndex < 0 ||
      targetIndex >=
        promotions.length
    ) {
      return;
    }

    const current =
      promotions[index];

    const target =
      promotions[
        targetIndex
      ];

    const reordered =
      [...promotions];

    reordered[index] =
      target;

    reordered[targetIndex] =
      current;

    setPromotions(
      reordered
    );

    const {
      error: err1,
    } = await supabase
      .from("promotions")
      .update({
        sort_order:
          target.sort_order,
      })
      .eq(
        "id",
        current.id
      );

    const {
      error: err2,
    } = await supabase
      .from("promotions")
      .update({
        sort_order:
          current.sort_order,
      })
      .eq(
        "id",
        target.id
      );

    if (err1 || err2) {
      console.error(
        err1,
        err2
      );

      alert(
        "จัดลำดับไม่สำเร็จ"
      );

      fetchPromotions();
    }
  };

  // =================================================
  // Image upload
  // =================================================

  const handleFileSelect =
    async (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        e.target.files?.[0];

      if (!file) return;

      // ตรวจสอบประเภทไฟล์
      if (
        !file.type.startsWith(
          "image/"
        )
      ) {
        alert(
          "กรุณาเลือกไฟล์รูปภาพเท่านั้น"
        );

        e.target.value = "";
        return;
      }

      // จำกัดขนาดไฟล์เบื้องต้น 10MB
      if (
        file.size >
        10 * 1024 * 1024
      ) {
        alert(
          "ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10MB"
        );

        e.target.value = "";
        return;
      }

      try {
        const compressed =
          await compressImageFile(
            file,
            1600,
            0.85
          );

        setTempImageSrc(
          compressed
        );

        setZoom(1);

        setCrop({
          x: 0,
          y: 0,
        });

        setCroppedAreaPixels(
          null
        );
      } catch (err) {
        console.error(err);

        alert(
          "ไม่สามารถโหลดรูปภาพนี้ได้ กรุณาลองใหม่อีกครั้ง"
        );
      } finally {
        e.target.value = "";
      }
    };

  // =================================================
  // Crop complete
  // =================================================

  const onCropComplete = (
    _area: Area,
    croppedPixels: Area
  ) => {
    setCroppedAreaPixels(
      croppedPixels
    );
  };

  // =================================================
  // Save crop
  // =================================================

  const handleSaveCrop =
    async () => {
      if (
        !tempImageSrc ||
        !croppedAreaPixels ||
        !formModal
      ) {
        return;
      }

      try {
        const croppedBase64 =
          await getCroppedImg(
            tempImageSrc,
            croppedAreaPixels,
            1280,
            0.85
          );

        setFormModal({
          ...formModal,
          image:
            croppedBase64,
        });

        setTempImageSrc(
          null
        );

        setCroppedAreaPixels(
          null
        );

        setZoom(1);

        setCrop({
          x: 0,
          y: 0,
        });
      } catch (err) {
        console.error(err);

        alert(
          "เกิดข้อผิดพลาดในการครอบตัดรูปภาพ"
        );
      }
    };

  // =================================================
  // Remove image
  // =================================================

  const handleRemoveFormImage =
    () => {
      if (!formModal) return;

      setFormModal({
        ...formModal,
        image: "",
      });

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    };

  // =================================================
  // Render
  // =================================================

  return (
    <div className="w-full">

      {/* ============================================
          Hidden file input
      ============================================ */}

      <input
        type="file"
        ref={fileInputRef}
        onChange={
          handleFileSelect
        }
        accept="image/*"
        className="hidden"
      />

      {/* ============================================
          Header
      ============================================ */}

      <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">

        <p className="text-zinc-400 text-xs md:text-sm">
          จัดการโปรโมชั่นที่แสดงในเว็บไซต์
          {" "}
          — ทั้งหมด{" "}
          {promotions.length}{" "}
          รายการ
        </p>

        <button
          onClick={
            handleOpenCreate
          }
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1 whitespace-nowrap"
        >
          ➕ เพิ่มโปรโมชั่นใหม่
        </button>
      </div>

      {/* ============================================
          Loading
      ============================================ */}

      {isLoading && (
        <div className="text-zinc-400 text-sm">
          กำลังโหลดข้อมูลโปรโมชั่น...
        </div>
      )}

      {/* ============================================
          Error
      ============================================ */}

      {!isLoading &&
        loadError && (
          <div className="bg-red-950/40 border border-red-500/40 text-red-300 text-xs rounded-2xl p-4">
            {loadError}
          </div>
        )}

      {/* ============================================
          Empty
      ============================================ */}

      {!isLoading &&
        !loadError &&
        promotions.length ===
          0 && (
          <div className="w-full py-16 bg-[#111111] flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-white/[0.08] rounded-2xl gap-3">

            <p className="text-sm font-medium">
              🎉 ยังไม่มีโปรโมชั่น
              กดปุ่ม
              &quot;เพิ่มโปรโมชั่นใหม่&quot;
              เพื่อเริ่มต้น
            </p>

          </div>
        )}

      {/* ============================================
          Promotion cards
      ============================================ */}

      {!isLoading &&
        !loadError &&
        promotions.length >
          0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {promotions.map(
              (
                promo,
                index
              ) => (
                <div
                  key={
                    promo.id
                  }
                  className={`bg-[#111111] border rounded-2xl overflow-hidden shadow-xl flex flex-col transition-all ${
                    promo.is_active
                      ? "border-white/[0.08]"
                      : "border-white/[0.08] opacity-50"
                  }`}
                >

                  {/* ==================================
                      Card image
                  ================================== */}

                  <div className="relative w-full aspect-square bg-[#18181b]">

                    {promo.image ? (
                      <img
                        src={
                          promo.image
                        }
                        alt={
                          promo.title
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                        ไม่มีรูปภาพ
                      </div>
                    )}

                    <span
                      className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-lg shadow ${
                        promo.is_active
                          ? "bg-emerald-500 text-black"
                          : "bg-zinc-700 text-zinc-300"
                      }`}
                    >
                      {promo.is_active
                        ? "กำลังแสดง"
                        : "ปิดการแสดง"}
                    </span>

                  </div>

                  {/* ==================================
                      Card content
                  ================================== */}

                  <div className="p-4 flex flex-col gap-2 flex-1">

                    <h3 className="font-bold text-white text-sm truncate">
                      {
                        promo.title
                      }
                    </h3>

                    {promo.description && (
                      <p className="text-zinc-400 text-xs line-clamp-2">
                        {
                          promo.description
                        }
                      </p>
                    )}

                    {(promo.start_date ||
                      promo.end_date) && (
                      <p className="text-zinc-500 text-[11px]">
                        📅{" "}
                        {formatDateShort(
                          promo.start_date
                        ) ||
                          "ไม่ระบุ"}{" "}
                        -{" "}
                        {formatDateShort(
                          promo.end_date
                        ) ||
                          "ไม่ระบุ"}
                      </p>
                    )}

                    {/* =================================
                        Buttons
                    ================================= */}

                    <div className="mt-auto pt-3 flex items-center justify-between gap-2">

                      <div className="flex gap-1">

                        {/* Move up */}

                        <button
                          onClick={() =>
                            handleMove(
                              index,
                              -1
                            )
                          }
                          disabled={
                            index ===
                            0
                          }
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#18181b] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                          title="เลื่อนขึ้น"
                        >
                          ▲
                        </button>

                        {/* Move down */}

                        <button
                          onClick={() =>
                            handleMove(
                              index,
                              1
                            )
                          }
                          disabled={
                            index ===
                            promotions.length -
                              1
                          }
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#18181b] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                          title="เลื่อนลง"
                        >
                          ▼
                        </button>

                      </div>

                      <div className="flex gap-1.5">

                        {/* Toggle */}

                        <button
                          onClick={() =>
                            handleToggleActive(
                              promo
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#18181b] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800 text-[11px] font-bold"
                        >
                          {promo.is_active
                            ? "🙈 ซ่อน"
                            : "👁️ แสดง"}
                        </button>

                        {/* Edit */}

                        <button
                          onClick={() =>
                            handleOpenEdit(
                              promo
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/40 text-[11px] font-bold"
                        >
                          ✏️ แก้ไข
                        </button>

                        {/* Delete */}

                        <button
                          onClick={() =>
                            handleDelete(
                              promo
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/40 text-[11px] font-bold"
                        >
                          🗑️
                        </button>

                      </div>

                    </div>
                  </div>
                </div>
              )
            )}

          </div>
        )}

      {/* ============================================
          FORM MODAL
      ============================================ */}

      {formModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">

          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal header */}

            <div className="p-5 border-b border-white/[0.08] flex justify-between items-center sticky top-0 bg-[#111111] z-10">

              <h3 className="font-bold text-white text-base">
                {formModal.id
                  ? "✏️ แก้ไขโปรโมชั่น"
                  : "➕ เพิ่มโปรโมชั่นใหม่"}
              </h3>

              <button
                onClick={
                  handleCloseForm
                }
                className="text-zinc-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>

            </div>

            {/* Form */}

            <form
              onSubmit={
                handleSubmitForm
              }
              className="p-5 flex flex-col gap-4"
            >

              {/* =====================================
                  Image
              ===================================== */}

              <div>

                <label className="block text-xs text-zinc-400 mb-2">
                  รูปภาพโปรโมชั่น
                </label>

                {formModal.image ? (
                  <div className="relative group rounded-xl overflow-hidden border border-white/[0.08] bg-[#18181b]">

                    {/* 1:1 Preview */}

                    <div className="w-full aspect-square flex items-center justify-center overflow-hidden">

                      <img
                        src={
                          formModal.image
                        }
                        alt="ตัวอย่างรูปโปรโมชั่น"
                        className="w-full h-full object-contain"
                      />

                    </div>

                    {/* Image buttons */}

                    <div className="absolute top-2 right-2 flex gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="bg-black/70 hover:bg-black/90 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-white/[0.08]"
                      >
                        ✂️ เปลี่ยนรูป
                      </button>

                      <button
                        type="button"
                        onClick={
                          handleRemoveFormImage
                        }
                        className="bg-red-600/80 hover:bg-red-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-red-500"
                      >
                        🗑️ ลบ
                      </button>

                    </div>

                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="w-full aspect-square max-h-80 bg-[#18181b] flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-white/[0.08] rounded-xl gap-2 hover:border-yellow-400 hover:text-yellow-400 transition-all text-xs font-bold"
                  >
                    <span className="text-3xl">
                      🖼️
                    </span>

                    <span>
                      ➕ อัปโหลดรูปภาพ
                    </span>

                    <span className="text-[10px] text-zinc-600 font-normal">
                      แนะนำรูปสี่เหลี่ยม 1:1
                      เช่น 1080 × 1080
                    </span>
                  </button>
                )}

              </div>

              {/* =====================================
                  Title
              ===================================== */}

              <div>

                <label className="block text-xs text-zinc-400 mb-1">
                  ชื่อโปรโมชั่น *
                </label>

                <input
                  type="text"
                  autoFocus
                  required
                  value={
                    formModal.title
                  }
                  onChange={(e) =>
                    setFormModal({
                      ...formModal,
                      title:
                        e.target.value,
                    })
                  }
                  placeholder="เช่น โปรฯ ลด 20% วันเกิด"
                  className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                />

              </div>

              {/* =====================================
                  Description
              ===================================== */}

              <div>

                <label className="block text-xs text-zinc-400 mb-1">
                  รายละเอียด
                </label>

                <textarea
                  value={
                    formModal.description
                  }
                  onChange={(e) =>
                    setFormModal({
                      ...formModal,
                      description:
                        e.target.value,
                    })
                  }
                  placeholder="รายละเอียดเพิ่มเติมของโปรโมชั่น..."
                  rows={3}
                  className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
                />

              </div>

              {/* =====================================
                  Date
              ===================================== */}

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="block text-xs text-zinc-400 mb-1">
                    วันที่เริ่ม
                  </label>

                  <input
                    type="date"
                    value={
                      formModal.start_date
                    }
                    onChange={(e) =>
                      setFormModal({
                        ...formModal,
                        start_date:
                          e.target.value,
                      })
                    }
                    className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                  />

                </div>

                <div>

                  <label className="block text-xs text-zinc-400 mb-1">
                    วันที่สิ้นสุด
                  </label>

                  <input
                    type="date"
                    min={
                      formModal.start_date ||
                      undefined
                    }
                    value={
                      formModal.end_date
                    }
                    onChange={(e) =>
                      setFormModal({
                        ...formModal,
                        end_date:
                          e.target.value,
                      })
                    }
                    className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                  />

                </div>

              </div>

              {/* =====================================
                  Active
              ===================================== */}

              <label className="flex items-center gap-2 cursor-pointer select-none">

                <input
                  type="checkbox"
                  checked={
                    formModal.is_active
                  }
                  onChange={(e) =>
                    setFormModal({
                      ...formModal,
                      is_active:
                        e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-yellow-400"
                />

                <span className="text-xs text-zinc-300">
                  แสดงโปรโมชั่นนี้บนเว็บไซต์ทันที
                </span>

              </label>

              {/* =====================================
                  Form buttons
              ===================================== */}

              <div className="flex justify-end gap-2 pt-3 mt-1 border-t border-white/[0.08]">

                <button
                  type="button"
                  onClick={
                    handleCloseForm
                  }
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  disabled={
                    isSaving
                  }
                  className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-60 text-black rounded-xl text-sm font-bold shadow-lg"
                >
                  {isSaving
                    ? "กำลังบันทึก..."
                    : formModal.id
                    ? "บันทึกการแก้ไข"
                    : "เพิ่มโปรโมชั่น"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

      {/* ============================================
          CROP MODAL
      ============================================ */}

      {tempImageSrc && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4">

          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">

            {/* Crop header */}

            <div className="p-4 border-b border-white/[0.08] flex justify-between items-center">

              <div>
                <h3 className="font-bold text-white text-base">
                  ✂️ ครอบตัดรูปภาพโปรโมชั่น
                </h3>

                <p className="text-[10px] text-zinc-500 mt-1">
                  ลากรูปเพื่อจัดตำแหน่ง
                  และใช้แถบซูมเพื่อปรับขนาด
                </p>
              </div>

              <button
                onClick={() =>
                  setTempImageSrc(
                    null
                  )
                }
                className="text-zinc-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>

            </div>

            {/* ========================================
                Crop area 1:1
            ======================================== */}

            <div className="relative w-full aspect-square max-h-[65vh] bg-black">

              <Cropper
                image={
                  tempImageSrc
                }
                crop={crop}
                zoom={zoom}

                /*
                 * สำคัญ:
                 * ใช้ 1:1 เพื่อให้เหมาะกับ
                 * โปสเตอร์ 590x590
                 */
                aspect={1 / 1}

                onCropChange={
                  setCrop
                }

                onCropComplete={
                  onCropComplete
                }

                onZoomChange={
                  setZoom
                }

                objectFit="contain"

                showGrid={true}

                minZoom={1}

                maxZoom={4}

                restrictPosition={
                  true
                }
              />

            </div>

            {/* ========================================
                Crop controls
            ======================================== */}

            <div className="p-4 flex flex-col gap-4 bg-[#111111]">

              {/* Zoom */}

              <div className="flex items-center gap-3">

                <span className="text-xs text-zinc-400 whitespace-nowrap">
                  🔍 ซูม
                </span>

                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={4}
                  step={0.1}
                  onChange={(e) =>
                    setZoom(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="w-full accent-yellow-400"
                />

                <span className="text-xs text-zinc-500 w-8 text-right">
                  {zoom.toFixed(
                    1
                  )}
                </span>

              </div>

              {/* Hint */}

              <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-3">

                <p className="text-[11px] text-yellow-300 leading-relaxed">
                  💡
                  แนะนำให้จัดวางข้อความสำคัญ
                  เช่น ราคา โปรโมชั่น
                  และเบอร์โทรศัพท์
                  ให้อยู่ภายในกรอบสีขาว
                </p>

              </div>

              {/* Buttons */}

              <div className="flex justify-end gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setTempImageSrc(
                      null
                    )
                  }
                  className="px-4 py-2 bg-[#18181b] hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold"
                >
                  ยกเลิก
                </button>

                <button
                  type="button"
                  onClick={
                    handleSaveCrop
                  }
                  disabled={
                    !croppedAreaPixels
                  }
                  className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black rounded-xl text-xs font-bold shadow-lg"
                >
                  ✓ บันทึกรูปภาพ
                </button>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* ============================================
          CONFIRM DIALOG
      ============================================ */}

      {confirmDialog && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">

          <div
            className={`bg-[#111111] border rounded-2xl p-6 w-full max-w-sm shadow-2xl relative text-center ${
              confirmDialog.danger
                ? "border-red-500/60"
                : "border-yellow-400/60"
            }`}
          >

            <div className="text-3xl mb-3">
              {confirmDialog.danger
                ? "⚠️"
                : "❓"}
            </div>

            <p className="text-sm text-white mb-6 leading-relaxed">
              {
                confirmDialog.message
              }
            </p>

            <div className="flex justify-center gap-3">

              <button
                type="button"
                onClick={() =>
                  setConfirmDialog(
                    null
                  )
                }
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={
                  confirmDialog.onConfirm
                }
                className={`px-5 py-2 rounded-xl text-sm font-bold shadow-lg text-white ${
                  confirmDialog.danger
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {
                  confirmDialog.confirmLabel ||
                    "ยืนยัน"
                }
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}