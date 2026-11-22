-- Sistem Pembayaran Cicilan Tanah — schema awal
-- Jalankan lewat Supabase SQL Editor atau `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('pembeli', 'admin', 'pemilik');
create type public.kavling_status as enum ('tersedia', 'dipesan', 'terjual');
create type public.metode_pembayaran as enum ('cash', 'cicil');
create type public.pemesanan_status as enum ('menunggu_pembayaran', 'aktif', 'lunas', 'dibatalkan');
create type public.jenis_tagihan as enum ('cash', 'dp', 'angsuran');
create type public.tagihan_status as enum ('belum_bayar', 'menunggu_verifikasi', 'lunas');
create type public.pembayaran_status as enum ('menunggu', 'terverifikasi', 'ditolak');

-- ---------------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null,
  no_hp text,
  role public.user_role not null default 'pembeli',
  created_at timestamptz not null default now()
);

create table public.kavlings (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  blok text not null,
  nomor text not null,
  luas_m2 numeric(10, 2) not null check (luas_m2 > 0),
  harga bigint not null check (harga >= 0),
  -- null = pakai nilai pengaturan global
  denda_persen_per_minggu numeric(5, 2) check (denda_persen_per_minggu >= 0),
  denda_maks_persen numeric(5, 2) check (denda_maks_persen >= 0),
  masa_tenggang_hari integer check (masa_tenggang_hari >= 0),
  status public.kavling_status not null default 'tersedia',
  keterangan text,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opsi_cicilan (
  id uuid primary key default gen_random_uuid(),
  kavling_id uuid references public.kavlings (id) on delete cascade, -- null = berlaku umum
  dp_persen numeric(5, 2) not null check (dp_persen > 0 and dp_persen < 100),
  tenor_bulan integer not null check (tenor_bulan > 0),
  aktif boolean not null default true,
  unique nulls not distinct (kavling_id, dp_persen, tenor_bulan)
);

create table public.pemesanan (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  user_id uuid not null references public.profiles (id),
  kavling_id uuid not null references public.kavlings (id),
  metode public.metode_pembayaran not null,
  harga_terkunci bigint not null,
  dp_persen numeric(5, 2),
  tenor_bulan integer,
  nominal_angsuran bigint,
  status public.pemesanan_status not null default 'menunggu_pembayaran',
  tgl_pesan timestamptz not null default now(),
  batas_bayar timestamptz not null,
  alasan_batal text
);

-- Satu kavling hanya boleh punya satu pesanan aktif.
create unique index pemesanan_kavling_aktif on public.pemesanan (kavling_id)
  where status in ('menunggu_pembayaran', 'aktif');
create index pemesanan_user_idx on public.pemesanan (user_id);

create table public.tagihan (
  id uuid primary key default gen_random_uuid(),
  pemesanan_id uuid not null references public.pemesanan (id) on delete cascade,
  jenis public.jenis_tagihan not null,
  urutan integer not null,
  jatuh_tempo date not null,
  nominal bigint not null check (nominal >= 0),
  status public.tagihan_status not null default 'belum_bayar',
  unique (pemesanan_id, urutan)
);

create table public.pembayaran (
  id uuid primary key default gen_random_uuid(),
  tagihan_id uuid not null unique references public.tagihan (id) on delete cascade,
  nominal_pokok bigint not null,
  denda bigint not null default 0,
  total bigint not null,
  bukti_path text not null,
  tgl_upload timestamptz not null default now(),
  status public.pembayaran_status not null default 'menunggu',
  alasan_tolak text,
  diverifikasi_oleh uuid references public.profiles (id),
  tgl_verifikasi timestamptz,
  no_kwitansi text unique
);

create table public.pengaturan (
  kunci text primary key,
  nilai jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.log_aktivitas (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id),
  aksi text not null,
  objek text not null,
  waktu timestamptz not null default now()
);

create sequence public.pemesanan_seq;
create sequence public.kwitansi_seq;

insert into public.pengaturan (kunci, nilai) values
  ('denda_persen_per_minggu', '0.1'::jsonb),
  ('denda_maks_persen', '5'::jsonb),
  ('masa_tenggang_hari', '0'::jsonb),
  ('batas_bayar_pesanan_hari', '3'::jsonb),
  ('rekening', '{"bank":"BRI","nomor":"0000-0000-0000","atas_nama":"NAMA PEMILIK"}'::jsonb)
on conflict (kunci) do nothing;

-- Opsi awal PRD: DP 10/20/30/50% x tenor 12/24/36 bulan (kavling_id null = umum).
insert into public.opsi_cicilan (kavling_id, dp_persen, tenor_bulan, aktif)
select null, d.dp, t.tenor, true
from (values (10), (20), (30), (50)) as d(dp)
cross join (values (12), (24), (36)) as t(tenor)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Helper (SECURITY DEFINER: menghindari rekursi RLS saat membaca profiles)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'pemilik')
  );
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger kavlings_updated before update on public.kavlings
  for each row execute function public.set_updated_at();
create trigger pengaturan_updated before update on public.pengaturan
  for each row execute function public.set_updated_at();

-- Akun baru selalu pembeli; admin dipromosikan lewat SQL/dashboard Supabase.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nama, no_hp, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nama', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'no_hp',
    'pembeli'
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pembeli tidak boleh mengangkat dirinya sendiri jadi admin.
create or replace function public.guard_profile_role() returns trigger
language plpgsql as $$
begin
  -- auth.uid() null = perubahan dari SQL Editor/service role, bukan dari pengguna login.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah peran';
  end if;
  return new;
end;
$$;

create trigger profiles_role_guard before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- Aturan bisnis: denda dibaca saat data diambil, dikunci saat bukti diunggah
-- ---------------------------------------------------------------------------
create or replace function public.hitung_denda(
  p_nominal bigint,
  p_jatuh_tempo date,
  p_tgl_upload date,
  p_kavling_id uuid default null
) returns bigint
language sql stable set search_path = public as $$
  with global_cfg as (
    select
      (select (nilai #>> '{}')::numeric from public.pengaturan where kunci = 'denda_persen_per_minggu') as persen,
      (select (nilai #>> '{}')::numeric from public.pengaturan where kunci = 'denda_maks_persen') as maks,
      (select (nilai #>> '{}')::integer from public.pengaturan where kunci = 'masa_tenggang_hari') as tenggang
  ),
  kav_cfg as (
    select denda_persen_per_minggu, denda_maks_persen, masa_tenggang_hari
    from public.kavlings where id = p_kavling_id
  ),
  cfg as (
    select
      coalesce(k.denda_persen_per_minggu, g.persen, 0) as persen,
      coalesce(k.denda_maks_persen, g.maks, 5) as maks,
      coalesce(k.masa_tenggang_hari, g.tenggang, 0) as tenggang
    from global_cfg g
    left join kav_cfg k on true
  )
  select case
    when p_tgl_upload <= p_jatuh_tempo + cfg.tenggang then 0
    else least(
      round(p_nominal::numeric * cfg.persen / 100 * ceil((p_tgl_upload - p_jatuh_tempo - cfg.tenggang)::numeric / 7)),
      round(p_nominal::numeric * cfg.maks / 100)
    )::bigint
  end
  from cfg;
$$;

-- ---------------------------------------------------------------------------
-- Transaksi: buat pesanan + tagihan + kunci kavling (sekali panggil RPC)
-- ---------------------------------------------------------------------------
create or replace function public.create_pemesanan(
  p_kavling_id uuid,
  p_metode public.metode_pembayaran,
  p_dp_persen numeric default null,
  p_tenor_bulan integer default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_kav public.kavlings%rowtype;
  v_pesanan_id uuid;
  v_harga bigint;
  v_dp_amount bigint;
  v_sisa bigint;
  v_angsuran bigint;
  v_i integer;
  v_tgl date := (now() at time zone 'Asia/Jakarta')::date;
  v_jatuh date;
  v_batas integer;
begin
  if v_user is null then
    raise exception 'Harus login untuk memesan';
  end if;

  select * into v_kav from public.kavlings where id = p_kavling_id for update;
  if not found or not v_kav.aktif or v_kav.status <> 'tersedia' then
    raise exception 'Kavling tidak tersedia';
  end if;

  if p_metode = 'cicil' then
    if p_dp_persen is null or p_tenor_bulan is null then
      raise exception 'DP dan tenor wajib diisi';
    end if;
    if not exists (
      select 1 from public.opsi_cicilan o
      where o.aktif
        and o.dp_persen = p_dp_persen
        and o.tenor_bulan = p_tenor_bulan
        and (o.kavling_id = p_kavling_id or o.kavling_id is null)
    ) then
      raise exception 'Opsi DP/tenor tidak tersedia';
    end if;
  end if;

  v_harga := v_kav.harga;
  select coalesce((nilai #>> '{}')::integer, 3) into v_batas
  from public.pengaturan where kunci = 'batas_bayar_pesanan_hari';

  insert into public.pemesanan (
    kode, user_id, kavling_id, metode, harga_terkunci,
    dp_persen, tenor_bulan, nominal_angsuran, status, tgl_pesan, batas_bayar
  ) values (
    'PS-' || lpad(nextval('public.pemesanan_seq')::text, 6, '0'),
    v_user, p_kavling_id, p_metode, v_harga,
    p_dp_persen, p_tenor_bulan, 0, 'menunggu_pembayaran', now(),
    now() + make_interval(days => v_batas)
  )
  returning id into v_pesanan_id;

  if p_metode = 'cash' then
    insert into public.tagihan (pemesanan_id, jenis, urutan, jatuh_tempo, nominal)
    values (v_pesanan_id, 'cash', 1, v_tgl, v_harga);
  else
    v_dp_amount := round(v_harga::numeric * p_dp_persen / 100);
    v_sisa := v_harga - v_dp_amount;
    v_angsuran := round(v_sisa::numeric / p_tenor_bulan);

    insert into public.tagihan (pemesanan_id, jenis, urutan, jatuh_tempo, nominal)
    values (v_pesanan_id, 'dp', 1, v_tgl, v_dp_amount);

    for v_i in 1..p_tenor_bulan loop
      v_jatuh := (v_tgl + make_interval(months => v_i))::date;
      insert into public.tagihan (pemesanan_id, jenis, urutan, jatuh_tempo, nominal)
      values (
        v_pesanan_id, 'angsuran', v_i + 1, v_jatuh,
        case when v_i = p_tenor_bulan
          then v_sisa - v_angsuran * (p_tenor_bulan - 1)
          else v_angsuran
        end
      );
    end loop;

    update public.pemesanan set nominal_angsuran = v_angsuran where id = v_pesanan_id;
  end if;

  update public.kavlings set status = 'dipesan' where id = p_kavling_id;
  return v_pesanan_id;
exception
  when unique_violation then
    raise exception 'Kavling sudah dipesan pembeli lain';
end;
$$;

-- ---------------------------------------------------------------------------
-- Unggah bukti: denda dihitung dan dikunci di sini
-- ---------------------------------------------------------------------------
create or replace function public.upload_bukti(p_tagihan_id uuid, p_bukti_path text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_tag public.tagihan%rowtype;
  v_kavling_id uuid;
  v_denda bigint;
  v_pembayaran_id uuid;
begin
  if v_user is null then
    raise exception 'Harus login';
  end if;

  select t.* into v_tag
  from public.tagihan t
  join public.pemesanan p on p.id = t.pemesanan_id
  where t.id = p_tagihan_id and p.user_id = v_user
  for update of t;

  if not found then
    raise exception 'Tagihan tidak ditemukan';
  end if;
  if v_tag.status not in ('belum_bayar', 'menunggu_verifikasi') then
    raise exception 'Tagihan tidak dapat dibayar';
  end if;
  if exists (
    select 1 from public.pembayaran
    where tagihan_id = p_tagihan_id and status = 'menunggu'
  ) then
    raise exception 'Bukti masih menunggu verifikasi';
  end if;

  select kavling_id into v_kavling_id
  from public.pemesanan where id = v_tag.pemesanan_id;

  v_denda := case
    when v_tag.jenis = 'angsuran'
      then public.hitung_denda(
        v_tag.nominal, v_tag.jatuh_tempo,
        (now() at time zone 'Asia/Jakarta')::date, v_kavling_id
      )
    else 0
  end;

  insert into public.pembayaran (
    tagihan_id, nominal_pokok, denda, total, bukti_path, status
  ) values (
    p_tagihan_id, v_tag.nominal, v_denda, v_tag.nominal + v_denda, p_bukti_path, 'menunggu'
  )
  on conflict (tagihan_id) do update set
    nominal_pokok = excluded.nominal_pokok,
    denda = excluded.denda,
    total = excluded.total,
    bukti_path = excluded.bukti_path,
    tgl_upload = now(),
    status = 'menunggu',
    alasan_tolak = null,
    diverifikasi_oleh = null,
    tgl_verifikasi = null,
    no_kwitansi = null
  where pembayaran.status = 'ditolak'
  returning id into v_pembayaran_id;

  if v_pembayaran_id is null then
    raise exception 'Bukti yang sudah terverifikasi tidak dapat diunggah ulang';
  end if;

  update public.tagihan set status = 'menunggu_verifikasi' where id = p_tagihan_id;
  return v_pembayaran_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Verifikasi admin + penerbitan kwitansi
-- ---------------------------------------------------------------------------
create or replace function public.verifikasi_pembayaran(
  p_pembayaran_id uuid,
  p_setuju boolean,
  p_alasan text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pemb public.pembayaran%rowtype;
  v_tag public.tagihan%rowtype;
  v_pes public.pemesanan%rowtype;
  v_no text;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat memverifikasi';
  end if;

  select * into v_pemb from public.pembayaran where id = p_pembayaran_id for update;
  if not found or v_pemb.status <> 'menunggu' then
    raise exception 'Pembayaran tidak dalam antrean verifikasi';
  end if;

  select * into v_tag from public.tagihan where id = v_pemb.tagihan_id;
  select * into v_pes from public.pemesanan where id = v_tag.pemesanan_id for update;

  if not p_setuju then
    if p_alasan is null or btrim(p_alasan) = '' then
      raise exception 'Alasan penolakan wajib diisi';
    end if;
    update public.pembayaran
    set status = 'ditolak', alasan_tolak = p_alasan,
        diverifikasi_oleh = auth.uid(), tgl_verifikasi = now()
    where id = p_pembayaran_id;
    update public.tagihan set status = 'belum_bayar' where id = v_tag.id;
    insert into public.log_aktivitas (user_id, aksi, objek)
    values (auth.uid(), 'tolak_pembayaran', p_pembayaran_id::text);
    return;
  end if;

  v_no := 'KW-' || lpad(nextval('public.kwitansi_seq')::text, 4, '0');
  update public.pembayaran
  set status = 'terverifikasi', no_kwitansi = v_no,
      diverifikasi_oleh = auth.uid(), tgl_verifikasi = now()
  where id = p_pembayaran_id;
  update public.tagihan set status = 'lunas' where id = v_tag.id;

  if v_tag.jenis in ('cash', 'dp') then
    update public.pemesanan
    set status = case when v_tag.jenis = 'cash' then 'lunas' else 'aktif' end
    where id = v_pes.id;
    update public.kavlings set status = 'terjual' where id = v_pes.kavling_id;
  elsif not exists (
    select 1 from public.tagihan
    where pemesanan_id = v_pes.id and status <> 'lunas'
  ) then
    update public.pemesanan set status = 'lunas' where id = v_pes.id;
  end if;

  insert into public.log_aktivitas (user_id, aksi, objek)
  values (auth.uid(), 'verifikasi_pembayaran', p_pembayaran_id::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.kavlings enable row level security;
alter table public.opsi_cicilan enable row level security;
alter table public.pemesanan enable row level security;
alter table public.tagihan enable row level security;
alter table public.pembayaran enable row level security;
alter table public.pengaturan enable row level security;
alter table public.log_aktivitas enable row level security;

create policy "profil_baca" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy "profil_ubah_sendiri" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "kavling_baca" on public.kavlings for select to authenticated using (true);
create policy "kavling_kelola_admin" on public.kavlings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "opsi_baca" on public.opsi_cicilan for select to authenticated using (true);
create policy "opsi_kelola_admin" on public.opsi_cicilan for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "pesanan_baca" on public.pemesanan for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy "pesanan_kelola_admin" on public.pemesanan for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "tagihan_baca" on public.tagihan for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.pemesanan p
      where p.id = pemesanan_id and p.user_id = auth.uid()
    )
  );

create policy "pembayaran_baca" on public.pembayaran for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.tagihan t
      join public.pemesanan p on p.id = t.pemesanan_id
      where t.id = tagihan_id and p.user_id = auth.uid()
    )
  );

create policy "pengaturan_baca" on public.pengaturan for select to authenticated using (true);
create policy "pengaturan_kelola_admin" on public.pengaturan for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "log_baca_staff" on public.log_aktivitas for select to authenticated
  using (public.is_staff());
create policy "log_tulis_admin" on public.log_aktivitas for insert to authenticated
  with check (public.is_admin() and user_id = auth.uid());

-- Insersi pesanan, tagihan, pembayaran, dan verifikasi hanya lewat fungsi RPC
-- SECURITY DEFINER di atas (tidak ada policy insert untuk peran pembeli).

grant execute on function public.create_pemesanan(uuid, public.metode_pembayaran, numeric, integer) to authenticated;
grant execute on function public.upload_bukti(uuid, text) to authenticated;
grant execute on function public.verifikasi_pembayaran(uuid, boolean, text) to authenticated;
grant execute on function public.hitung_denda(bigint, date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage privat: {user_id}/{pemesanan_id}/{tagihan_id}/{nama_file}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('bukti-transfer', 'bukti-transfer', false)
on conflict (id) do nothing;

create policy "bukti_upload_sendiri" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bukti-transfer'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "bukti_baca_sendiri_atau_admin" on storage.objects for select to authenticated
  using (
    bucket_id = 'bukti-transfer'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
