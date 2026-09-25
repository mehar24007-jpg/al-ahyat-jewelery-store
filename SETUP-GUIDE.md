# Al Hayat Jewelry — Next.js Setup Guide

Ye ek proper Next.js app hai: real backend (API routes, Node.js par chalte hain),
real database (Supabase/Postgres), real image storage, aur ek password-protected
admin dashboard. Isko chalane ke liye thoda technical setup chahiye (developer
ya khud, agar comfortable hain).

---

## 1. Database banayein (Supabase)

1. https://supabase.com par free account banayein, **New Project** banayein.
2. **SQL Editor** me jaayein, `schema.sql` ka poora content paste karein, **Run** dabayein.
   - Tables, security rules, order-placement function, aur image storage bucket sab ban jayenge.
   - 4 starter products bhi add ho jayenge.

## 2. Keys copy karein

**Project Settings → API** me jaayein aur do cheezein copy karein:
- **Project URL**
- **service_role key** (ye secret hai, kabhi public repo ya browser me na daalein)

## 3. Project setup karein

```bash
npm install
cp .env.local.example .env.local
```

`.env.local` file kholein aur bharain:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxxxxxxxx
SESSION_SECRET=koi_bhi_lambi_random_string
ADMIN_EMAIL=aap@example.com
ADMIN_PASSWORD=EkStrongPassword123
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` bhi **Project Settings → API** se milegi (wahi jagah jahan se URL aur service_role key li thi). Ye key public/safe hai — browser me photo/video seedha Supabase Storage par upload karne ke liye chahiye hoti hai.

## Photo aur video: ultra HD, auto-enhance

- **Original quality preserve hoti hai** — hum resolution kam ya compress nahi karte. Photos seedha browser se Supabase Storage me jati hain (hamare apne server se nahi guzarti), isliye 20MB tak ka original photo aur 50MB tak ka video bina kisi platform-limit ke upload ho sakta hai.
- **Auto-enhance** — har photo par upload hote hi automatically ek halka sharpening + contrast/saturation boost lagta hai — bina resolution ghataye.
- **Zaroori sach:** ye enhance ek achi photo ko aur crisp bana deta hai, lekin ye AI-upscaling nahi hai — agar original photo dhundhli/low-resolution hai, wo "asal 4K" nahi ban sakti. Behtareen result ke liye achi roshni me, phone ke sabse high-resolution camera mode se photo lein.

## 4. Local par test karein

```bash
npm run dev
```

Browser me `http://localhost:3000` kholein — store dikhega. `http://localhost:3000/admin` se login test karein.

## 5. Live karein (Vercel — free)

1. Code ko GitHub par push karein (ya Vercel CLI se seedha deploy karein).
2. https://vercel.com par jaayein → **Add New Project** → apna GitHub repo select karein.
3. **Environment Variables** section me wahi 5 values daalein jo `.env.local` me thi.
4. **Deploy** dabayein — 2 minute me live link mil jayega.

---

## Kya kya real hai is version me

- **Database**: Postgres (Supabase) — products, variants, orders sab permanently save
- **Backend**: Next.js API routes (Node.js) — order placement stock ko atomically check/deduct karta hai
- **Image upload**: Admin panel se photo upload → Supabase Storage me save → live URL store me use hoti hai
- **Video upload**: Har product me ek video bhi laga sakte hain (product detail me photo/video ke beech switch hota hai), 50MB tak — seedha Supabase Storage me jata hai, hosting ki chhoti limit se bypass ho jata hai.
- **Admin login**: Password-protected, signed session cookie (httpOnly, secure)
- **Security**: Browser kabhi seedha database ko touch nahi karta — sab kuch server (API routes) se hota hai; database key (service role) sirf server par, kabhi browser me nahi jaati

## Google Pay

Abhi Google Pay sirf ek checkout option hai — order record ho jata hai, lekin real
payment lene ke liye ek payment-gateway account (jo Google Pay support kare)
integrate karna hoga. Jab ready hon, batayein, us step ko guide kar dunga.
