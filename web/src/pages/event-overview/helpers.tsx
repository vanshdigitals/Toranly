/** Shared constants and small render helpers for the event planner tabs. */
import {
  Shield,
  Utensils,
  Building2,
  Sparkles,
  Shirt,
  Camera,
  Music,
  Mail,
  Plane,
  Flame,
  Gift,
  Folder,
} from 'lucide-react';

export const DEFAULT_VENDOR_CATEGORIES = [
  { key: 'venue', label: 'Venue & Staging' },
  { key: 'catering', label: 'Catering & Dining' },
  { key: 'photography', label: 'Photography & Film' },
  { key: 'decor', label: 'Decor & Florals' },
  { key: 'music', label: 'Music & Entertainment' },
  { key: 'attire', label: 'Attire & Jewellery' },
  { key: 'invitations', label: 'Invitations & Favours' },
  { key: 'general', label: 'Other Services' },
];

export const getCategoryIcon = (key: string, label: string) => {
  const normalized = `${key} ${label}`.toLowerCase();
  if (
    normalized.includes('cater') ||
    normalized.includes('food') ||
    normalized.includes('dining') ||
    normalized.includes('meal')
  ) {
    return <Utensils size={17} className="budget-cat-icon icon-catering" />;
  }
  if (
    normalized.includes('venue') ||
    normalized.includes('hall') ||
    normalized.includes('palace') ||
    normalized.includes('hotel') ||
    normalized.includes('banquet')
  ) {
    return <Building2 size={17} className="budget-cat-icon icon-venue" />;
  }
  if (
    normalized.includes('decor') ||
    normalized.includes('flower') ||
    normalized.includes('floral') ||
    normalized.includes('stage') ||
    normalized.includes('mandap')
  ) {
    return <Sparkles size={17} className="budget-cat-icon icon-decor" />;
  }
  if (
    normalized.includes('attire') ||
    normalized.includes('jewel') ||
    normalized.includes('cloth') ||
    normalized.includes('dress') ||
    normalized.includes('makeup')
  ) {
    return <Shirt size={17} className="budget-cat-icon icon-attire" />;
  }
  if (
    normalized.includes('photo') ||
    normalized.includes('video') ||
    normalized.includes('shoot') ||
    normalized.includes('film')
  ) {
    return <Camera size={17} className="budget-cat-icon icon-photo" />;
  }
  if (
    normalized.includes('music') ||
    normalized.includes('dj') ||
    normalized.includes('sound') ||
    normalized.includes('entertain') ||
    normalized.includes('sangeet')
  ) {
    return <Music size={17} className="budget-cat-icon icon-music" />;
  }
  if (
    normalized.includes('invite') ||
    normalized.includes('card') ||
    normalized.includes('mail') ||
    normalized.includes('stationery')
  ) {
    return <Mail size={17} className="budget-cat-icon icon-invites" />;
  }
  if (
    normalized.includes('contingency') ||
    normalized.includes('buffer') ||
    normalized.includes('emergency')
  ) {
    return <Shield size={17} className="budget-cat-icon icon-contingency" />;
  }
  if (
    normalized.includes('travel') ||
    normalized.includes('stay') ||
    normalized.includes('transport') ||
    normalized.includes('flight') ||
    normalized.includes('logistics')
  ) {
    return <Plane size={17} className="budget-cat-icon icon-travel" />;
  }
  if (
    normalized.includes('ritual') ||
    normalized.includes('pooja') ||
    normalized.includes('puja') ||
    normalized.includes('pandit') ||
    normalized.includes('havan') ||
    normalized.includes('ceremony')
  ) {
    return <Flame size={17} className="budget-cat-icon icon-rituals" />;
  }
  if (
    normalized.includes('gift') ||
    normalized.includes('favour') ||
    normalized.includes('favor')
  ) {
    return <Gift size={17} className="budget-cat-icon icon-gifts" />;
  }
  return <Folder size={17} className="budget-cat-icon icon-general" />;
};
