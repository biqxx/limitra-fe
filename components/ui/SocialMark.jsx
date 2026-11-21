/* Social brand glyph — backed by react-icons (authentic brand marks) instead
   of the previous hand-drawn SVG paths. Same <SocialMark name="X" size={N} />
   API as before, so call sites are untouched. */
import { FaFacebook, FaInstagram, FaWhatsapp, FaTiktok } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

const I = {
  X: FaXTwitter,
  Facebook: FaFacebook,
  Instagram: FaInstagram,
  WhatsApp: FaWhatsapp,
  TikTok: FaTiktok,
};

export function SocialMark({ name, size = 18 }) {
  const Cmp = I[name];
  if (!Cmp) return null;
  return <Cmp size={size} color="currentColor" aria-hidden="true" />;
}
