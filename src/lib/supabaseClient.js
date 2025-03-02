import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xzpcghgnhvputlptxvnu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cGNnaGduaHZwdXRscHR4dm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4NTQxOTMsImV4cCI6MjA1NjQzMDE5M30.6cdmWft5UIMs9Qnr9V_FRtM1Bm8usNaEYgLnzz1kU1I'

export const supabase = createClient(supabaseUrl, supabaseAnonKey) 