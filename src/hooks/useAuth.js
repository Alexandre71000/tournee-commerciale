import { useEffect, useState } from 'react';
import { sb } from '../lib/supabaseClient';

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = pas encore résolu, null = non connecté

  useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading: user === undefined };
}
