// File: src/utils/iconHelper.tsx

import React from 'react';
// ✅ --- ADDING MANY NEW ICONS ---
import { 
    Utensils, ShoppingBag, Car, Ticket, Zap, Heart, Home, Plane, Building, 
    Leaf, PawPrint, Package, HelpCircle, Briefcase, Gift, Landmark, 
    PiggyBank, Dumbbell, Shapes, Receipt, GraduationCap, Pizza,
    Train, Bus, Clapperboard, Shirt, Gamepad2, Pill, Ambulance,
    University, Laptop, Phone, Sprout, Cat, Dog, Coffee
} from 'lucide-react';

// --- The Massively Expanded Icon Map ---
// Colours are pastel tints (never a saturated 500+ fill) so ink text/icons
// stay >= 7:1 contrast on top -- handoff/README.md SS Accessibility: "ink on
// cream is 14:1; candy cards carry ink text at >= 7:1 -- never white text on
// candy." Each icon keeps its own distinct hue (33 categories need to stay
// scannable at a glance); where a hue has a direct candy-token equivalent
// that's used verbatim, otherwise a matching Tailwind 200-level pastel.
const iconRegistry: { [key: string]: { component: React.ReactElement, color: string } } = {
    // --- Standard Categories ---
    'utensils':     { component: <Utensils />,     color: 'bg-candy-coral' },  // Food
    'pizza':        { component: <Pizza />,         color: 'bg-orange-200' },  // Food
    'shopping-bag': { component: <ShoppingBag />,  color: 'bg-candy-blue' },   // Shopping
    'shirt':        { component: <Shirt />,         color: 'bg-sky-200' },     // Shopping
    'car':          { component: <Car />,          color: 'bg-candy-yellow' },// Transport
    'train':        { component: <Train />,         color: 'bg-amber-200' },   // Transport
    'bus':          { component: <Bus />,           color: 'bg-orange-200' },  // Transport
    'ticket':       { component: <Ticket />,       color: 'bg-candy-lilac' }, // Entertainment
    'clapperboard': { component: <Clapperboard />, color: 'bg-violet-200' },  // Entertainment
    'gamepad-2':    { component: <Gamepad2 />,     color: 'bg-fuchsia-200' }, // Entertainment
    'zap':          { component: <Zap />,          color: 'bg-rose-200' },    // Bills
    'receipt':      { component: <Receipt />,      color: 'bg-red-200' },     // Bills
    'heart':        { component: <Heart />,        color: 'bg-candy-pink' },  // Health
    'pill':         { component: <Pill />,         color: 'bg-pink-200' },    // Health
    'ambulance':    { component: <Ambulance />,    color: 'bg-red-200' },     // Health
    'graduation-cap': { component: <GraduationCap />,color: 'bg-indigo-200' },// Education
    'university':   { component: <University />,   color: 'bg-indigo-200' }, // Education
    'home':         { component: <Home />,         color: 'bg-teal-200' },    // Rent
    'plane':        { component: <Plane />,        color: 'bg-cyan-200' },    // Travel / Transfers
    'building':     { component: <Building />,     color: 'bg-orange-200' },  // Services
    'leaf':         { component: <Leaf />,         color: 'bg-candy-mint' },  // Groceries
    'sprout':       { component: <Sprout />,       color: 'bg-green-200' },   // Groceries
    'paw-print':    { component: <PawPrint />,     color: 'bg-amber-200' },   // Pets
    'cat':          { component: <Cat />,           color: 'bg-stone-200' },   // Pets
    'dog':          { component: <Dog />,           color: 'bg-yellow-200' },  // Pets
    'briefcase':    { component: <Briefcase />,    color: 'bg-sky-200' },     // Salary / Work
    'laptop':       { component: <Laptop />,       color: 'bg-hair' },        // Work / Tech
    'phone':        { component: <Phone />,        color: 'bg-blue-200' },    // Communication
    'gift':         { component: <Gift />,         color: 'bg-rose-200' },    // Gifts
    'dumbbell':     { component: <Dumbbell />,     color: 'bg-red-200' },     // Personal Care / Gym
    'coffee':       { component: <Coffee />,       color: 'bg-yellow-200' },  // Personal Care
    'piggy-bank':   { component: <PiggyBank />,    color: 'bg-fuchsia-200' }, // Savings
    'landmark':     { component: <Landmark />,     color: 'bg-emerald-200' }, // Investments
    'shapes':       { component: <Shapes />,       color: 'bg-slate-200' },   // Miscellaneous
    'package':      { component: <Package />,      color: 'bg-hair' },        // Miscellaneous
    'default':      { component: <HelpCircle />,   color: 'bg-hair' },
};

// This helper function renders the final icon component.
const renderIcon = (iconKey: string): React.ReactNode => {
    const iconData = iconRegistry[iconKey] || iconRegistry['default'];
    const iconProps = { size: 18, className: 'text-[#1E1B16]' };
    const iconComponent = React.cloneElement(iconData.component, iconProps);
    return (
        <div className={`w-8 h-8 rounded-chip border-1.5 border-line flex items-center justify-center shrink-0 ${iconData.color}`}>
            {iconComponent}
        </div>
    );
};

// The main exported function (no change needed)
export const getCategoryIcon = (categoryName?: string | null, iconName?: string | null): React.ReactNode => {
    if (iconName && iconRegistry[iconName]) { return renderIcon(iconName); }
    if (categoryName) {
        const lowerCategory = categoryName.toLowerCase();
        if (lowerCategory.includes('salary')) return renderIcon('briefcase');
        // ... all other fallbacks remain the same ...
        if (lowerCategory.includes('food')) return renderIcon('utensils');
        if (lowerCategory.includes('groceries')) return renderIcon('leaf');
    }
    return renderIcon('default');
};

// Export ALL available icons, the parent component will handle filtering.
export const availableIcons = Object.keys(iconRegistry).filter(key => key !== 'default');