import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ==============================
  // หน้า Login
  // ==============================
  if (pathname === "/admin/login") {
    // Login แล้ว → Dashboard
    if (user) {
      return NextResponse.redirect(
        new URL("/admin/dashboard", request.url)
      );
    }

    return response;
  }

  // ==============================
  // เฉพาะ /admin/*
  // ==============================
  if (pathname.startsWith("/admin/")) {
    // ยังไม่ได้ Login
    if (!user) {
      return NextResponse.redirect(
        new URL("/admin/login", request.url)
      );
    }
  }

  // หน้าอื่นทั้งหมดปล่อยผ่าน
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
  ],
};