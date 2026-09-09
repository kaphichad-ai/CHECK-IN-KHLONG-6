'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ZonePrice {
  name: string;
  price: number;
  color: string;
}

interface BookingInfo {
  customerName: string;
  phone: string;
  lineId: string;
  slipImage: string;
  timestamp: string;
  totalPaid: number;
  status?: 'pending' | 'confirmed';
}

interface DailyConfig {
  aRows: number;
  aCols: number;
  bTopCount: number;
  bBottomCount: number;
  sCount: number;
  specialCount: number;
  vipSideCount?: number;
  vipEntranceCount?: number;
  eventImage?: string;
  artistName?: string;
  customNames: Record<string, string>;
  bookings: Record<string, BookingInfo>;
}

const DEFAULT_CONFIG: DailyConfig = {
  aRows: 12,
  aCols: 6,
  bTopCount: 10,
  bBottomCount: 0,
  sCount: 0,
  specialCount: 2,
  vipSideCount: 4,
  vipEntranceCount: 3,
  artistName: 'วงดนตรีสดประจำวัน',
  eventImage: '',
  customNames: {},
  bookings: {},
};

const DEFAULT_PRICES: Record<string, ZonePrice> = {
  VIP: { name: 'VIP ZONE', price: 0, color: 'bg-teal-700' },
  A: { name: 'A ZONE', price: 0, color: 'bg-amber-800' },
  B: { name: 'B ZONE', price: 0, color: 'bg-rose-800' },
  S: { name: 'S ZONE (ชั้น 2)', price: 0, color: 'bg-amber-700' },
  SPECIAL: { name: 'โซนพิเศษ (120-122)', price: 0, color: 'bg-purple-800' },
};

