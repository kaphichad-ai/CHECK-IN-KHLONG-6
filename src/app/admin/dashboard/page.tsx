"use client";

import React, { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Cropper, { Area } from "react-easy-crop";
import { createClient } from "@/lib/supabase/client";

type TabKey = "dashboard" | "promo" | "event" | "banner" | "table";

const menuItems: {
  key: TabKey;
  label: string;
  icon: string;
}[] = [
  { key: "dashboard", label: "ภาพรวม", icon: "▦" },
  { key: "promo", label: "โปรโมชั่น", icon: "◇" },
  { key: "event", label: "กิจกรรม / Event", icon: "◉" },
  { key: "banner", label: "จัดการ Banner", icon: "▣" },
  { key: "table", label: "จัดการโต๊ะ / ผังร้าน", icon: "▤" },
];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  const pageTitle: Record<TabKey, string> = {
    dashboard: "ภาพรวมระบบ",
    promo: "จัดการโปรโมชั่น",
    event: "จัดการกิจกรรม / Event",
    banner: "จัดการ Banner",
    table: "จัดการโต๊ะและผังร้าน",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex overflow-x-hidden relative">
      {/* Mobile Backdrop เมื่อเปิด Sidebar บนมือถือ */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs transition-opacity print:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 bg-[#111111] border-r border-white/[0.08] flex flex-col justify-between transition-all duration-300 print:hidden ${
          isSidebarOpen ? "w-64 p-6" : "w-20 p-4 md:w-20"
        } ${!isSidebarOpen && "max-md:-translate-x-full"}`}
      >
        <div>
          <div className="flex items-center justify-between mb-8">
            {isSidebarOpen ? (
              <h1 className="text-lg font-black tracking-wider text-yellow-400 truncate">ADMIN PANEL</h1>
            ) : (
              <h1 className="text-sm font-black text-yellow-400 text-center w-full">ADMIN</h1>
            )}
          </div>
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-xs font-bold transition-all ${
                  activeTab === item.key
                    ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/10"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                }`}
                title={!isSidebarOpen ? item.label : undefined}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {isSidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-4 border-t border-white/[0.08] hidden md:block">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:bg-white/[0.04] hover:text-white transition-all"
            title={isSidebarOpen ? "ย่อเมนู" : "ขยายเมนู"}
          >
            <span>{isSidebarOpen ? "◀" : "▶"}</span>
            {isSidebarOpen && <span>ย่อแถบเมนู</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
        <header className="flex justify-between items-center mb-8 gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 rounded-xl bg-[#111111] border border-white/[0.08] text-yellow-400 hover:bg-white/[0.04] transition-all flex items-center justify-center shrink-0 shadow-md"
              title="ซ่อน/แสดงเมนู"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-xl md:text-2xl font-black truncate">{pageTitle[activeTab]}</h2>
          </div>
        </header>

        {activeTab === "dashboard" && <div className="text-zinc-400 text-sm">เนื้อหาภาพรวมระบบ...</div>}
        {activeTab === "promo" && <div className="text-zinc-400 text-sm">เนื้อหาจัดการโปรโมชั่น...</div>}
        {activeTab === "event" && <div className="text-zinc-400 text-sm">เนื้อหาจัดการกิจกรรม...</div>}
        {activeTab === "banner" && <div className="text-zinc-400 text-sm">เนื้อหาจัดการ Banner...</div>}
        {activeTab === "table" && <AdminTableManager />}
      </main>
    </div>
  );
}

{/* =================================================
    TABLE MANAGER
================================================== */}

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

  // ย่อขนาดภาพผลลัพธ์ลง ไม่ให้ใหญ่เกินจำเป็น (รูปจากมือถือมักมีความละเอียดสูงมาก
  // ถ้าไม่ย่อ ไฟล์ base64 จะใหญ่มากจนอัปโหลด/โหลดไม่สำเร็จบนมือถือ)
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

// ย่อ+บีบอัดรูปที่เลือกจากไฟล์ ก่อนแปลงเป็น base64
// (กล้องมือถือมักถ่ายรูปที่ 3000-4000px ซึ่งใหญ่เกินความจำเป็นสำหรับแสดงผลบนเว็บ
// และทำให้ payload ที่ส่งไป Supabase ใหญ่เกินไปจนล้มเหลวบนเน็ตมือถือ)
async function compressImageFile(file: File, maxDimension = 1600, quality = 0.8): Promise<string> {
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

interface ZonePrice {
  name: string;
  price: number | string;
  color: string;
}

interface BookingInfo {
  customerName: string;
  phone: string;
  lineId?: string;
  slipImage?: string;
  totalPaid?: number;
  timestamp: string;
  status: "pending" | "confirmed";
  checkedIn?: boolean;
  checkedInAt?: string;
}

interface DailyConfig {
  aRows: number | string;
  aCols: number | string;
  bTopCount: number | string;
  bBottomCount: number | string;
  sCount: number | string;
  specialCount: number | string;
  eventImage?: string;
  artistName?: string;
  customNames: Record<string, string>;
  bookings: Record<string, BookingInfo>;
}

const DEFAULT_CONFIG: DailyConfig = {
  aRows: 12,
  aCols: 7,
  bTopCount: 10,
  bBottomCount: 5,
  sCount: 25,
  specialCount: 3,
  artistName: "",
  eventImage: "",
  customNames: {},
  bookings: {},
};

const DEFAULT_PRICES: Record<string, ZonePrice> = {
  VIP: { name: "VIP ZONE", price: 0, color: "bg-teal-700" },
  A: { name: "A ZONE", price: 0, color: "bg-amber-800" },
  B: { name: "B ZONE", price: 0, color: "bg-rose-800" },
  S: { name: "S ZONE (ชั้น 2)", price: 0, color: "bg-amber-700" },
  SPECIAL: { name: "พิเศษ (120-122)", price: 0, color: "bg-purple-800" },
};

const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function AdminTableManagerContent() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const queryDate = searchParams.get("date");

  const todayStr = getLocalDateString();

  const [currentDate, setCurrentDate] = useState<string>(queryDate || todayStr);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditingArtistName, setIsEditingArtistName] = useState<boolean>(false);

  const [saveSuccessModal, setSaveSuccessModal] = useState<{
    show: boolean;
    date: string;
    artistName: string;
    prices: Record<string, ZonePrice>;
  } | null>(null);

  useEffect(() => {
    if (queryDate) {
      setCurrentDate(queryDate);
    }
  }, [queryDate]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportAreaRef = useRef<HTMLDivElement>(null);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
 const handleExportImage = async () => {
    if (!exportAreaRef.current) return;
    try {
      setIsExportingImage(true);

      if (typeof document !== "undefined" && document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // ignore
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 150));

      const html2canvasModule = await import("html2canvas-pro");
      const html2canvas = html2canvasModule.default || html2canvasModule;

      const isPhone = /iPhone|iPod|Android/i.test(navigator.userAgent);
      const canvasScale = isPhone ? 1.5 : 2;

      // กำหนดขนาดจำกัดเฉพาะส่วน exportAreaRef ให้เป็นสัดส่วนที่สวยงาม (เช่น ฟิกซ์ความกว้าง หรือใช้ scrollWidth)
      const canvas = await html2canvas(exportAreaRef.current, {
        backgroundColor: "#ffffff",
        scale: canvasScale,
        useCORS: true,
        // กำหนดขนาดความกว้าง-สูงให้พอดีกับเนื้อหาข้างใน ไม่ให้ยืดตามหน้าจอหลักเกินไป
        width: exportAreaRef.current.scrollWidth,
        windowWidth: exportAreaRef.current.scrollWidth,
      });

      const dataUrl = canvas.toDataURL("image/png");

      if (isPhone) {
        setPreviewImage(dataUrl);
      } else {
        const link = document.createElement("a");
        link.download = `ผังโต๊ะ-${currentConfig.artistName || currentDate}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error("Export image failed:", err);
      alert("เกิดข้อผิดพลาดในการส่งออกรูปภาพ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExportingImage(false);
    }
  };
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [prices, setPrices] = useState<Record<string, ZonePrice>>(DEFAULT_PRICES);
  const [dailyData, setDailyData] = useState<Record<string, DailyConfig>>({
    [todayStr]: DEFAULT_CONFIG,
  });

  useEffect(() => {
    const fetchDailyData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("daily_configs")
          .select("*")
          .eq("date", currentDate)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching data from Supabase:", error);
        }

        if (data) {
          setDailyData((prev) => ({
            ...prev,
            [currentDate]: data.config || DEFAULT_CONFIG,
          }));
          if (data.prices) {
            setPrices(data.prices);
          }
        } else {
          setDailyData((prev) => ({
            ...prev,
            [currentDate]: DEFAULT_CONFIG,
          }));
          setPrices(DEFAULT_PRICES);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyData();
  }, [currentDate, supabase]);

  const currentConfig: DailyConfig = dailyData[currentDate] || DEFAULT_CONFIG;

  const updateCurrentConfig = (updater: (prev: DailyConfig) => DailyConfig) => {
    setDailyData((prev) => ({
      ...prev,
      [currentDate]: updater(prev[currentDate] || { ...currentConfig }),
    }));
  };

  const numConfig = {
    aRows: Number(currentConfig.aRows) || 0,
    aCols: Number(currentConfig.aCols) || 0,
    bTopCount: Number(currentConfig.bTopCount) || 0,
    bBottomCount: Number(currentConfig.bBottomCount) || 0,
    sCount: Number(currentConfig.sCount) || 0,
    specialCount: Number(currentConfig.specialCount) || 0,
  };

  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isEditTableNamesMode, setIsEditTableNamesMode] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [newTableNameInput, setNewTableNameInput] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [slipFileName, setSlipFileName] = useState<string>("");

  const [viewTableDetail, setViewTableDetail] = useState<{ id: string; info: BookingInfo } | null>(null);
  const [viewSlipImage, setViewSlipImage] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [editCustomerModal, setEditCustomerModal] = useState<{
    id: string;
    name: string;
    phone: string;
    lineId: string;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const handleDateChange = (date: string) => {
    setCurrentDate(date);
    setSelectedTables([]);
    setIsEditingArtistName(false);
  };

  const getDateOptions = () => {
    const dates = [];
    const baseDate = new Date();
    for (let i = 0; i <= 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dates.push(getLocalDateString(d));
    }
    return dates;
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (dateStr === todayStr) return "วันนี้";
    return d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // ย่อรูปก่อนนำไปครอบตัด กันรูปจากกล้องมือถือที่มีขนาดใหญ่มากทำให้ค้าง/โหลดไม่ขึ้น
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
    if (tempImageSrc && croppedAreaPixels) {
      try {
        const croppedBase64 = await getCroppedImg(tempImageSrc, croppedAreaPixels);
        updateCurrentConfig((prev) => ({
          ...prev,
          eventImage: croppedBase64,
        }));
        setTempImageSrc(null);
      } catch (e) {
        console.error(e);
        alert("เกิดข้อผิดพลาดในการครอบตัดรูปภาพ");
      }
    }
  };

  const handleRemoveImage = () => {
    setConfirmDialog({
      message: "คุณต้องการลบรูปภาพวงดนตรีของวันนี้ใช่หรือไม่?",
      confirmLabel: "ลบรูปภาพ",
      danger: true,
      onConfirm: () => {
        updateCurrentConfig((prev) => ({
          ...prev,
          eventImage: "",
        }));
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setConfirmDialog(null);
      },
    });
  };

  const handleSaveArtistName = async () => {
    setIsEditingArtistName(false);
    await handleSaveAllChanges();
  };

  const handleTableClick = (id: string) => {
    if (isEditTableNamesMode) {
      setEditingTableId(id);
      setNewTableNameInput(currentConfig.customNames[id] || id);
      return;
    }

    if (currentConfig.bookings[id]) {
      setViewTableDetail({ id, info: currentConfig.bookings[id] });
      return;
    }

    setSelectedTables((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveSingleTableName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTableId) return;

    updateCurrentConfig((prev) => ({
      ...prev,
      customNames: {
        ...prev.customNames,
        [editingTableId]: newTableNameInput.trim() || editingTableId,
      },
    }));

    setEditingTableId(null);
  };

  const handleSaveAllChanges = async () => {
    try {
      const configToSave = {
        ...currentConfig,
        aRows: Number(currentConfig.aRows) || 0,
        aCols: Number(currentConfig.aCols) || 0,
        bTopCount: Number(currentConfig.bTopCount) || 0,
        bBottomCount: Number(currentConfig.bBottomCount) || 0,
        sCount: Number(currentConfig.sCount) || 0,
        specialCount: Number(currentConfig.specialCount) || 0,
      };

      const pricesToSave = Object.fromEntries(
        Object.entries(prices).map(([k, v]) => [k, { ...v, price: Number(v.price) || 0 }])
      );

      const { error } = await supabase.from("daily_configs").upsert({
        date: currentDate,
        config: configToSave,
        prices: pricesToSave,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Supabase Upsert Error:", error);
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล");
      } else {
        setIsEditTableNamesMode(false);
        setSaveSuccessModal({
          show: true,
          date: currentDate,
          artistName: currentConfig.artistName || "ไม่ได้ระบุชื่อวง",
          prices: pricesToSave,
        });
      }
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้");
    }
  };

  const getZoneKeyFromId = (id: string) => {
    if (id.startsWith("VIP")) return "VIP";
    if (id.startsWith("B")) return "B";
    if (id.startsWith("S")) return "S";
    if (["120", "121", "122"].includes(id)) return "SPECIAL";
    return "A";
  };

  const getTablePrice = (id: string) => {
    const zoneKey = getZoneKeyFromId(id);
    return Number(prices[zoneKey]?.price) || 0;
  };

  const totalPrice = selectedTables.reduce((sum, id) => sum + getTablePrice(id), 0);

  const handleAdminSlipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("ไฟล์สลิปมีขนาดใหญ่เกินไป กรุณาเลือกไฟล์ที่ไม่เกิน 15MB");
      e.target.value = "";
      return;
    }

    try {
      // ย่อ+บีบอัดรูปสลิปก่อนบันทึก กันไฟล์จากกล้องมือถือ (มักใหญ่กว่า 4MB) ทำให้บันทึก/โหลดไม่สำเร็จ
      const compressed = await compressImageFile(file, 1000, 0.75);
      setSlipImage(compressed);
      setSlipFileName(file.name);
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถโหลดรูปสลิปนี้ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      e.target.value = "";
    }
  };

  const handleRemoveAdminSlip = () => {
    setSlipImage(null);
    setSlipFileName("");
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || selectedTables.length === 0) return;

    const timestamp = new Date().toLocaleString("th-TH");

    const updatedBookings = { ...currentConfig.bookings };
    selectedTables.forEach((tableId) => {
      updatedBookings[tableId] = {
        customerName,
        phone: phone || "",
        lineId: lineId || undefined,
        slipImage: slipImage || undefined,
        totalPaid: totalPrice,
        timestamp,
        status: "confirmed",
      };
    });

    const newConfig = { ...currentConfig, bookings: updatedBookings };

    updateCurrentConfig(() => newConfig);

    const { error } = await supabase.from("daily_configs").upsert({
      date: currentDate,
      config: newConfig,
      prices: prices,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึกการจองลงฐานข้อมูล");
    } else {
      const pricesToSave = Object.fromEntries(
        Object.entries(prices).map(([k, v]) => [k, { ...v, price: Number(v.price) || 0 }])
      );

      setSaveSuccessModal({
        show: true,
        date: currentDate,
        artistName: `จองโต๊ะ: ${selectedTables.map((id) => currentConfig.customNames[id] || id).join(", ")}`,
        prices: pricesToSave,
      });

      setSelectedTables([]);
      setCustomerName("");
      setPhone("");
      setLineId("");
      setSlipImage(null);
      setSlipFileName("");
      setShowBookingForm(false);
    }
  };

  const handleApproveBooking = async (tableId: string) => {
    const booking = currentConfig.bookings[tableId];
    if (!booking) return;

    const updatedBookings = {
      ...currentConfig.bookings,
      [tableId]: {
        ...booking,
        status: "confirmed" as const,
      },
    };

    const newConfig = { ...currentConfig, bookings: updatedBookings };
    updateCurrentConfig(() => newConfig);

    const { error } = await supabase.from("daily_configs").upsert({
      date: currentDate,
      config: newConfig,
      prices: prices,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการอนุมัติการจอง");
    } else {
      setViewTableDetail(null);
      alert(`อนุมัติการจองโต๊ะ ${currentConfig.customNames[tableId] || tableId} เรียบร้อยแล้ว!`);
    }
  };

  const handleToggleCheckedIn = async (tableId: string) => {
    const booking = currentConfig.bookings[tableId];
    if (!booking) return;

    const nextCheckedIn = !booking.checkedIn;

    const updatedBookings = {
      ...currentConfig.bookings,
      [tableId]: {
        ...booking,
        checkedIn: nextCheckedIn,
        checkedInAt: nextCheckedIn ? new Date().toLocaleString("th-TH") : undefined,
      },
    };

    const newConfig = { ...currentConfig, bookings: updatedBookings };
    updateCurrentConfig(() => newConfig);

    const { error } = await supabase.from("daily_configs").upsert({
      date: currentDate,
      config: newConfig,
      prices: prices,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึกสถานะรับโต๊ะ");
    } else {
      setViewTableDetail((prev) =>
        prev && prev.id === tableId
          ? { ...prev, info: updatedBookings[tableId] }
          : prev
      );
      if (nextCheckedIn) {
        alert(`บันทึกแล้ว: ลูกค้ารับโต๊ะ ${currentConfig.customNames[tableId] || tableId} เรียบร้อย!`);
      }
    }
  };

  const handleSaveCustomerEdit = async () => {
    if (!editCustomerModal) return;
    if (!editCustomerModal.name.trim()) {
      alert("กรุณาระบุชื่อลูกค้า");
      return;
    }

    const booking = currentConfig.bookings[editCustomerModal.id];
    if (!booking) return;

    const updatedBooking: BookingInfo = {
      ...booking,
      customerName: editCustomerModal.name.trim(),
      phone: editCustomerModal.phone.trim(),
      lineId: editCustomerModal.lineId.trim() || undefined,
    };

    const updatedBookings = {
      ...currentConfig.bookings,
      [editCustomerModal.id]: updatedBooking,
    };

    const newConfig = { ...currentConfig, bookings: updatedBookings };
    updateCurrentConfig(() => newConfig);

    const { error } = await supabase.from("daily_configs").upsert({
      date: currentDate,
      config: newConfig,
      prices: prices,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลลูกค้า");
    } else {
      setViewTableDetail((prev) =>
        prev && prev.id === editCustomerModal.id ? { ...prev, info: updatedBooking } : prev
      );
      setEditCustomerModal(null);
    }
  };

  const executeCancelBooking = async (tableId: string) => {
    const updatedBookings = { ...currentConfig.bookings };
    delete updatedBookings[tableId];

    const newConfig = { ...currentConfig, bookings: updatedBookings };

    updateCurrentConfig(() => newConfig);

    const { error } = await supabase.from("daily_configs").upsert({
      date: currentDate,
      config: newConfig,
      prices: prices,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการยกเลิกการจอง");
    } else {
      setViewTableDetail(null);
      alert("ยกเลิกการจองโต๊ะเรียบร้อยแล้ว");
    }
  };

  const handleCancelBooking = (tableId: string) => {
    setConfirmDialog({
      message: `ต้องการยกเลิกการจองโต๊ะ ${currentConfig.customNames[tableId] || tableId} ใช่หรือไม่?`,
      confirmLabel: "ยกเลิกการจอง",
      danger: true,
      onConfirm: () => {
        setConfirmDialog(null);
        executeCancelBooking(tableId);
      },
    });
  };

  const renderCircleTable = (id: string, defaultZoneKey: string, extraClass = "") => {
    const isSelected = selectedTables.includes(id);
    const booking = currentConfig.bookings[id];
    const isBooked = Boolean(booking);
    const isPending = booking?.status === "pending";

    const zoneKey = getZoneKeyFromId(id);
    const zone = prices[zoneKey] || prices[defaultZoneKey];
    const displayLabel = currentConfig.customNames[id] || id;
    const isCustomized = Boolean(currentConfig.customNames[id]);

    let bgClass = "bg-emerald-600 hover:bg-emerald-500 ring-1 ring-emerald-300/40";
    let statusOverlay = null;

    if (isPending) {
      bgClass = "bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold ring-2 ring-yellow-300 animate-pulse shadow-lg";
      statusOverlay = (
        <span className="text-[10px] font-black text-black leading-tight flex flex-col items-center justify-center">
          <span>⏳</span>
          <span className="text-[7px] -mt-0.5 tracking-tighter truncate max-w-full">{displayLabel}</span>
        </span>
      );
    } else if (isBooked) {
      if (booking.checkedIn) {
        bgClass = "bg-gradient-to-br from-violet-600 via-violet-700 to-purple-900 ring-2 ring-violet-300/80 text-white font-black shadow-inner";
        statusOverlay = (
          <span className="relative flex items-center justify-center w-full h-full">
            <span className="absolute text-violet-200/50 text-[9px] font-black select-none pointer-events-none top-0.5">🙋</span>
            <span className="relative z-10 text-[8.5px] font-black truncate max-w-full px-0.5 mt-1">
              {displayLabel}
            </span>
          </span>
        );
      } else {
        bgClass = "bg-gradient-to-br from-red-600 via-red-700 to-red-900 ring-2 ring-red-400/80 text-white font-black shadow-inner opacity-95";
        statusOverlay = (
          <span className="relative flex items-center justify-center w-full h-full">
            <span className="absolute text-red-300/60 text-lg font-black select-none pointer-events-none">✕</span>
            <span className="relative z-10 text-[8.5px] font-black truncate max-w-full px-0.5">
              {displayLabel}
            </span>
          </span>
        );
      }
    } else if (isSelected) {
      bgClass = "bg-gradient-to-tr from-sky-500 to-blue-400 ring-2 ring-white scale-110 font-black text-white shadow-xl";
      statusOverlay = (
        <span className="flex flex-col items-center justify-center leading-none">
          <span className="text-[8px]">✓</span>
          <span className="text-[8px] font-bold -mt-0.5 truncate max-w-full">{displayLabel}</span>
        </span>
      );
    }

    if (isEditTableNamesMode) {
      bgClass = "bg-amber-500 hover:bg-amber-400 ring-2 ring-black font-bold animate-pulse cursor-pointer";
    }

    return (
      <button
        key={id}
        onClick={() => handleTableClick(id)}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] text-white transition-all shadow-md overflow-hidden truncate px-0.5 relative ${bgClass} ${extraClass} ${
          isCustomized && !isBooked && !isSelected ? "ring-2 ring-cyan-400 font-bold" : ""
        }`}
        title={
          isPending
            ? `โต๊ะ: ${displayLabel} (รอตรวจสลิป)`
            : isBooked
            ? `โต๊ะ: ${displayLabel} (${booking.checkedIn ? "มารับโต๊ะแล้ว" : "จองแล้ว"} โดย: ${booking.customerName})`
            : isEditTableNamesMode
            ? `คลิกเพื่อแก้ไขเลขโต๊ะ ${displayLabel}`
            : `โต๊ะ: ${displayLabel} (ว่าง) - ฿${(Number(zone?.price) || 0).toLocaleString()}`
        }
      >
        {statusOverlay ? statusOverlay : <span className="leading-none">{displayLabel}</span>}
      </button>
    );
  };

  return (
    <div className="w-full text-white flex flex-col items-center font-sans space-y-6">
      {/* CSS สำหรับสั่งพิมพ์ (ปรับ zoom ให้พอดีหน้ากระดาษแผ่นเดียว A4 แนวนอน) */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 2mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          aside, header, .print\:hidden {
            display: none !important;
          }
          /* ปรับลดสัดส่วนซูมให้พอดี 1 หน้ากระดาษ */
          .printable-export-area {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            zoom: 0.60; 
          }
          .printable-export-area > * {
            margin-top: 2px !important;
            margin-bottom: 2px !important;
          }
          .printable-export-area .overflow-x-auto,
          .printable-export-area .overflow-y-auto {
            overflow: visible !important;
            max-height: none !important;
          }
          .printable-export-area .min-w-\\[850px\\] {
            min-width: 0 !important;
            width: fit-content !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="w-full flex flex-col md:flex-row justify-between items-center border-b border-white/[0.08] pb-4 gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-white">
            Check in <span className="text-yellow-400 font-sans text-sm">KHLONG 6 (ADMIN)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">ระบบผังโต๊ะแยกอิสระรายวัน (เชื่อมต่อ Supabase)</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg transition-all flex items-center gap-1.5"
          >
            <span>📄</span> Export เป็น PDF
          </button>
          <button
            onClick={handleExportImage}
            disabled={isExportingImage}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg transition-all flex items-center gap-1.5"
          >
            <span>🖼️</span> {isExportingImage ? "กำลังสร้างรูป..." : "Export เป็นรูปภาพ (PNG)"}
          </button>
          <div className="text-sm bg-[#111111] px-4 py-2 rounded-2xl border border-white/[0.08] flex items-center gap-2">
            {isLoading && <span className="text-xs text-yellow-400 animate-pulse">กำลังโหลด...</span>}
            <span>
              เลือกแล้ว:{" "}
              <span className="text-yellow-400 font-bold">
                {selectedTables.length > 0
                  ? selectedTables.map((id) => currentConfig.customNames[id] || id).join(", ")
                  : "ไม่มี"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* พื้นที่ที่จะถูกบันทึก/พิมพ์ลง PDF (รวม Banner และผังโต๊ะ) */}
      <div ref={exportAreaRef} className="w-full flex flex-col items-center space-y-6 printable-export-area">
        {/* คำอธิบายสถานะสีโต๊ะ (ซ่อนตอนพิมพ์) */}
        <div className="w-full bg-[#111111] border border-white/[0.08] rounded-2xl p-4 print:hidden flex flex-wrap items-center justify-center gap-6 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-600 ring-1 ring-emerald-300/40"></div>
            <span className="text-emerald-400 font-bold">ว่าง (คลิกเพื่อเลือก)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-sky-500 to-blue-400 ring-1 ring-white flex items-center justify-center text-[9px] text-white font-bold">✓</div>
            <span>กำลังเลือก</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-400 text-black text-[9px] flex items-center justify-center font-bold animate-pulse">⏳</div>
            <span className="text-amber-400 font-bold">รอแอดมินตรวจสลิป</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-600 to-red-900 ring-1 ring-red-400 flex items-center justify-center text-[8px] text-white">🔒</div>
            <span className="text-red-400 font-bold">จองแล้ว (อนุมัติแล้ว)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-600 to-purple-900 ring-1 ring-violet-300 flex items-center justify-center text-[8px] text-white">🙋</div>
            <span className="text-violet-400 font-bold">มารับโต๊ะแล้ว</span>
          </div>
        </div>

        {/* DATE BAR SELECTOR (ซ่อนตอนพิมพ์ PDF) */}
        <div className="w-full bg-[#111111] border border-white/[0.08] p-3 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-bold text-yellow-400 whitespace-nowrap">📅 เลือกวัน:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
              {getDateOptions().map((date) => {
                const isActive = currentDate === date;
                return (
                  <button
                    key={date}
                    onClick={() => handleDateChange(date)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                      isActive
                        ? "bg-yellow-400 text-black border-yellow-400 shadow-md scale-105"
                        : "bg-[#18181b] text-zinc-300 border-white/[0.04] hover:bg-white/[0.04]"
                    }`}
                  >
                    {formatDateLabel(date)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-white/[0.08] pt-2 md:pt-0 md:pl-3 w-full md:w-auto justify-between md:justify-start">
            <span className="text-[10px] text-zinc-400">วันอื่น:</span>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-[#18181b] border border-white/[0.08] rounded-xl px-2 py-1 text-white text-xs focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />

        {/* EVENT BANNER */}
        <div className="w-full mb-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] shadow-xl relative">
          {currentConfig.eventImage ? (
            <div className="relative group">
              <img
                src={currentConfig.eventImage}
                alt={currentConfig.artistName || "วงดนตรีประจำวัน"}
                className="w-full h-56 md:h-80 print:h-[90px] object-cover transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-6 print:p-3">
                <span className="text-yellow-400 text-xs print:text-[9px] font-bold tracking-widest uppercase">SPECIAL CONCERT ({currentDate})</span>

                {isEditingArtistName ? (
                  <div className="flex items-center gap-2 mt-1 max-w-md print:hidden">
                    <input
                      type="text"
                      value={currentConfig.artistName || ""}
                      onChange={(e) => updateCurrentConfig((prev) => ({ ...prev, artistName: e.target.value }))}
                      placeholder="พิมพ์ชื่อวงดนตรี..."
                      className="bg-[#18181b] border border-yellow-400 text-white font-extrabold text-xl md:text-2xl px-3 py-1 rounded-xl focus:outline-none w-full"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveArtistName}
                      className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow whitespace-nowrap"
                    >
                      💾 บันทึก
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl md:text-4xl print:text-base font-extrabold text-white tracking-wide">
                      {currentConfig.artistName || "ศิลปินประจำวัน"}
                    </h2>
                    <button
                      onClick={() => setIsEditingArtistName(true)}
                      className="text-zinc-300 hover:text-yellow-400 text-xs bg-black/40 hover:bg-black/70 px-2.5 py-1 rounded-xl border border-white/[0.08] transition-all print:hidden"
                    >
                      ✏️ แก้ชื่อวง
                    </button>
                  </div>
                )}
              </div>

              <div className="absolute top-4 right-4 flex gap-2 z-10 print:hidden">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg border border-white/[0.08] backdrop-blur-sm transition-all flex items-center gap-1"
                >
                  ✂️ เปลี่ยนและตัดรูปใหม่
                </button>
                <button
                  onClick={handleRemoveImage}
                  className="bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg border border-red-500 backdrop-blur-sm transition-all flex items-center gap-1"
                >
                  🗑️ ลบรูป
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full h-52 bg-[#111111] flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-white/[0.08] rounded-2xl p-4 gap-3">
              <p className="text-sm font-medium text-center">🎤 ยังไม่ได้เพิ่มรูปภาพวงดนตรีสำหรับวันที่ {currentDate}</p>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-lg print:hidden">
                <input
                  type="text"
                  placeholder="ระบุชื่อวงดนตรี / งานคอนเสิร์ต..."
                  value={currentConfig.artistName || ""}
                  onChange={(e) => updateCurrentConfig((prev) => ({ ...prev, artistName: e.target.value }))}
                  className="bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-yellow-400 w-full"
                />
                <button
                  onClick={handleSaveAllChanges}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap transition-all"
                >
                  💾 บันทึกชื่อวง
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-xs px-4 py-2 rounded-xl shadow-lg transition-all flex items-center gap-1 whitespace-nowrap"
                >
                  ➕ อัปโหลดโปสเตอร์
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Layout Map */}
        <div className="w-full bg-[#ded5c6] text-black p-6 print:p-3 rounded-2xl shadow-2xl overflow-x-auto">
          <div className="min-w-[850px] grid grid-cols-12 gap-4 relative">
            <div className="col-span-7 flex flex-col gap-4 border-r border-gray-400 pr-4">
              <div className="w-3/4 mx-auto bg-gray-500 text-white font-bold text-center py-4 rounded-b-3xl text-xl tracking-widest shadow-inner">
                stage
              </div>

              <div className="flex gap-4 items-start mt-2">
                <div className="flex flex-col gap-3">
                  {numConfig.specialCount > 0 && (
                    <div className="flex flex-col gap-1 items-center">
                      {["120", "121", "122"].slice(0, numConfig.specialCount).map((id) => renderCircleTable(id, "SPECIAL"))}
                    </div>
                  )}

                  <div className="border border-black p-2 rounded-2xl flex flex-col gap-2 bg-[#d1c6b4] mt-2 items-center">
                    {Array.from({ length: 4 }).map((_, i) => {
                      const id = `VIP ${i + 1}`;
                      return renderCircleTable(id, "VIP", "w-12 h-12 text-xs");
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                  <div
                    className="grid gap-x-2 gap-y-1.5 justify-items-center"
                    style={{
                      gridTemplateColumns: `repeat(${numConfig.aCols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${numConfig.aRows}, minmax(0, 1fr))`,
                      gridAutoFlow: "column",
                    }}
                  >
                    {Array.from({ length: numConfig.aCols }).map((_, colIndex) =>
                      Array.from({ length: numConfig.aRows }).map((_, rowIndex) => {
                        const tableNumber = colIndex * numConfig.aRows + rowIndex + 1;
                        const tableId = `A${tableNumber}`;
                        return renderCircleTable(tableId, "A");
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-black p-3 rounded-2xl flex items-center justify-between gap-2 mt-4 bg-[#c8bca9]">
                <div className="bg-black text-white text-xs font-bold p-2 rounded text-center w-16">Entrance Exit</div>
                <div className="flex gap-3 overflow-x-auto">
                  {Array.from({ length: 3 }).map((_, i) => {
                    const id = `VIP ${i + 5}`;
                    return renderCircleTable(id, "VIP", "w-14 h-10 text-xs rounded-xl");
                  })}
                </div>
                <div className="font-bold text-lg text-gray-800 pr-2">ชั้น 1</div>
              </div>
            </div>

            <div className="col-span-5 flex gap-4 pl-2">
              <div className="flex flex-col justify-between items-center w-1/2">
                {numConfig.bTopCount > 0 ? (
                  <div className="border border-black p-2 rounded-xl grid grid-cols-2 gap-2 bg-[#d1c6b4] w-full justify-items-center">
                    {Array.from({ length: Math.ceil(numConfig.bTopCount / 2) }).map((_, rowIndex) => (
                      <React.Fragment key={rowIndex}>
                        {renderCircleTable(`B${rowIndex + 1}`, "B")}
                        {rowIndex + Math.ceil(numConfig.bTopCount / 2) < numConfig.bTopCount &&
                          renderCircleTable(`B${rowIndex + Math.ceil(numConfig.bTopCount / 2) + 1}`, "B")}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="border border-red-500/30 p-2 rounded-xl bg-red-100/50 w-full text-center text-[10px] text-red-600 font-bold">
                    ปิดโซน B บน
                  </div>
                )}

                <div className="my-2 flex flex-col items-center gap-1">
                  <div className="w-8 h-8 border border-black rounded-full flex items-center justify-center text-xs bg-white">🚺</div>
                  <div className="bg-black text-white px-3 py-6 font-bold tracking-widest text-sm rounded-md">BAR</div>
                  <div className="w-8 h-8 border border-black rounded-full flex items-center justify-center text-xs bg-white">🚹</div>
                </div>

                {numConfig.bBottomCount > 0 ? (
                  <div className="border border-black p-2 rounded-xl grid grid-cols-2 gap-2 bg-[#d1c6b4] w-full justify-items-center">
                    {Array.from({ length: Math.ceil(numConfig.bBottomCount / 2) }).map((_, rowIndex) => (
                      <React.Fragment key={rowIndex}>
                        {renderCircleTable(`B${rowIndex + 11}`, "B")}
                        {rowIndex + Math.ceil(numConfig.bBottomCount / 2) < numConfig.bBottomCount &&
                          renderCircleTable(`B${rowIndex + Math.ceil(numConfig.bBottomCount / 2) + 11}`, "B")}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="border border-red-500/30 p-2 rounded-xl bg-red-100/50 w-full text-center text-[10px] text-red-600 font-bold">
                    ปิดโซน B ล่าง
                  </div>
                )}
              </div>

              <div className="flex-1 border-2 border-black p-3 rounded-2xl flex flex-col justify-between bg-[#c8bca9]">
                {numConfig.sCount > 0 ? (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 justify-items-center max-h-[380px] overflow-y-auto">
                    {Array.from({ length: Math.ceil(numConfig.sCount / 2) }).map((_, rowIndex) => {
                      const sHalf = Math.ceil(numConfig.sCount / 2);
                      const firstColIndex = rowIndex + 1;
                      const secondColIndex = rowIndex + 1 + sHalf;

                      return (
                        <React.Fragment key={rowIndex}>
                          {firstColIndex <= numConfig.sCount && renderCircleTable(`S${firstColIndex}`, "S")}
                          {secondColIndex <= numConfig.sCount && renderCircleTable(`S${secondColIndex}`, "S")}
                        </React.Fragment>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center bg-black/10 rounded-xl border border-black/20">
                    <span className="text-2xl mb-1">🚫</span>
                    <span className="text-xs font-bold text-red-800">ปิดบริการโซน S</span>
                    <span className="text-[10px] text-gray-600 mt-1">(0 โต๊ะ)</span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 border-t border-black pt-2">
                  <div className="flex items-center gap-1">
                    <div className="w-5 h-5 bg-pink-300 rounded-full"></div>
                    <span className="text-xs font-bold">บันได</span>
                  </div>
                  <span className="font-bold text-lg">ชั้น 2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* แถบสรุปโต๊ะที่เลือก + ปุ่มเปิด popup กรอกข้อมูลการจอง (ซ่อนตอนพิมพ์ PDF) */}
      {selectedTables.length > 0 && (
        <div className="w-full bg-[#111111] border border-yellow-400 rounded-2xl p-4 shadow-xl print:hidden flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-400">
              โต๊ะที่เลือก:{" "}
              <span className="text-yellow-400 font-bold">
                {selectedTables.map((id) => currentConfig.customNames[id] || id).join(", ")}
              </span>
            </p>
            <span className="text-sm font-extrabold text-emerald-400">
              ราคารวม: ฿{totalPrice.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTables([])}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => setShowBookingForm(true)}
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-2 rounded-xl text-sm font-bold shadow-lg"
            >
              📝 กรอกข้อมูลจอง
            </button>
          </div>
        </div>
      )}

      {/* Popup กรอกข้อมูลการจอง */}
      {showBookingForm && selectedTables.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-yellow-400 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-yellow-400">📝 กรอกข้อมูลการจอง (โดย Admin)</h3>
              <span className="text-sm font-extrabold text-emerald-400 bg-[#18181b] px-3 py-1 rounded-xl border border-white/[0.08]">
                ราคารวม: ฿{totalPrice.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              โต๊ะที่เลือก:{" "}
              <span className="text-yellow-400 font-bold">
                {selectedTables.map((id) => currentConfig.customNames[id] || id).join(", ")}
              </span>
            </p>

            <form onSubmit={handleConfirmBooking} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">ชื่อผู้จอง / ลูกค้า *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="ระบุชื่อผู้จอง"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">เบอร์โทรศัพท์ (ถ้ามี)</label>
                  <input
                    type="tel"
                    placeholder="08xxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">LINE ID</label>
                  <input
                    type="text"
                    placeholder="ระบุ LINE ID (ถ้ามี)"
                    value={lineId}
                    onChange={(e) => setLineId(e.target.value)}
                    className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">แนบสลิปการโอนเงิน (ถ้ามี)</label>
                {slipImage ? (
                  <div className="relative bg-[#18181b] border border-white/[0.08] rounded-xl p-2 flex items-center gap-3">
                    <img src={slipImage} alt="สลิปการโอนเงิน" className="w-12 h-12 object-cover rounded-lg border border-white/[0.08]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{slipFileName}</p>
                      <p className="text-[10px] text-emerald-400">แนบสลิปแล้ว ✓</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveAdminSlip}
                      className="text-zinc-400 hover:text-red-400 text-xs font-bold px-2"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 border border-dashed border-white/[0.08] rounded-xl p-2.5 cursor-pointer hover:border-yellow-400 hover:bg-white/[0.02] transition-all text-xs text-zinc-400">
                    <span>📎</span>
                    <span>แตะเพื่อเลือกรูปสลิป</span>
                    <input type="file" accept="image/*" onChange={handleAdminSlipSelect} className="hidden" />
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setShowBookingForm(false);
                    setSlipImage(null);
                    setSlipFileName("");
                    setLineId("");
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg"
                >
                  ยืนยันการจอง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN CONTROL CENTER (ซ่อนตอนพิมพ์ PDF) */}
      <div className="w-full bg-[#111111] border border-white/[0.08] rounded-2xl p-6 shadow-xl flex flex-col gap-6 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-center bg-[#18181b] p-4 rounded-xl border border-white/[0.08] gap-4">
          <div>
            <h3 className="text-sm font-bold text-yellow-400">✏️ แก้ไขเลขโต๊ะบนผัง (วันที่ {currentDate})</h3>
            <p className="text-xs text-zinc-400">เปิดโหมดนี้แล้วกดที่โต๊ะใดก็ได้บนผังด้านบนเพื่อพิมพ์เปลี่ยนเลข/ชื่อโต๊ะ</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditTableNamesMode(!isEditTableNamesMode)}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                isEditTableNamesMode
                  ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20"
                  : "bg-zinc-800 hover:bg-zinc-700 text-white"
              }`}
            >
              {isEditTableNamesMode ? "❌ ปิดโหมดกดแก้" : "✏️ กดที่โต๊ะเพื่อแก้เลข"}
            </button>

            <button
              onClick={handleSaveAllChanges}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg transition-all flex items-center gap-1"
            >
              💾 บันทึกผังวันนี้ลง Supabase
            </button>
          </div>
        </div>

        <div className="bg-[#18181b]/60 border border-white/[0.08] p-4 rounded-xl">
          <h2 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2">
            📐 ปรับแต่งจำนวนโต๊ะประจำวันที่ {currentDate}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-[#111111] p-3 rounded-xl border border-white/[0.08]">
              <label className="block text-xs text-amber-400 font-bold mb-2">โซน A (แนวตั้ง x แถว)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={currentConfig.aRows}
                  onChange={(e) => updateCurrentConfig((prev) => ({ ...prev, aRows: e.target.value }))}
                  className="w-14 bg-[#18181b] border border-white/[0.08] rounded-xl px-1 py-1 text-center text-white text-sm focus:outline-none focus:border-yellow-400"
                />
                <span className="text-xs text-zinc-400">แถว</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={currentConfig.aCols}
                  onChange={(e) => updateCurrentConfig((prev) => ({ ...prev, aCols: e.target.value }))}
                  className="w-14 bg-[#18181b] border border-white/[0.08] rounded-xl px-1 py-1 text-center text-white text-sm focus:outline-none focus:border-yellow-400"
                />
                <span className="text-xs text-zinc-400">หลัก</span>
              </div>
            </div>

            <div className="bg-[#111111] p-3 rounded-xl border border-white/[0.08]">
              <label className="block text-xs text-rose-400 font-bold mb-2">โซน B (บน/ล่าง)</label>
              <div className="flex items-center justify-between gap-1">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-zinc-400">บน(≤10)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentConfig.bTopCount}
                    onChange={(e) => updateCurrentConfig((prev) => ({ ...prev, bTopCount: e.target.value }))}
                    className="w-12 bg-[#18181b] border border-white/[0.08] rounded-xl px-1 py-1 text-center text-white text-sm focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-zinc-400">ล่าง(≤5)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentConfig.bBottomCount}
                    onChange={(e) => updateCurrentConfig((prev) => ({ ...prev, bBottomCount: e.target.value }))}
                    className="w-12 bg-[#18181b] border border-white/[0.08] rounded-xl px-1 py-1 text-center text-white text-sm focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#111111] p-3 rounded-xl border border-white/[0.08]">
              <label className="block text-xs text-amber-300 font-bold mb-2">โซน S (ชั้น 2)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={currentConfig.sCount}
                onChange={(e) => updateCurrentConfig((prev) => ({ ...prev, sCount: e.target.value }))}
                className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-2 py-1 text-center text-white text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>

            <div className="bg-[#111111] p-3 rounded-xl border border-white/[0.08]">
              <label className="block text-xs text-purple-400 font-bold mb-2">โซน 120-122 (≤ 3)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={currentConfig.specialCount}
                onChange={(e) => updateCurrentConfig((prev) => ({ ...prev, specialCount: e.target.value }))}
                className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-2 py-1 text-center text-white text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>

            <div className="bg-[#111111] p-3 rounded-xl border border-white/[0.08] opacity-80">
              <label className="block text-xs text-teal-400 font-bold mb-2">โซน VIP (ล็อกแล้ว)</label>
              <input
                type="text"
                disabled
                value="7 โต๊ะ"
                className="w-full bg-[#111111]/50 border border-white/[0.08] rounded-xl px-2 py-1 text-center text-zinc-400 text-sm cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-yellow-400 mb-3">💵 ปรับราคาโต๊ะแต่ละโซน</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {Object.entries(prices).map(([key, zone]) => (
              <div key={key} className="bg-[#18181b] p-3 rounded-xl border border-white/[0.08] flex flex-col justify-between">
                <span className="text-xs font-bold text-zinc-300 mb-1">{zone.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-zinc-400">฿</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={zone.price}
                    onChange={(e) =>
                      setPrices((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], price: e.target.value },
                      }))
                    }
                    className="w-full bg-[#111111] border border-white/[0.08] rounded-xl px-2 py-1 text-white text-sm font-bold focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {tempImageSrc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-white/[0.08] flex justify-between items-center">
              <h3 className="font-bold text-white text-base">✂️ ครอบตัดรูปภาพโปสเตอร์ประจำวัน</h3>
              <button onClick={() => setTempImageSrc(null)} className="text-zinc-400 hover:text-white text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="relative w-full h-80 bg-black">
              <Cropper
                image={tempImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
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

      {editingTableId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-amber-400 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-amber-400 mb-2">✏️ แก้ไขชื่อ/เลขโต๊ะ ({editingTableId})</h3>
            <form onSubmit={handleSaveSingleTableName} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ชื่อโต๊ะที่ต้องการให้แสดง</label>
                <input
                  type="text"
                  autoFocus
                  value={newTableNameInput}
                  onChange={(e) => setNewTableNameInput(e.target.value)}
                  className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTableId(null)}
                  className="px-4 py-2 bg-[#18181b] text-zinc-300 rounded-xl text-xs font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-black rounded-xl text-xs font-bold"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {saveSuccessModal?.show && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-emerald-500/60 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-center">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-3 border border-emerald-500/40">
              ✓
            </div>

            <h3 className="text-xl font-bold text-white mb-1">บันทึกข้อมูลสำเร็จ!</h3>
            <p className="text-xs text-zinc-400 mb-4">อัปเดตข้อมูลลงระบบ Supabase เรียบร้อยแล้ว</p>

            <div className="bg-[#18181b] border border-white/[0.08] rounded-xl p-4 text-left text-xs space-y-2 mb-6">
              <div className="flex justify-between border-b border-white/[0.08] pb-2">
                <span className="text-zinc-400">📅 ประจำวันที่:</span>
                <span className="font-bold text-yellow-400">{saveSuccessModal.date}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.08] pb-2">
                <span className="text-zinc-400">🎤 ชื่อวง/รายการ:</span>
                <span className="font-bold text-cyan-400">{saveSuccessModal.artistName}</span>
              </div>
              <div>
                <span className="text-zinc-400 block mb-1">💵 อัตราราคาแต่ละโซน:</span>
                <div className="grid grid-cols-2 gap-1.5 pl-2 font-mono text-[11px]">
                  {Object.entries(saveSuccessModal.prices).map(([k, v]) => (
                    <div key={k} className="text-zinc-300">
                      • {k}: <span className="text-emerald-400 font-bold">฿{Number(v.price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSaveSuccessModal(null)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg transition-all"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {viewTableDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div
            className={`bg-[#111111] border rounded-2xl p-6 w-full max-w-md shadow-2xl relative ${
              viewTableDetail.info.status === "pending"
                ? "border-amber-400"
                : viewTableDetail.info.checkedIn
                ? "border-violet-500"
                : "border-red-500"
            }`}
          >
            <div className="flex justify-between items-center mb-4 border-b border-white/[0.08] pb-2">
              <h3 className="text-lg font-bold text-white">
                📌 รายละเอียดการจอง: โต๊ะ {currentConfig.customNames[viewTableDetail.id] || viewTableDetail.id}
              </h3>
              {viewTableDetail.info.status === "pending" ? (
                <span className="bg-amber-400/20 text-amber-400 border border-amber-400/40 text-[10px] font-bold px-2.5 py-1 rounded-full animate-pulse">
                  ⏳ รอตรวจสลิป
                </span>
              ) : viewTableDetail.info.checkedIn ? (
                <span className="bg-violet-500/20 text-violet-300 border border-violet-400/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  🙋 มารับโต๊ะแล้ว
                </span>
              ) : (
                <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  ✓ ยืนยันแล้ว
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 text-sm text-zinc-200 mb-6">
              <div>
                <span className="text-zinc-400">ชื่อลูกค้า:</span>{" "}
                <strong className="text-white">{viewTableDetail.info.customerName}</strong>
              </div>
              <div>
                <span className="text-zinc-400">เบอร์โทรศัพท์:</span>{" "}
                <strong className="text-yellow-400">{viewTableDetail.info.phone}</strong>
              </div>
              {viewTableDetail.info.lineId && (
                <div>
                  <span className="text-zinc-400">LINE ID:</span>{" "}
                  <strong className="text-cyan-400">{viewTableDetail.info.lineId}</strong>
                </div>
              )}
              {typeof viewTableDetail.info.totalPaid === "number" && (
                <div>
                  <span className="text-zinc-400">ยอดชำระ:</span>{" "}
                  <strong className="text-emerald-400">฿{viewTableDetail.info.totalPaid.toLocaleString()}</strong>
                </div>
              )}
              <div>
                <span className="text-zinc-400">เวลาที่ทำรายการ:</span>{" "}
                <span className="text-xs text-zinc-400">{viewTableDetail.info.timestamp}</span>
              </div>
              {viewTableDetail.info.checkedIn && viewTableDetail.info.checkedInAt && (
                <div>
                  <span className="text-zinc-400">เวลารับโต๊ะ:</span>{" "}
                  <span className="text-xs text-violet-300 font-bold">{viewTableDetail.info.checkedInAt}</span>
                </div>
              )}

              {viewTableDetail.info.slipImage ? (
                <div className="mt-2">
                  <span className="text-zinc-400 text-xs block mb-1.5 font-bold text-yellow-400">
                    สลิปการโอนเงิน (คลิกเพื่อดูรูปเต็ม):
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewSlipImage(viewTableDetail.info.slipImage!)}
                    className="block w-full rounded-xl overflow-hidden border border-white/[0.08] hover:border-yellow-400 transition-all shadow-md group relative"
                  >
                    <img
                      src={viewTableDetail.info.slipImage}
                      alt="สลิปการโอนเงิน"
                      className="w-full max-h-56 object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-bold text-white bg-black/70 px-3 py-1 rounded-xl">🔍 ขยายสลิป</span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="mt-2 text-xs text-zinc-500 italic">ไม่มีสลิปการโอนเงินแนบมา</div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() =>
                  setEditCustomerModal({
                    id: viewTableDetail.id,
                    name: viewTableDetail.info.customerName,
                    phone: viewTableDetail.info.phone,
                    lineId: viewTableDetail.info.lineId || "",
                  })
                }
                className="w-full py-2.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/50 rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-1 transition-all"
              >
                ✏️ แก้ไขข้อมูลลูกค้า
              </button>

              {viewTableDetail.info.status === "pending" && (
                <button
                  type="button"
                  onClick={() => handleApproveBooking(viewTableDetail.id)}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-1 transition-all"
                >
                  ✅ ตรวจสอบสลิปถูกต้อง - อนุมัติการจอง (เปลี่ยนเป็นสีแดง)
                </button>
              )}

              {viewTableDetail.info.status === "confirmed" && (
                <button
                  type="button"
                  onClick={() => handleToggleCheckedIn(viewTableDetail.id)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-1 transition-all ${
                    viewTableDetail.info.checkedIn
                      ? "bg-zinc-800 hover:bg-zinc-700 text-violet-300 border border-violet-500/50"
                      : "bg-violet-600 hover:bg-violet-500 text-white"
                  }`}
                >
                  {viewTableDetail.info.checkedIn ? "↩️ ยกเลิกสถานะรับโต๊ะ" : "🙋 ลูกค้ามารับโต๊ะแล้ว (เปลี่ยนเป็นสีม่วง)"}
                </button>
              )}

              <div className="flex justify-between items-center mt-1">
                <button
                  type="button"
                  onClick={() => handleCancelBooking(viewTableDetail.id)}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/50 rounded-xl text-xs font-bold transition-all"
                >
                  🗑️ ยกเลิกการจองโต๊ะนี้
                </button>

                <button
                  type="button"
                  onClick={() => setViewTableDetail(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editCustomerModal && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-cyan-500/60 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <h3 className="text-lg font-bold text-cyan-300 mb-4 border-b border-white/[0.08] pb-2">
              ✏️ แก้ไขข้อมูลลูกค้า
            </h3>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ชื่อผู้จอง / ลูกค้า *</label>
                <input
                  type="text"
                  autoFocus
                  value={editCustomerModal.name}
                  onChange={(e) => setEditCustomerModal({ ...editCustomerModal, name: e.target.value })}
                  className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">เบอร์โทรศัพท์ (ถ้ามี)</label>
                <input
                  type="tel"
                  placeholder="08xxxxxxxx"
                  value={editCustomerModal.phone}
                  onChange={(e) => setEditCustomerModal({ ...editCustomerModal, phone: e.target.value })}
                  className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">LINE ID</label>
                <input
                  type="text"
                  placeholder="ระบุ LINE ID (ถ้ามี)"
                  value={editCustomerModal.lineId}
                  onChange={(e) => setEditCustomerModal({ ...editCustomerModal, lineId: e.target.value })}
                  className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setEditCustomerModal(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveCustomerEdit}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

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

      {viewSlipImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewSlipImage(null)}>
          <button
            onClick={() => setViewSlipImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold bg-[#18181b] w-10 h-10 rounded-full border border-white/[0.08] flex items-center justify-center"
          >
            ✕
          </button>
          <img
            src={viewSlipImage}
            alt="สลิปการโอนเงิน (เต็มจอ)"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-white/[0.08]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold bg-[#18181b] w-10 h-10 rounded-full border border-white/[0.08] flex items-center justify-center"
          >
            ✕
          </button>
          <p className="text-white text-xs font-bold bg-black/70 px-4 py-2 rounded-xl mb-3 text-center">
            📌 กดค้างที่รูปด้านล่าง แล้วเลือก &quot;บันทึกลงในรูปภาพ&quot; เพื่อดาวน์โหลด
          </p>
          <img
            src={previewImage}
            alt="ผังโต๊ะสำหรับดาวน์โหลด"
            className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/[0.08]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function AdminTableManager() {
  return (
    <Suspense fallback={<div className="text-zinc-400 text-sm">กำลังโหลดผังโต๊ะ...</div>}>
      <AdminTableManagerContent />
    </Suspense>
  );
}