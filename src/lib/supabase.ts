import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kdgfvzdnyloesxtqbvxe.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkZ2Z2emRueWxvZXN4dHFidnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDc1MzEsImV4cCI6MjA5Nzg4MzUzMX0.idvX60coqFAYttHlR43DUKNtpkr0YgZxcquCZF9F1ao";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Order = {
  id: string;
  customerName: string;
  itemDescription: string;
  vendorName: string;
  costPrice: number;
  sellingPrice: number;
  discount: number;
  finalCostPrice: number;
  profit: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  isArchived: boolean;
};
