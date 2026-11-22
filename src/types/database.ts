export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'pembeli' | 'admin' | 'pemilik';
export type KavlingStatus = 'tersedia' | 'dipesan' | 'terjual';
export type MetodePembayaran = 'cash' | 'cicil';
export type PemesananStatus = 'menunggu_pembayaran' | 'aktif' | 'lunas' | 'dibatalkan';
export type JenisTagihan = 'cash' | 'dp' | 'angsuran';
export type TagihanStatus = 'belum_bayar' | 'menunggu_verifikasi' | 'lunas';
export type PembayaranStatus = 'menunggu' | 'terverifikasi' | 'ditolak';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nama: string;
          no_hp: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          nama: string;
          no_hp?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          nama?: string;
          no_hp?: string | null;
          role?: UserRole;
        };
        Relationships: [];
      };
      kavlings: {
        Row: {
          id: string;
          kode: string;
          blok: string;
          nomor: string;
          luas_m2: number;
          harga: number;
          denda_persen_per_minggu: number | null;
          denda_maks_persen: number | null;
          masa_tenggang_hari: number | null;
          status: KavlingStatus;
          keterangan: string | null;
          aktif: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kode: string;
          blok: string;
          nomor: string;
          luas_m2: number;
          harga: number;
          denda_persen_per_minggu?: number | null;
          denda_maks_persen?: number | null;
          masa_tenggang_hari?: number | null;
          status?: KavlingStatus;
          keterangan?: string | null;
          aktif?: boolean;
        };
        Update: {
          kode?: string;
          blok?: string;
          nomor?: string;
          luas_m2?: number;
          harga?: number;
          denda_persen_per_minggu?: number | null;
          denda_maks_persen?: number | null;
          masa_tenggang_hari?: number | null;
          status?: KavlingStatus;
          keterangan?: string | null;
          aktif?: boolean;
        };
        Relationships: [];
      };
      opsi_cicilan: {
        Row: {
          id: string;
          kavling_id: string | null;
          dp_persen: number;
          tenor_bulan: number;
          aktif: boolean;
        };
        Insert: {
          id?: string;
          kavling_id?: string | null;
          dp_persen: number;
          tenor_bulan: number;
          aktif?: boolean;
        };
        Update: {
          kavling_id?: string | null;
          dp_persen?: number;
          tenor_bulan?: number;
          aktif?: boolean;
        };
        Relationships: [];
      };
      pemesanan: {
        Row: {
          id: string;
          kode: string;
          user_id: string;
          kavling_id: string;
          metode: MetodePembayaran;
          harga_terkunci: number;
          dp_persen: number | null;
          tenor_bulan: number | null;
          nominal_angsuran: number | null;
          status: PemesananStatus;
          tgl_pesan: string;
          batas_bayar: string;
          alasan_batal: string | null;
        };
        Insert: {
          id?: string;
          kode: string;
          user_id: string;
          kavling_id: string;
          metode: MetodePembayaran;
          harga_terkunci: number;
          dp_persen?: number | null;
          tenor_bulan?: number | null;
          nominal_angsuran?: number | null;
          status?: PemesananStatus;
          tgl_pesan?: string;
          batas_bayar: string;
          alasan_batal?: string | null;
        };
        Update: {
          status?: PemesananStatus;
          alasan_batal?: string | null;
        };
        Relationships: [];
      };
      tagihan: {
        Row: {
          id: string;
          pemesanan_id: string;
          jenis: JenisTagihan;
          urutan: number;
          jatuh_tempo: string;
          nominal: number;
          status: TagihanStatus;
        };
        Insert: {
          id?: string;
          pemesanan_id: string;
          jenis: JenisTagihan;
          urutan: number;
          jatuh_tempo: string;
          nominal: number;
          status?: TagihanStatus;
        };
        Update: { status?: TagihanStatus };
        Relationships: [];
      };
      pembayaran: {
        Row: {
          id: string;
          tagihan_id: string;
          nominal_pokok: number;
          denda: number;
          total: number;
          bukti_path: string;
          tgl_upload: string;
          status: PembayaranStatus;
          alasan_tolak: string | null;
          diverifikasi_oleh: string | null;
          tgl_verifikasi: string | null;
          no_kwitansi: string | null;
        };
        Insert: {
          id?: string;
          tagihan_id: string;
          nominal_pokok: number;
          denda?: number;
          total: number;
          bukti_path: string;
          tgl_upload?: string;
          status?: PembayaranStatus;
          alasan_tolak?: string | null;
          diverifikasi_oleh?: string | null;
          tgl_verifikasi?: string | null;
          no_kwitansi?: string | null;
        };
        Update: {
          status?: PembayaranStatus;
          alasan_tolak?: string | null;
          diverifikasi_oleh?: string | null;
          tgl_verifikasi?: string | null;
          no_kwitansi?: string | null;
        };
        Relationships: [];
      };
      pengaturan: {
        Row: { kunci: string; nilai: Json; updated_at: string };
        Insert: { kunci: string; nilai: Json; updated_at?: string };
        Update: { nilai?: Json };
        Relationships: [];
      };
      log_aktivitas: {
        Row: {
          id: number;
          user_id: string | null;
          aksi: string;
          objek: string;
          waktu: string;
        };
        Insert: {
          user_id?: string | null;
          aksi: string;
          objek: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_pemesanan: {
        Args: {
          p_kavling_id: string;
          p_metode: MetodePembayaran;
          p_dp_persen?: number;
          p_tenor_bulan?: number;
        };
        Returns: string;
      };
      upload_bukti: {
        Args: { p_tagihan_id: string; p_bukti_path: string };
        Returns: string;
      };
      verifikasi_pembayaran: {
        Args: { p_pembayaran_id: string; p_setuju: boolean; p_alasan?: string };
        Returns: undefined;
      };
      hitung_denda: {
        Args: {
          p_nominal: number;
          p_jatuh_tempo: string;
          p_tgl_upload: string;
          p_kavling_id?: string;
        };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      kavling_status: KavlingStatus;
      metode_pembayaran: MetodePembayaran;
      pemesanan_status: PemesananStatus;
      jenis_tagihan: JenisTagihan;
      tagihan_status: TagihanStatus;
      pembayaran_status: PembayaranStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Kavling = Database['public']['Tables']['kavlings']['Row'];
export type Pemesanan = Database['public']['Tables']['pemesanan']['Row'];
export type Tagihan = Database['public']['Tables']['tagihan']['Row'];
export type Pembayaran = Database['public']['Tables']['pembayaran']['Row'];
export type Pengaturan = Database['public']['Tables']['pengaturan']['Row'];