const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const crc16 = (payload: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

const formatEmvField = (id: string, value: string) =>
  `${id}${value.length.toString().padStart(2, '0')}${value}`;

const generatePromptPayPayload = (promptPayId: string, amount?: number): string => {
  const digitsOnly = promptPayId.replace(/[^0-9]/g, '');
  let target = digitsOnly;

  if (digitsOnly.length === 10) {
    target = '0066' + digitsOnly.substring(1);
  }

  const targetTag = digitsOnly.length === 13 ? '02' : '01';

  const merchantInfo =
    formatEmvField('00', 'A000000677010111') + formatEmvField(targetTag, target);

  let payload =
    formatEmvField('00', '01') +
    formatEmvField('01', amount ? '12' : '11') +
    formatEmvField('29', merchantInfo) +
    formatEmvField('53', '764');

  if (amount && amount > 0) {
    payload += formatEmvField('54', amount.toFixed(2));
  }

  payload += formatEmvField('58', 'TH');
  payload += '6304';

  return payload + crc16(payload);
};

function BookingContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const queryDate = searchParams.get('date');

  const today = new Date();
  const todayStr = getLocalDateString(today);

  const [currentDate, setCurrentDate] = useState<string>(queryDate || todayStr);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (queryDate) {
      setCurrentDate(queryDate);
    }
  }, [queryDate]);

  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      dateStr: getLocalDateString(d),
      dayName: d.toLocaleDateString('th-TH', { weekday: 'short' }),
      dateDisplay: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
    };
  });

  const [activeZoneTab, setActiveZoneTab] = useState<'ALL' | 'STAGE' | 'ZONE_B' | 'ZONE_S'>('ALL');
  const [prices, setPrices] = useState<Record<string, ZonePrice>>(DEFAULT_PRICES);
  const [currentConfig, setCurrentConfig] = useState<DailyConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const fetchDailyData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('daily_configs')
          .select('*')
          .eq('date', currentDate)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching data from Supabase:', error);
        }

        if (data) {
          setCurrentConfig({ ...DEFAULT_CONFIG, ...data.config });
          setPrices(data.prices || DEFAULT_PRICES);
        } else {
          setCurrentConfig(DEFAULT_CONFIG);
          setPrices(DEFAULT_PRICES);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyData();
  }, [currentDate, supabase]);

  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');

  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [slipFileName, setSlipFileName] = useState<string>('');

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [alertModal, setAlertModal] = useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showAlert = (message: string, variant: 'success' | 'error' | 'info' = 'info') => {
    setAlertModal({ message, variant });
  };

  const handleBackToMain = () => {
    if (selectedTables.length > 0) {
      setConfirmModal({
        message: 'คุณมีรายการโต๊ะที่เลือกไว้ หากย้อนกลับข้อมูลจะไม่ถูกบันทึก ต้องการย้อนกลับหรือไม่?',
        onConfirm: () => window.history.back(),
      });
    } else {
      window.history.back();
    }
  };

  const handleDateChange = (newDate: string) => {
    setCurrentDate(newDate);
    setSelectedTables([]);
  };

  const getZoneKeyFromId = (id: string) => {
    if (id.startsWith('VIP')) return 'VIP';
    if (id.startsWith('B')) return 'B';
    if (id.startsWith('S')) return 'S';
    if (['120', '121', '122'].includes(id)) return 'SPECIAL';
    return 'A';
  };

  const getTablePrice = (id: string) => {
    const zoneKey = getZoneKeyFromId(id);
    return prices[zoneKey]?.price || 0;
  };

  const totalPrice = selectedTables.reduce((sum, id) => sum + getTablePrice(id), 0);

  const handleTableClick = (id: string) => {
    if (currentConfig.bookings[id]) return;
    setSelectedTables((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenCheckout = () => {
    if (selectedTables.length === 0) return;
    setShowCheckoutModal(true);
  };

  const handleOpenPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phone || !lineId) return;

    if (totalPrice === 0) {
      setShowCheckoutModal(false);
      handleConfirmBookingFree();
    } else {
      setShowCheckoutModal(false);
      setShowPaymentModal(true);
    }
  };

  const handleBackToCheckout = () => {
    setShowPaymentModal(false);
    setShowCheckoutModal(true);
  };

  const handleSlipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      showAlert('ไฟล์สลิปมีขนาดใหญ่เกินไป กรุณาเลือกไฟล์ที่ไม่เกิน 4MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSlipImage(reader.result as string);
      setSlipFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSlip = () => {
    setSlipImage(null);
    setSlipFileName('');
  };

  const executeBooking = async (isFreeBooking: boolean) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { data: latestData, error: fetchError } = await supabase
        .from('daily_configs')
        .select('*')
        .eq('date', currentDate)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error re-checking data:', fetchError);
        showAlert('เกิดข้อผิดพลาดในการตรวจสอบโต๊ะ กรุณาลองใหม่อีกครั้ง', 'error');
        return;
      }

      const latestConfig: DailyConfig = latestData?.config || DEFAULT_CONFIG;

      const alreadyBooked = selectedTables.filter((id) => latestConfig.bookings[id]);
      if (alreadyBooked.length > 0) {
        showAlert(
          `ขออภัย โต๊ะ ${alreadyBooked.join(', ')} เพิ่งถูกจองไปโดยลูกค้าท่านอื่น กรุณาเลือกโต๊ะใหม่อีกครั้ง`,
          'error'
        );
        setCurrentConfig(latestConfig);
        setSelectedTables((prev) => prev.filter((id) => !alreadyBooked.includes(id)));
        setShowPaymentModal(false);
        setShowCheckoutModal(false);
        return;
      }

      const timestamp = new Date().toLocaleString('th-TH');
      const bookingStatus = isFreeBooking ? 'confirmed' : 'pending';

      const newBookings: Record<string, BookingInfo> = {
        ...latestConfig.bookings,
        ...selectedTables.reduce((acc, tableId) => {
          acc[tableId] = { 
            customerName, 
            phone, 
            lineId, 
            slipImage: isFreeBooking ? '' : (slipImage || ''), 
            timestamp, 
            totalPaid: totalPrice,
            status: bookingStatus
          };
          return acc;
        }, {} as Record<string, BookingInfo>),
      };

      const newConfig: DailyConfig = { ...latestConfig, bookings: newBookings };

      const { error: upsertError } = await supabase.from('daily_configs').upsert({
        date: currentDate,
        config: newConfig,
        prices: prices,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        console.error('Supabase Upsert Error:', upsertError);
        showAlert('เกิดข้อผิดพลาดในการบันทึกการจอง กรุณาลองใหม่อีกครั้ง', 'error');
        return;
      }

      setCurrentConfig(newConfig);
      setShowPaymentModal(false);

      if (isFreeBooking) {
        showAlert(
          `ยืนยันการจองเรียบร้อยแล้ว!\nขอบคุณที่ใช้บริการครับ LINE ID: ${lineId}`,
          'success'
        );
      } else {
        showAlert(
          `ระบบได้รับข้อมูลการจองเรียบร้อยแล้ว!\nทางร้านจะตรวจสอบยอดชำระเงินและติดต่อกลับทาง LINE ID: ${lineId}`,
          'success'
        );
      }

      setSelectedTables([]);
      setCustomerName('');
      setPhone('');
      setLineId('');
      setSlipImage(null);
      setSlipFileName('');
    } catch (err) {
      console.error(err);
      showAlert('ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmBookingFree = async () => {
    await executeBooking(true);
  };

  const handleConfirmPayment = async () => {
    if (!slipImage) {
      showAlert('กรุณาแนบสลิปการโอนเงินก่อนยืนยันการชำระเงิน', 'error');
      return;
    }
    await executeBooking(false);
  };

  const promptPayId = process.env.NEXT_PUBLIC_PROMPTPAY_ID || '';
  const promptPayPayload = promptPayId && totalPrice > 0
    ? generatePromptPayPayload(promptPayId, totalPrice)
    : '';
  const qrCodeUrl = promptPayPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(promptPayPayload)}`
    : '';

  const renderCircleTable = (id: string, defaultZoneKey: string, extraClass = '') => {
    const isSelected = selectedTables.includes(id);
    const booking = currentConfig.bookings[id];

    const isBooked = Boolean(booking);
    const isPending = booking?.status === 'pending';
    const isConfirmed = booking?.status === 'confirmed';

    const zoneKey = getZoneKeyFromId(id);
    const zone = prices[zoneKey] || prices[defaultZoneKey];
    const displayLabel = currentConfig.customNames[id] || id;

    let bgClass = 'bg-emerald-600 ring-1 ring-emerald-300/40';

    if (isPending) {
      bgClass = 'bg-amber-500 ring-2 ring-amber-300 text-black font-extrabold cursor-not-allowed opacity-90 animate-pulse';
    } else if (isConfirmed || isBooked) {
      bgClass = 'bg-red-700/90 ring-1 ring-red-500 cursor-not-allowed opacity-80';
    } else if (isSelected) {
      bgClass = 'bg-sky-500 ring-4 ring-white scale-110 font-bold shadow-lg z-10';
    }

    return (
      <button
        key={id}
        disabled={isBooked}
        onClick={() => handleTableClick(id)}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[11px] text-white transition-all shadow-md active:scale-95 touch-manipulation relative ${bgClass} ${extraClass}`}
        title={
          isPending
            ? `โต๊ะ ${displayLabel} (กำลังรอแอดมินตรวจสอบสลิป)`
            : isBooked
            ? `โต๊ะ ${displayLabel} (ถูกจองแล้ว)`
            : `โต๊ะ: ${displayLabel} - ราคา ฿${zone?.price?.toLocaleString()}`
        }
      >
        {isPending ? (
          <div className="flex flex-col items-center justify-center leading-none">
            <span className="text-[9px] font-bold text-black">{displayLabel}</span>
            <span className="text-[8px]">⏳</span>
          </div>
        ) : isBooked ? (
          <div className="flex flex-col items-center justify-center leading-none">
            <span className="text-[9px] font-bold text-white/90 line-through decoration-red-300">{displayLabel}</span>
            <span className="text-[8px]">❌</span>
          </div>
        ) : (
          displayLabel
        )}
      </button>
    );
  };

  const vipSideCount = currentConfig.vipSideCount ?? 4;
  const vipEntranceCount = currentConfig.vipEntranceCount ?? 3;

  return (
    <div className="min-h-screen bg-[#141211] text-white p-3 md:p-8 pb-32 flex flex-col items-center font-sans antialiased">
      
      {/* Header */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToMain}
            className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-gray-300 text-xs px-3 py-2 rounded-xl border border-neutral-700 transition-all"
          >
            <span>←</span>
            <span className="hidden sm:inline">ย้อนกลับ</span>
          </button>

          <div>
            <h1 className="text-lg md:text-3xl font-bold tracking-wider font-serif italic">
              Check in <span className="text-cyan-400 font-sans not-italic text-xs md:text-sm">KHLONG 6</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-2">
              ระบบจองโต๊ะและเลือกที่นั่งออนไลน์
              {isLoading && <span className="text-yellow-400 animate-pulse">กำลังโหลดข้อมูล...</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Date Selector */}
      <div className="w-full max-w-5xl mb-4 bg-neutral-900 border border-neutral-800 p-2.5 rounded-2xl shadow-lg">
        <div className="text-xs text-gray-400 mb-2 flex items-center justify-between font-bold">
          <span className="flex items-center gap-1">📅 เลือกวันที่ต้องการจอง:</span>
          <input
            type="date"
            value={currentDate}
            min={todayStr}
            onChange={(e) => handleDateChange(e.target.value)}
            className="bg-neutral-800 text-yellow-400 text-xs px-2 py-1 rounded-lg border border-neutral-700 outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
          {availableDates.map((item) => {
            const isActive = currentDate === item.dateStr;
            return (
              <button
                key={item.dateStr}
                onClick={() => handleDateChange(item.dateStr)}
                className={`flex-shrink-0 min-w-[75px] py-2 px-2.5 rounded-xl flex flex-col items-center justify-center transition-all border ${
                  isActive
                    ? 'bg-yellow-500 text-black border-yellow-400 font-bold shadow-md scale-105'
                    : 'bg-neutral-800/80 text-gray-300 border-neutral-700 hover:bg-neutral-700'
                }`}
              >
                <span className="text-[9px] uppercase opacity-80">{item.dayName}</span>
                <span className="text-xs">{item.dateDisplay}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Event Banner */}
      <div className="w-full max-w-5xl mb-4 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg relative">
        {currentConfig.eventImage ? (
          <div className="relative">
            <img
              src={currentConfig.eventImage}
              alt={currentConfig.artistName || 'ภาพกิจกรรม'}
              className="w-full h-36 md:h-60 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col justify-end p-4">
              <span className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-widest uppercase">
                EVENT: {new Date(currentDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <h2 className="text-2xl md:text-4xl font-extrabold text-white">
                {currentConfig.artistName || 'ศิลปินประจำวัน'}
              </h2>
            </div>
          </div>
        ) : (
          <div className="w-full h-28 bg-neutral-800 flex flex-col items-center justify-center text-gray-400 gap-1 p-3">
            <span className="text-xs text-yellow-400">
              {new Date(currentDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <p className="text-sm font-bold text-white">🎤 {currentConfig.artistName || 'วงดนตรีสดประจำวัน'}</p>
          </div>
        )}
      </div>

      {/* Zone Price Legend */}
      <div className="w-full max-w-5xl bg-neutral-900/90 border border-neutral-800 p-3 rounded-xl mb-3 shadow-md">
        <div className="text-xs font-bold text-gray-400 mb-2">🏷️ ราคาโต๊ะแต่ละโซน:</div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {Object.entries(prices).map(([key, zone]) => (
            <div key={key} className="flex items-center gap-1.5 bg-neutral-800 px-2 py-1 rounded-lg border border-neutral-700">
              <span className="text-gray-300">{zone.name}:</span>
              <span className="text-yellow-400 font-bold">
                {zone.price === 0 ? 'FREE' : `฿${zone.price.toLocaleString()}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Table Status Legend */}
      <div className="w-full max-w-5xl bg-neutral-900/90 border border-neutral-800 p-3 rounded-xl mb-4 shadow-md">
        <div className="text-xs font-bold text-gray-400 mb-2">🪑 สถานะโต๊ะ:</div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 bg-neutral-800 px-2 py-1 rounded-lg border border-neutral-700">
            <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
            <span className="text-emerald-400 font-bold">ว่าง (แตะเพื่อเลือก)</span>
          </div>
          <div className="flex items-center gap-1.5 bg-neutral-800 px-2 py-1 rounded-lg border border-neutral-700">
            <span className="w-3 h-3 rounded-full bg-sky-500"></span>
            <span className="text-sky-400 font-bold">กำลังเลือก</span>
          </div>
          <div className="flex items-center gap-1.5 bg-neutral-800 px-2 py-1 rounded-lg border border-neutral-700">
            <span className="w-3 h-3 rounded-full bg-amber-500 flex items-center justify-center text-[7px] text-black font-bold">⏳</span>
            <span className="text-amber-400 font-bold">รอตรวจสลิป</span>
          </div>
          <div className="flex items-center gap-1.5 bg-neutral-800 px-2 py-1 rounded-lg border border-neutral-700">
            <span className="w-3 h-3 rounded-full bg-red-600 flex items-center justify-center text-[7px]">❌</span>
            <span className="text-red-400 font-bold">จองแล้ว</span>
          </div>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-bold">🗺️ ผังที่นั่ง (เลื่อนซ้าย-ขวาได้):</span>
        <div className="flex gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-[10px] md:hidden">
          <button
            onClick={() => setActiveZoneTab('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold ${activeZoneTab === 'ALL' ? 'bg-yellow-500 text-black' : 'text-gray-400'}`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setActiveZoneTab('STAGE')}
            className={`px-2.5 py-1 rounded-lg font-bold ${activeZoneTab === 'STAGE' ? 'bg-yellow-500 text-black' : 'text-gray-400'}`}
          >
            หน้าเวที
          </button>
          <button
            onClick={() => setActiveZoneTab('ZONE_B')}
            className={`px-2.5 py-1 rounded-lg font-bold ${activeZoneTab === 'ZONE_B' ? 'bg-yellow-500 text-black' : 'text-gray-400'}`}
          >
            Zone B
          </button>
          <button
            onClick={() => setActiveZoneTab('ZONE_S')}
            className={`px-2.5 py-1 rounded-lg font-bold ${activeZoneTab === 'ZONE_S' ? 'bg-yellow-500 text-black' : 'text-gray-400'}`}
          >
            ชั้น 2
          </button>
        </div>
      </div>

      {/* MAP CONTAINER */}
      <div className="w-full max-w-5xl bg-[#ded5c6] text-black p-4 sm:p-6 rounded-3xl shadow-2xl overflow-x-auto touch-pan-x mb-6">
        <div className="min-w-[850px] grid grid-cols-12 gap-4 relative">
          
          {/* ฝั่งซ้าย: Stage + Special + VIP + Zone A */}
          <div className={`col-span-7 border-r border-gray-400/80 pr-4 flex flex-col justify-between ${activeZoneTab !== 'ALL' && activeZoneTab !== 'STAGE' ? 'hidden md:flex' : 'flex'}`}>
            
            {/* เวที (Stage) */}
            <div className="w-full bg-[#6a778e] text-white font-extrabold text-center py-3 rounded-2xl text-lg tracking-widest uppercase shadow-md mb-4">
              stage
            </div>

            <div className="flex gap-3 items-start">
              {/* Special & VIP Side Zone */}
              <div className="flex flex-col gap-4">
                {/* Special Zone */}
                {currentConfig.specialCount > 0 && (
                  <div className="flex flex-col gap-2 items-center">
                    {['120', '121', '122'].slice(0, currentConfig.specialCount).map((id) => renderCircleTable(id, 'SPECIAL'))}
                  </div>
                )}

                {/* VIP 1 - VIP 4 */}
                {vipSideCount > 0 && (
                  <div className="border-2 border-teal-900/60 p-2 rounded-2xl flex flex-col gap-3 bg-[#c3b6a0] items-center">
                    {Array.from({ length: vipSideCount }).map((_, i) =>
                      renderCircleTable(`VIP ${i + 1}`, 'VIP', 'w-12 h-12 text-[11px] font-bold rounded-2xl')
                    )}
                  </div>
                )}
              </div>

              {/* Dynamic Grid โซน A */}
              {currentConfig.aRows > 0 && currentConfig.aCols > 0 && (
                <div className="flex-1">
                  <div
                    className="grid gap-2 justify-items-center"
                    style={{
                      gridTemplateColumns: `repeat(${currentConfig.aCols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${currentConfig.aRows}, minmax(0, 1fr))`,
                      gridAutoFlow: 'column',
                    }}
                  >
                    {Array.from({ length: currentConfig.aCols }).map((_, colIndex) =>
                      Array.from({ length: currentConfig.aRows }).map((_, rowIndex) => {
                        const tableNumber = colIndex * currentConfig.aRows + rowIndex + 1;
                        return renderCircleTable(`A${tableNumber}`, 'A');
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* แถวล่าง: Entrance + VIP 5-7 + ชั้น 1 */}
            <div className="border-2 border-neutral-800 p-2.5 rounded-2xl flex items-center justify-between gap-2 mt-4 bg-[#c8bca9]">
              <div className="bg-black text-white text-[11px] font-bold px-3 py-2 rounded-xl text-center leading-tight">
                Entrance<br />Exit
              </div>

              {/* VIP 5 - VIP 7 */}
              {vipEntranceCount > 0 && (
                <div className="flex gap-2">
                  {Array.from({ length: vipEntranceCount }).map((_, i) =>
                    renderCircleTable(
                      `VIP ${i + vipSideCount + 1}`,
                      'VIP',
                      'w-14 h-9 text-xs rounded-xl font-bold'
                    )
                  )}
                </div>
              )}

              <div className="font-extrabold text-base text-neutral-800 pr-2">ชั้น 1</div>
            </div>
          </div>

          {/* ฝั่งขวา: Zone B & Zone S */}
          <div className={`col-span-5 flex gap-4 pl-1 ${activeZoneTab === 'STAGE' ? 'hidden md:flex' : 'flex'}`}>
            
            {/* Zone B */}
            <div className={`flex-1 flex flex-col justify-between items-center ${activeZoneTab === 'ZONE_S' ? 'hidden md:flex' : 'flex'}`}>
              
              {/* Zone B บน */}
              {currentConfig.bTopCount > 0 ? (
                <div className="border border-neutral-700/60 p-2.5 rounded-2xl grid grid-cols-2 gap-2 bg-[#cbbda9] w-full justify-items-center">
                  {Array.from({ length: Math.ceil(currentConfig.bTopCount / 2) }).map((_, rowIndex) => (
                    <React.Fragment key={rowIndex}>
                      {renderCircleTable(`B${rowIndex + 1}`, 'B')}
                      {rowIndex + Math.ceil(currentConfig.bTopCount / 2) < currentConfig.bTopCount &&
                        renderCircleTable(`B${rowIndex + Math.ceil(currentConfig.bTopCount / 2) + 1}`, 'B')}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="border border-red-300 bg-red-100/50 p-4 rounded-2xl w-full text-center text-xs text-red-600 font-bold">
                  🚫 ปิดบริการโซน B บน
                </div>
              )}

              {/* ห้องน้ำ และ BAR */}
              <div className="my-3 flex flex-col items-center gap-1.5">
                <div className="w-7 h-7 border border-neutral-800 rounded-full flex items-center justify-center text-xs bg-white shadow-sm">🚺</div>
                <div className="bg-black text-white px-3 py-4 font-bold tracking-widest text-xs rounded-lg shadow-md">BAR</div>
                <div className="w-7 h-7 border border-neutral-800 rounded-full flex items-center justify-center text-xs bg-white shadow-sm">🚹</div>
              </div>

              {/* Zone B ล่าง */}
              {currentConfig.bBottomCount > 0 ? (
                <div className="border border-neutral-700/60 p-2.5 rounded-2xl grid grid-cols-2 gap-2 bg-[#cbbda9] w-full justify-items-center">
                  {Array.from({ length: Math.ceil(currentConfig.bBottomCount / 2) }).map((_, rowIndex) => (
                    <React.Fragment key={rowIndex}>
                      {renderCircleTable(`B${rowIndex + 11}`, 'B')}
                      {rowIndex + Math.ceil(currentConfig.bBottomCount / 2) < currentConfig.bBottomCount &&
                        renderCircleTable(`B${rowIndex + Math.ceil(currentConfig.bBottomCount / 2) + 11}`, 'B')}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="w-full bg-red-100/60 border border-red-300 py-2 px-3 rounded-2xl text-center text-[11px] text-red-600 font-bold">
                  ปิดโซน B ล่าง
                </div>
              )}
            </div>

            {/* Zone S (ชั้น 2) */}
            <div className={`w-36 border-2 border-neutral-800 p-2.5 rounded-2xl flex flex-col justify-between bg-[#cbbda9] ${activeZoneTab === 'ZONE_B' ? 'hidden md:flex' : 'flex'}`}>
              
              {currentConfig.sCount > 0 ? (
                <div className="grid grid-cols-2 gap-2 justify-items-center max-h-[420px] overflow-y-auto">
                  {Array.from({ length: Math.ceil(currentConfig.sCount / 2) }).map((_, rowIndex) => {
                    const sHalf = Math.ceil(currentConfig.sCount / 2);
                    const firstColIndex = rowIndex + 1;
                    const secondColIndex = rowIndex + 1 + sHalf;

                    return (
                      <React.Fragment key={rowIndex}>
                        {firstColIndex <= currentConfig.sCount && renderCircleTable(`S${firstColIndex}`, 'S')}
                        {secondColIndex <= currentConfig.sCount && renderCircleTable(`S${secondColIndex}`, 'S')}
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-2 text-red-600 font-bold">
                  <span className="text-xl mb-1">🚫</span>
                  <span className="text-xs">ปิดบริการโซน S</span>
                  <span className="text-[10px] text-red-400 font-normal">(0 โต๊ะ)</span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-neutral-700 pt-2 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-pink-400 rounded-full border border-pink-500"></div>
                  <span className="text-[11px] font-extrabold text-neutral-800">บันได</span>
                </div>
                <span className="font-extrabold text-sm text-neutral-800">ชั้น 2</span>
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* COMPACT STICKY BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-neutral-900/95 border-t border-neutral-800 backdrop-blur-lg p-3 z-40 shadow-2xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400">
              {selectedTables.length > 0 ? `เลือกแล้ว ${selectedTables.length} โต๊ะ (${selectedTables.join(', ')})` : 'ยังไม่ได้เลือกโต๊ะ'}
            </span>
            <span className="text-lg md:text-2xl font-extrabold text-yellow-400">
              {totalPrice === 0 ? '฿0 (ฟรี)' : `฿${totalPrice.toLocaleString()}`}
            </span>
          </div>

          <button
            onClick={handleOpenCheckout}
            disabled={selectedTables.length === 0}
            className="bg-yellow-500 hover:bg-yellow-400 active:scale-95 disabled:bg-neutral-800 disabled:text-gray-500 text-black font-bold text-xs md:text-sm px-6 py-3 rounded-xl transition-all shadow-lg whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
          >
            {selectedTables.length > 0 ? 'กรอกข้อมูลจอง ➔' : 'เลือกโต๊ะบนผัง'}
          </button>
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-t-3xl sm:rounded-3xl p-5 max-w-md w-full relative shadow-2xl animate-in slide-in-from-bottom duration-200">
            <button
              onClick={() => setShowCheckoutModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <h3 className="text-base font-bold text-yellow-400 mb-4">📝 กรอกข้อมูลผู้จองโต๊ะ</h3>
            <div className="text-xs text-gray-300 mb-4 bg-neutral-800 p-3 rounded-xl border border-neutral-700">
              <div>โต๊ะที่เลือก: <span className="text-yellow-400 font-bold">{selectedTables.join(', ')}</span></div>
              <div>ยอดชำระรวม: <span className="text-yellow-400 font-bold">฿{totalPrice.toLocaleString()}</span></div>
            </div>

            <form onSubmit={handleOpenPayment} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">ชื่อ-นามสกุล *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ระบุชื่อของคุณ"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">เบอร์โทรศัพท์ *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812345678"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">LINE ID *</label>
                <input
                  type="text"
                  required
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  placeholder="Line ID ของคุณ"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-yellow-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  {totalPrice === 0 ? 'ยืนยันการจองฟรี' : 'ไปหน้าชำระเงิน ➔'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-t-3xl sm:rounded-3xl p-5 max-w-md w-full relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <h3 className="text-base font-bold text-yellow-400 mb-2">💳 สแกน QR Code เพื่อชำระเงิน</h3>
            <p className="text-[11px] text-gray-400 mb-4">
              โอนเงินจำนวน <span className="text-yellow-400 font-bold">฿{totalPrice.toLocaleString()}</span> ผ่าน PromptPay
            </p>

            {qrCodeUrl ? (
              <div className="flex flex-col items-center bg-white p-4 rounded-2xl mb-4 shadow-inner">
                <img src={qrCodeUrl} alt="PromptPay QR Code" className="w-48 h-48 object-contain" />
                <span className="text-[10px] text-gray-600 mt-2 font-mono">{promptPayId}</span>
              </div>
            ) : (
              <div className="bg-red-900/40 border border-red-700 text-red-300 p-3 rounded-xl text-xs text-center mb-4">
                ยังไม่ได้กำหนด PromptPay ID ในระบบ (NEXT_PUBLIC_PROMPTPAY_ID)
              </div>
            )}

            {/* Slip Upload */}
            <div className="space-y-3 mb-4">
              <label className="block text-xs font-bold text-gray-300">แนบสลิปหลักฐานการโอนเงิน *</label>
              {slipImage ? (
                <div className="relative bg-neutral-800 p-2 rounded-xl border border-neutral-700 flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <img src={slipImage} alt="Slip preview" className="w-10 h-10 object-cover rounded-lg" />
                    <span className="text-xs text-gray-300 truncate max-w-[180px]">{slipFileName || 'สลิปโอนเงิน'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveSlip}
                    className="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-950/50 rounded-lg"
                  >
                    ลบรูป
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-neutral-700 hover:border-yellow-500 bg-neutral-800/50 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all">
                  <span className="text-xs text-gray-300 font-bold mb-1">📁 คลิกเพื่ออัปโหลดสลิป</span>
                  <span className="text-[10px] text-gray-500">PNG, JPG (ขนาดไม่เกิน 4MB)</span>
                  <input type="file" accept="image/*" onChange={handleSlipSelect} className="hidden" />
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleBackToCheckout}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all"
              >
                ← ย้อนกลับ
              </button>
              <button
                type="button"
                disabled={isSubmitting || !slipImage}
                onClick={handleConfirmPayment}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:bg-neutral-800 disabled:text-gray-500 text-black py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการชำระเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERT MODAL */}
      {alertModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="text-3xl mb-3">
              {alertModal.variant === 'success' ? '✅' : alertModal.variant === 'error' ? '❌' : 'ℹ️'}
            </div>
            <p className="text-xs md:text-sm text-gray-200 whitespace-pre-line mb-5 font-medium leading-relaxed">
              {alertModal.message}
            </p>
            <button
              onClick={() => setAlertModal(null)}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-xs md:text-sm text-gray-200 mb-5 font-medium leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  const cb = confirmModal.onConfirm;
                  setConfirmModal(null);
                  cb();
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#141211] text-white flex items-center justify-center">กำลังโหลด...</div>}>
      <BookingContent />
    </Suspense>
  );
}