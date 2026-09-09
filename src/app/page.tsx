'use client';

import Link from 'next/link';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ==========================================
// INTERFACES
// ==========================================

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

interface MenuCategory {
  categoryKey: string;
  categoryLabel: string;
  images: string[];
}

type EventItem = {
  date: string;
  displayDate: string;
  title: string;
  image: string;
};

// ==========================================
// COMPONENTS
// ==========================================

function Carousel({ galleryImages }: { galleryImages: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!galleryImages || galleryImages.length === 0) return;
    const timer = setInterval(() => {
      setIndex((i) => (i === galleryImages.length - 1 ? 0 : i + 1));
    }, 4000);

    return () => clearInterval(timer);
  }, [galleryImages]);

  if (!galleryImages || galleryImages.length === 0) {
    return (
      <div className="relative w-full max-w-5xl mx-auto aspect-[16/9] sm:aspect-[21/9] rounded-3xl bg-black/10 animate-pulse flex items-center justify-center text-black/40 text-sm">
        กำลังโหลดแบนเนอร์...
      </div>
    );
  }

  const goPrev = () => setIndex((i) => (i === 0 ? galleryImages.length - 1 : i - 1));
  const goNext = () => setIndex((i) => (i === galleryImages.length - 1 ? 0 : i + 1));

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-3xl overflow-hidden shadow-2xl bg-black">
        {galleryImages.map((img, i) => (
          <div
            key={i}
            className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
              i === index ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img
              src={img}
              alt={`Banner ${i + 1}`}
              className="w-full h-full object-cover object-center"
            />
          </div>
        ))}

        <button
          onClick={goPrev}
          aria-label="ภาพก่อนหน้า"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/40 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/70 hover:scale-105 transition-all text-lg sm:text-xl"
        >
          ‹
        </button>
        <button
          onClick={goNext}
          aria-label="ภาพถัดไป"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/40 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/70 hover:scale-105 transition-all text-lg sm:text-xl"
        >
          ›
        </button>
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {galleryImages.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`ไปภาพที่ ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === index ? 'bg-[#19160F] w-7' : 'bg-black/20 w-2 hover:bg-black/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// คอมโพเนนต์แสดงโปรโมชั่นจากตาราง `promotions`
function PromotionSection({ promotions }: { promotions: Promotion[] }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const visiblePromotions = promotions.filter((promo) => Boolean(promo.image));

  if (visiblePromotions.length === 0) return null;

  const scrollPromotions = (direction: 'left' | 'right') => {
    if (!sliderRef.current) return;
    sliderRef.current.scrollBy({
      left: direction === 'right' ? 260 : -260,
      behavior: 'smooth',
    });
  };

  const isScrollable = visiblePromotions.length > 4;

  return (
    <div className="w-full max-w-[1000px] mx-auto mt-8 px-0 sm:px-2">
      {/* หัวข้อ */}
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
          </span>
          <h2 className="font-black text-lg md:text-xl text-[#19160F]">
            โปรโมชั่น
          </h2>
        </div>

        {isScrollable && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollPromotions('left')}
              aria-label="โปรโมชั่นก่อนหน้า"
              className="w-9 h-9 rounded-full bg-white border border-black/10 shadow-sm flex items-center justify-center text-[#19160F] hover:bg-[#19160F] hover:text-white active:scale-95 transition-all"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollPromotions('right')}
              aria-label="โปรโมชั่นถัดไป"
              className="w-9 h-9 rounded-full bg-[#19160F] text-white shadow-sm flex items-center justify-center hover:bg-[#D62828] active:scale-95 transition-all"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Promo viewport — 1-4 ใบจะอยู่ตรงกลาง, มากกว่า 4 ใบเลื่อนไปทางขวาได้ */}
      <div className="relative w-full">
        <div
          ref={sliderRef}
          className={`w-full flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 px-1 no-scrollbar ${
            isScrollable ? 'justify-start' : 'justify-center'
          }`}
          style={{ scrollbarWidth: 'none' }}
        >
          {visiblePromotions.map((promo, idx) => (
            <button
              type="button"
              key={promo.id}
              onClick={() => promo.image && setSelectedImage(promo.image)}
              className="group relative shrink-0 snap-center w-[210px] sm:w-[220px] aspect-square rounded-2xl overflow-hidden bg-white border border-black/10 shadow-md hover:-translate-y-1 hover:shadow-xl hover:border-[#E8A33D]/60 transition-all duration-300 text-left cursor-pointer"
            >
              <img
                src={promo.image!}
                alt={promo.title || `โปรโมชั่น ${idx + 1}`}
                className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span className="absolute top-2.5 left-2.5 bg-[#E8A33D] text-[#19160F] text-[10px] font-black px-2.5 py-1 rounded-full shadow-md">
                PROMO {idx + 1}
              </span>
            </button>
          ))}
        </div>

        {isScrollable && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-3 w-20 bg-gradient-to-l from-[#EDE7D9] to-transparent" />
        )}
      </div>

      {isScrollable && (
        <div className="flex justify-center items-center gap-2 mt-1 text-[10px] text-black/40 font-medium">
          <span>←</span>
          <span>เลื่อนดูโปรโมชั่น</span>
          <span>→</span>
        </div>
      )}

      {/* Preview รูปใหญ่ */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in"
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex justify-center items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-11 right-0 text-white/90 hover:text-white text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md transition-all"
            >
              ✕ ปิด
            </button>
            <img
              src={selectedImage}
              alt="รูปขยายโปรโมชั่น"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: EventItem }) {
  // ทั้งการ์ดกดได้เลย ไม่ต้องกดเฉพาะปุ่ม — พาไปหน้าไปที่จองของคอนเสิร์ตนั้นๆ ใน /booking โดยตรง
  // ตัดข้อมูลสถานที่และเวลาออก เหลือแค่รูป โปสเตอร์ / ชื่อการแสดง / วันที่ / ปุ่มจองเลย
  return (
    <Link
      href={`/booking?date=${event.date}`}
      className="group shrink-0 w-72 snap-start rounded-3xl overflow-hidden bg-[#121212] border border-white/10 text-white shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between cursor-pointer"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/40">
        <img
          src={event.image}
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 bg-[#E8A33D] text-[#19160F] text-[11px] font-black px-3 py-1 rounded-full shadow-md backdrop-blur-md">
          {event.displayDate}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <h3 className="font-black text-lg leading-snug line-clamp-2 text-white group-hover:text-[#E8A33D] transition-colors">
          {event.title}
        </h3>

        

        <span className="w-full py-2.5 px-4 rounded-xl bg-[#D62828] group-hover:bg-[#b82020] text-white font-black text-sm text-center flex items-center justify-center gap-2 shadow-lg transition-colors group-active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5z" />
          </svg>
          <span>จองเลย</span>
        </span>
      </div>
    </Link>
  );
}

function BentoMenu({
  onOpenMenuModal,
  onOpenContactModal,
}: {
  onOpenMenuModal: () => void;
  onOpenContactModal: () => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
      <Link
        href="/booking"
        className="col-span-2 row-span-2 rounded-3xl bg-[#19160F] text-[#EDE7D9] p-6 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 shadow-lg min-h-[220px] md:min-h-[260px]"
      >
        <div className="z-10">
          <span className="inline-block bg-[#E8A33D] text-[#19160F] text-[10px] font-black px-2.5 py-1 rounded-full mb-3">
            RECOMMENDED
          </span>
          <h3 className="text-2xl md:text-3xl font-black leading-tight">
            จองโต๊ะ<br />ล่วงหน้า
          </h3>
          <p className="text-xs text-[#EDE7D9]/60 mt-2">สำรองที่นั่งสำหรับค่ำคืนพิเศษของคุณ</p>
        </div>
        <div className="z-10 flex items-center gap-2 text-xs font-bold text-[#E8A33D] group-hover:translate-x-1 transition-transform">
          <span>กดเพื่อจองโต๊ะ</span>
          <span>→</span>
        </div>
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-[#E8A33D]/10 rounded-full blur-2xl group-hover:bg-[#E8A33D]/20 transition-colors" />
      </Link>

      <button
        onClick={onOpenMenuModal}
        className="col-span-2 md:col-span-2 rounded-3xl bg-[#D62828] text-[#EDE7D9] p-5 flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300 shadow-md min-h-[120px] text-left cursor-pointer"
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-black">รายการอาหาร</h3>
            <p className="text-xs text-[#EDE7D9]/80 mt-1">เครื่องดื่ม & กับแกล้มต้อนรับคุณ</p>
          </div>
          <span className="text-2xl opacity-80 group-hover:scale-110 transition-transform">🍽️</span>
        </div>
        <div className="self-end text-xs font-bold underline decoration-2 underline-offset-4">
          ดูเมนูทั้งหมด
        </div>
      </button>

      <a
        href="https://get-warp.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="col-span-1 rounded-3xl bg-[#1E5AA8] text-[#EDE7D9] p-5 flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300 shadow-md min-h-[120px]"
      >
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-black leading-tight">ส่งข้อความ<br />ขึ้นจอ</h3>
          <span className="text-lg">💬</span>
        </div>
        <span className="text-[10px] bg-white/20 w-max px-2 py-0.5 rounded-md font-medium">
          LIVE WARP ↗
        </span>
      </a>

      <button
        onClick={onOpenContactModal}
        className="col-span-1 rounded-3xl bg-[#E8A33D] text-[#19160F] p-5 flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300 shadow-md min-h-[120px] text-left cursor-pointer"
      >
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-black leading-tight">ติดต่อ<br />แอดมิน</h3>
          <span className="text-lg">💬</span>
        </div>
        <span className="text-xs font-bold group-hover:translate-x-1 transition-transform">
          สอบถาม →
        </span>
      </button>
    </div>
  );
}

// ==========================================
// MENU POPUP MODAL
// ==========================================

function MenuModal({ isOpen, onClose, menuData }: { isOpen: boolean; onClose: () => void; menuData: MenuCategory[] }) {
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    if (menuData && menuData.length > 0 && !activeCategory) {
      setActiveCategory(menuData[0].categoryKey);
    }
  }, [menuData]);

  if (!isOpen) return null;

  const currentCategoryData = menuData.find((item) => item.categoryKey === activeCategory) || menuData[0];
  if (!currentCategoryData) return null;

  const currentImages = currentCategoryData.images || [];

  const handleCategoryChange = (key: string) => {
    setActiveCategory(key);
    setCurrentIndex(0);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? currentImages.length - 1 : prev - 1));
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev === currentImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#FAF7ED] text-[#2C2925] rounded-[32px] overflow-hidden shadow-2xl flex flex-col border border-white/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div>
            <span className="block text-[11px] text-gray-400 font-medium"></span>
            <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] capitalize">
              {currentCategoryData.categoryLabel}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#E5DDCB] hover:bg-[#D8CEB8] active:scale-95 flex items-center justify-center text-gray-700 font-bold transition-all text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-2 overflow-x-auto">
          {menuData.map((cat) => {
            const isActive = activeCategory === cat.categoryKey;
            return (
              <button
                key={cat.categoryKey}
                onClick={() => handleCategoryChange(cat.categoryKey)}
                className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#5A382D] text-white shadow-sm'
                    : 'bg-[#EADECE] text-gray-600 hover:bg-[#E2D2BE]'
                }`}
              >
                {cat.categoryLabel}
              </button>
            );
          })}
        </div>

        <div className="relative px-6 py-2 flex-1 flex items-center justify-center">
          <div className="relative w-full aspect-[3/4] sm:aspect-[4/5] rounded-2xl overflow-hidden bg-[#EAE3D2] shadow-inner border border-black/5 flex items-center justify-center">
            {currentImages[currentIndex] ? (
              <img
                src={currentImages[currentIndex]}
                alt={`Menu ${currentIndex + 1}`}
                className="w-full h-full object-contain transition-all duration-300"
              />
            ) : (
              <div className="text-gray-400 text-sm">ไม่มีรูปภาพในหมวดหมู่นี้</div>
            )}

            {currentImages.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm flex items-center justify-center transition-all active:scale-90 text-lg"
                >
                  ‹
                </button>
                <button
                  onClick={goNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm flex items-center justify-center transition-all active:scale-90 text-lg"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar justify-center">
            {currentImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`relative w-12 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                  currentIndex === idx
                    ? 'border-[#5A382D] scale-105 shadow-md ring-2 ring-[#5A382D]/20'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 flex items-center justify-between text-[11px] text-gray-400 border-t border-black/5 bg-[#F5F0E1]">
          <span></span>
          <span className="font-semibold text-gray-500">
            {currentIndex + 1} / {currentImages.length || 0}
          </span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// CONTACT MODAL
// ==========================================

interface ContactChannel {
  id: string;
  image: string | null;
  linkUrl: string;
}

function ContactModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const supabase = createClient();
  const [channels, setChannels] = useState<ContactChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchContacts() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setChannels(
          data.map((c: any) => ({
            id: c.id,
            image: c.image || null,
            linkUrl: c.link_url,
          }))
        );
        setCurrentIndex(0);
      }
      setIsLoading(false);
    }

    fetchContacts();
  }, [isOpen, supabase]);

  if (!isOpen) return null;

  const currentChannel = channels[currentIndex];

  const goPrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? channels.length - 1 : prev - 1));
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev === channels.length - 1 ? 0 : prev + 1));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#FAF7ED] text-[#2C2925] rounded-[32px] overflow-hidden shadow-2xl flex flex-col border border-white/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div>
            <span className="block text-[11px] text-gray-400 font-medium">ติดต่อเรา</span>
            <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A]">ติดต่อแอดมิน</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E5DDCB] hover:bg-[#D8CEB8] active:scale-95 flex items-center justify-center text-gray-700 font-bold transition-all text-sm"
          >
            ✕
          </button>
        </div>

        <div className="relative px-6 py-2 flex-1 flex flex-col items-center justify-center gap-5">
          {isLoading && <div className="text-gray-400 text-sm py-10 text-center">กำลังโหลด...</div>}

          {!isLoading && channels.length === 0 && (
            <div className="text-gray-400 text-sm py-10 text-center">ยังไม่มีช่องทางติดต่อที่เปิดใช้งาน</div>
          )}

          {!isLoading && currentChannel && (
            <>
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#2C2925] shadow-inner border border-black/5 flex items-center justify-center">
                {currentChannel.image ? (
                  <img
                    src={currentChannel.image}
                    alt={`ช่องทางติดต่อ ${currentIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl">💬</div>
                )}

                {channels.length > 1 && (
                  <>
                    <button
                      onClick={goPrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm flex items-center justify-center transition-all active:scale-90 text-lg"
                    >
                      ‹
                    </button>
                    <button
                      onClick={goNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm flex items-center justify-center transition-all active:scale-90 text-lg"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>

              <a
                href={currentChannel.linkUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full max-w-[240px] py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-base text-center shadow-lg active:scale-95 transition-all"
              >
                ติดต่อเลย
              </a>
            </>
          )}
        </div>

        {!isLoading && channels.length > 1 && (
          <div className="px-6 py-2">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar justify-center">
              {channels.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative w-12 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                    currentIndex === idx
                      ? 'border-[#5A382D] scale-105 shadow-md ring-2 ring-[#5A382D]/20'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  {c.image ? (
                    <img src={c.image} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#EADECE] text-lg">💬</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isLoading && channels.length > 0 && (
          <div className="px-6 py-3 flex items-center justify-center text-[11px] text-gray-400 border-t border-black/5 bg-[#F5F0E1]">
            <span className="font-semibold text-gray-500">แตะรูปเพื่อไปยังช่องทางติดต่อ</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// MAIN HOMEPAGE
// ==========================================

export default function HomePage() {
  const supabase = createClient();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [menuData, setMenuData] = useState<MenuCategory[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    async function fetchDatabaseData() {
      // 1. ดึงข้อมูล Banners
      const { data: banners } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      if (banners && banners.length > 0) {
        setGalleryImages(banners.map((b: any) => b.image_url));
      }

      // 2. ดึงข้อมูลโปรโมชั่นจากตาราง promotions
      const promoNow = new Date();
      const promoTodayStr = `${promoNow.getFullYear()}-${String(
        promoNow.getMonth() + 1
      ).padStart(2, '0')}-${String(promoNow.getDate()).padStart(2, '0')}`;

      const { data: promos, error: promoError } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${promoTodayStr}`)
        .or(`end_date.is.null,end_date.gte.${promoTodayStr}`)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (!promoError && promos) {
        setPromotions(promos as Promotion[]);
      } else if (promoError) {
        console.error('Error fetching promotions:', promoError);
        setPromotions([]);
      }

      // 3. ดึงข้อมูลเมนูอาหาร
      const { data: menus } = await supabase.from('menus').select('*').order('sort_order', { ascending: true });
      if (menus && menus.length > 0) {
        setMenuData(
          menus.map((m: any) => ({
            categoryKey: m.category_key,
            categoryLabel: m.category_label,
            images: m.images || [],
          }))
        );
      }

      // 4. ดึงข้อมูล Event / คอนเสิร์ต — เอาเฉพาะที่เปิดแสดงและยังไม่ผ่านไป
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .gte('date', todayStr)
        .order('date', { ascending: true });
      if (events && events.length > 0) {
        setUpcomingEvents(
          events.map((e: any) => ({
            date: e.date,
            displayDate: e.display_date,
            title: e.title,
            image: e.image,
          }))
        );
      }
    }

    fetchDatabaseData();
  }, [supabase]);

  return (
    <main className="min-h-screen bg-[#EDE7D9] text-[#19160F]">
      <header className="flex flex-col items-center py-8">
        <span className="font-serif italic text-3xl">Check in</span>
        <span className="text-xs tracking-widest text-black/50">KHLONG 6</span>
      </header>

      {/* Carousel & โปรโมชั่นวันนี้ */}
      <section className="px-6 md:px-12 pb-12">
        <Carousel galleryImages={galleryImages} />
        <PromotionSection promotions={promotions} />
      </section>

      {/* Bento Grid Menu Section */}
      <section className="px-6 md:px-12 pb-14">
        <h2 className="font-black text-xl mb-6 text-center">รายการ</h2>
        <BentoMenu onOpenMenuModal={() => setIsMenuOpen(true)} onOpenContactModal={() => setIsContactOpen(true)} />
      </section>

      {/* Event Cards Section */}
      <section className="pb-16 max-w-6xl mx-auto px-6 md:px-12">
        <h2 className="font-black text-xl mb-6 text-center md:text-left">
          รอบการแสดงที่กำลังจะมาถึง
        </h2>
        
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory justify-start md:justify-center pb-4 no-scrollbar">
          {upcomingEvents.map((event, idx) => (
            <EventCard key={`${event.date}-${idx}`} event={event} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 border-t border-black/10 bg-[#EDE7D9] text-[#D62828]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center">
            <img 
              src="/photo/logo.png" 
              alt="Check in Khlong 6 Logo" 
              className="h-20 md:h-50 w-auto object-contain transition-all"
            />
          </div>

          <div className="flex flex-col items-center text-center gap-1 font-medium text-sm">
            <Link href="/terms" className="hover:underline transition-all">
              Terms and Conditions
            </Link>
            <span className="text-xs md:text-sm font-semibold">
              © 2026 GETMAIGEK. All rights reserved
            </span>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="flex items-center gap-3 text-[#D62828]">
              <a 
                href="https://www.facebook.com/checkinkhlong6" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
                aria-label="Facebook"
              >
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
              </a>

              <a 
                href="https://line.me" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
                aria-label="LINE"
              >
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.412-.105-.531-.283l-2.002-2.91v2.536c0 .348-.282.63-.63.63-.346 0-.628-.282-.628-.63V8.108c0-.27.173-.51.431-.595.063-.023.134-.033.2-.033.211 0 .411.105.53.282l2.003 2.91V8.108c0-.345.282-.63.63-.63.346 0 .627.285.627.63v4.771zm-5.741 0c0 .348-.282.63-.629.63-.346 0-.628-.282-.628-.63V8.108c0-.345.282-.63.628-.63.347 0 .629.285.629.63v4.771zm-2.466.63H4.917c-.347 0-.629-.282-.629-.63V8.108c0-.345.282-.63.629-.63.346 0 .628.285.628.63v4.141h1.756c.346 0 .628.283.628.63 0 .344-.282.629-.628.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08-.085.643-.388 2.511-.422 2.723-.058.358.267.585.592.387 2.701-1.638 7.32-4.431 9.988-7.582C23.111 15.12 24 12.83 24 10.314"/>
                </svg>
              </a>
            </div>

            <button
              onClick={() => setIsContactOpen(true)}
              className="text-xs font-bold hover:underline transition-all mt-1"
            >
              ติดต่อปัญหา
            </button>
          </div>
        </div>
      </footer>

      {/* POPUP MENU MODAL */}
      <MenuModal 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        menuData={menuData}
      />

      {/* POPUP CONTACT MODAL */}
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </main>
  );
}