-- Active Supabase Realtime sur les tables métier pour le front temps réel
alter publication supabase_realtime add table public."Transaction";
alter publication supabase_realtime add table public."Notification";
alter publication supabase_realtime add table public."Member";
alter publication supabase_realtime add table public."Event";
alter publication supabase_realtime add table public."Attendance";
alter publication supabase_realtime add table public."Message";
alter publication supabase_realtime add table public."Debt";
alter publication supabase_realtime add table public."Archive";