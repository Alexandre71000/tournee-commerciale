import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2, Waypoints } from 'lucide-react';
import { sendMagicLink } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import Map3D from '../components/map/Map3D';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleSend(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await sendMagicLink(email.trim());
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast(err.message || "Erreur d'envoi", 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-surface">
      <div className="absolute inset-0 opacity-70">
        <Map3D home={null} days={[]} activeDayFilter="all" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-surface/40 via-surface/55 to-surface/85" />

      <div className="relative h-full w-full flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="glass-strong w-full max-w-sm rounded-2xl p-8"
        >
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
              <Waypoints size={18} strokeWidth={2.25} />
            </div>
            <span className="font-display font-semibold text-lg tracking-tight">Tournée.ai</span>
          </div>

          {!sent ? (
            <form onSubmit={handleSend}>
              <h1 className="font-display text-xl font-semibold mb-1.5">Connexion</h1>
              <p className="text-sm text-ink-muted mb-6">Reçois un lien de connexion par e-mail, sans mot de passe.</p>
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="toi@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" variant="primary" size="lg" className="w-full mt-4" disabled={loading}>
                <Mail size={16} /> {loading ? 'Envoi…' : 'Envoyer le lien de connexion'}
              </Button>
            </form>
          ) : (
            <div className="flex flex-col items-center text-center py-4">
              <CheckCircle2 size={32} className="text-success mb-3" />
              <div className="font-medium mb-1">Lien envoyé</div>
              <div className="text-sm text-ink-muted">Vérifie ta boîte mail pour te connecter.</div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
