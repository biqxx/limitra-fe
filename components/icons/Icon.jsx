/* LIMITRA icon set — backed by lucide-react (line icons) with a react-icons/fa
   fallback for brand glyphs lucide doesn't carry. Call sites are untouched:
   this keeps the same <Icon name="x" size={N} stroke={N} fill="..." /> API
   that the previous hand-rolled SVG-path registry used. */
import {
  Search, ShoppingCart, Heart, User, MapPin, ChevronDown, ChevronRight, ChevronLeft, ChevronUp,
  ArrowRight, Plus, Minus, Star, SlidersHorizontal, ArrowUpDown, LayoutGrid, Trash2, Check, X,
  Maximize2, Minimize2, Menu, Sun, Moon, Truck, Shield, RefreshCw, Tag, Package, Headphones,
  MessageCircle, Gift, Flame, Eye, ShoppingBag, ZoomIn, Mail, Lock, Phone, Pencil, CreditCard,
  DollarSign, Clock, Info, Sparkles, Store, Shirt, Paintbrush2, Scissors, List, Download, Share2,
  Copy, Play, Pause, Video, Volume2, VolumeX, Send, Paperclip, Bell, Wallet,
  Hash, Link2, MousePointerClick, Megaphone, Rocket, Ticket,
} from 'lucide-react';

const I = {
  search: Search, cart: ShoppingCart, heart: Heart, user: User, location: MapPin,
  chevdown: ChevronDown, chevright: ChevronRight, chevleft: ChevronLeft, chevup: ChevronUp,
  arrowr: ArrowRight, plus: Plus, minus: Minus, star: Star, filter: SlidersHorizontal,
  sort: ArrowUpDown, grid: LayoutGrid, trash: Trash2, check: Check, close: X,
  maximize: Maximize2, minimize: Minimize2, menu: Menu, sun: Sun, moon: Moon, truck: Truck,
  shield: Shield, refresh: RefreshCw, tag: Tag, package: Package, headset: Headphones,
  chat: MessageCircle, gift: Gift, flame: Flame, eye: Eye, bag: ShoppingBag, zoom: ZoomIn,
  mail: Mail, lock: Lock, phone: Phone, pin: MapPin, edit: Pencil, card: CreditCard,
  dollar: DollarSign, clock: Clock, info: Info, spark: Sparkles, store: Store, shirt: Shirt,
  makeup: Paintbrush2, hair: Scissors, list: List, download: Download, share: Share2,
  copy: Copy, play: Play, pause: Pause, video: Video, volume: Volume2, mute: VolumeX,
  telegram: Send, paperclip: Paperclip, bell: Bell, wallet: Wallet,
  hash: Hash, link: Link2, click: MousePointerClick,
  megaphone: Megaphone, rocket: Rocket, ticket: Ticket,
};

export function Icon({ name, size = 20, stroke = 2, fill = 'none', className = '', style = {} }) {
  const Cmp = I[name];
  if (!Cmp) return null;
  const solid = fill !== 'none';
  return (
    <Cmp
      size={size}
      className={className}
      style={style}
      strokeWidth={solid ? 0 : stroke}
      fill={solid ? fill : 'none'}
      color={solid ? fill : 'currentColor'}
      aria-hidden="true"
    />
  );
}

export function Logo({ height = 30, color, white }) {
  const isWhite = white || color === '#fff' || color === '#FFFFFF' || color === 'white';
  return (
    <span className={'lim-logo' + (isWhite ? ' force-dark' : '')} style={{ display: 'inline-block', height: height, lineHeight: 0 }}>
      <img className="lim-logo-light" src="/assets/logo.png" alt="Limitra" style={{ height: height }} />
      <img className="lim-logo-dark" src="/assets/logo-dark.png" alt="Limitra" style={{ height: height }} />
    </span>
  );
}
