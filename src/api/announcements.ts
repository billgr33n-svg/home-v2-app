import { supabase } from '../lib/supabase';

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  priority: string;
  published_at: string | null;
}

export async function fetchAnnouncements(householdId: string): Promise<AnnouncementRow[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id,title,body,priority,published_at')
    .eq('household_id', householdId)
    .eq('state', 'active')
    .is('deleted_at', null)
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAnnouncement(householdId: string, title: string, body: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase.from('announcements').insert({
    household_id: householdId,
    author_id: uid,
    title,
    body,
    state: 'active',
    published_at: new Date().toISOString(),
  });
  if (error) throw error;
}
