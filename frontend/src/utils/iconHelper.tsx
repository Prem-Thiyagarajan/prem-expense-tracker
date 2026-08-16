// File: src/utils/iconHelper.tsx
//
// Category icon resolution — kept in sync with PFT-Mobile/src/lib/categoryVisual.ts,
// the other half of this pairing: the backend stores one lucide `icon_name` per
// category (`utensils`, `leaf`, …); mobile renders each as an emoji + candy tint
// (no icon font there), this file renders the *same* lucide icon component on a
// matching candy-tinted badge. Same icon_name keys, same per-icon candy colour,
// same keyword-fallback list and order — only the rendering technique differs.
// Adding an icon: add one row to `iconRegistry` AND the mirrored row in
// categoryVisual.ts's BY_ICON — never map one inline, and never let the two
// registries' colour assignment drift apart.
import React from 'react';
import {
    Utensils, Pizza, ShoppingBag, Shirt, Car, Train, Bus, Ticket, Clapperboard,
    Gamepad2, Zap, Receipt, Heart, Pill, Ambulance, GraduationCap, University,
    Home, Plane, Building, Leaf, Sprout, PawPrint, Cat, Dog, Briefcase, Laptop,
    Phone, Gift, Dumbbell, Coffee, PiggyBank, Landmark, Shapes, Package,
    Repeat, Shield, Droplet, Wifi, Music, BookOpen, Scissors, Sparkles, Scale,
    HeartHandshake, Gem, Baby, Sofa, Wrench, Palette, Camera, Bike,
    Stethoscope, Syringe, Wallet, CreditCard, Umbrella, Trophy, Cake,
    TrendingUp, Tag,
} from 'lucide-react';

// Candy accents, identical in both themes (tailwind.config.js `colors.candy`).
// Every badge below uses one of these six -- never a one-off pastel -- so the
// same category always looks the same regardless of which of the 33+29 icons
// it happens to be using.
const CANDY = {
    coral: 'bg-candy-coral', blue: 'bg-candy-blue', yellow: 'bg-candy-yellow',
    lilac: 'bg-candy-lilac', pink: 'bg-candy-pink', mint: 'bg-candy-mint',
} as const;
// Neutral badge fill for miscellaneous/unmatched categories -- matches
// categoryVisual.ts's NEUTRAL constant exactly (also tailwind's category.misc).
const NEUTRAL = 'bg-[#E8E2D4]';

const iconRegistry: { [key: string]: { component: React.ReactElement, color: string } } = {
    utensils:         { component: <Utensils />,       color: CANDY.coral },
    pizza:            { component: <Pizza />,           color: CANDY.coral },
    'shopping-bag':   { component: <ShoppingBag />,     color: CANDY.blue },
    shirt:            { component: <Shirt />,           color: CANDY.blue },
    car:              { component: <Car />,             color: CANDY.yellow },
    train:            { component: <Train />,           color: CANDY.yellow },
    bus:              { component: <Bus />,             color: CANDY.yellow },
    ticket:           { component: <Ticket />,          color: CANDY.lilac },
    clapperboard:     { component: <Clapperboard />,    color: CANDY.lilac },
    'gamepad-2':      { component: <Gamepad2 />,        color: CANDY.lilac },
    zap:              { component: <Zap />,             color: CANDY.coral },
    receipt:          { component: <Receipt />,         color: CANDY.coral },
    heart:            { component: <Heart />,           color: CANDY.pink },
    pill:             { component: <Pill />,            color: CANDY.pink },
    ambulance:        { component: <Ambulance />,       color: CANDY.coral },
    'graduation-cap': { component: <GraduationCap />,   color: CANDY.lilac },
    university:       { component: <University />,      color: CANDY.lilac },
    home:             { component: <Home />,            color: CANDY.mint },
    plane:            { component: <Plane />,           color: CANDY.blue },
    building:         { component: <Building />,        color: CANDY.yellow },
    leaf:             { component: <Leaf />,            color: CANDY.mint },
    sprout:           { component: <Sprout />,          color: CANDY.mint },
    'paw-print':      { component: <PawPrint />,        color: CANDY.yellow },
    cat:              { component: <Cat />,             color: CANDY.yellow },
    dog:              { component: <Dog />,             color: CANDY.yellow },
    briefcase:        { component: <Briefcase />,       color: CANDY.blue },
    laptop:           { component: <Laptop />,          color: CANDY.blue },
    phone:            { component: <Phone />,           color: CANDY.blue },
    gift:             { component: <Gift />,            color: CANDY.pink },
    dumbbell:         { component: <Dumbbell />,        color: CANDY.coral },
    coffee:           { component: <Coffee />,          color: CANDY.yellow },
    'piggy-bank':     { component: <PiggyBank />,       color: CANDY.pink },
    landmark:         { component: <Landmark />,        color: CANDY.mint },
    shapes:           { component: <Shapes />,          color: NEUTRAL },
    package:          { component: <Package />,         color: NEUTRAL },

    // Expanded set -- mirrors categoryVisual.ts's own "expanded" block 1:1.
    repeat:           { component: <Repeat />,          color: CANDY.blue },
    shield:           { component: <Shield />,          color: CANDY.mint },
    droplet:          { component: <Droplet />,         color: CANDY.blue },
    wifi:             { component: <Wifi />,            color: CANDY.blue },
    music:            { component: <Music />,           color: CANDY.lilac },
    'book-open':      { component: <BookOpen />,        color: CANDY.lilac },
    scissors:         { component: <Scissors />,        color: CANDY.pink },
    sparkles:         { component: <Sparkles />,        color: CANDY.pink },
    scale:            { component: <Scale />,           color: CANDY.yellow },
    'heart-handshake':{ component: <HeartHandshake />,  color: CANDY.mint },
    gem:              { component: <Gem />,             color: CANDY.pink },
    baby:             { component: <Baby />,            color: CANDY.pink },
    sofa:             { component: <Sofa />,            color: CANDY.mint },
    wrench:           { component: <Wrench />,          color: CANDY.yellow },
    palette:          { component: <Palette />,         color: CANDY.lilac },
    camera:           { component: <Camera />,          color: CANDY.lilac },
    bike:             { component: <Bike />,            color: CANDY.yellow },
    stethoscope:      { component: <Stethoscope />,     color: CANDY.coral },
    syringe:          { component: <Syringe />,         color: CANDY.coral },
    wallet:           { component: <Wallet />,          color: CANDY.blue },
    'credit-card':    { component: <CreditCard />,      color: CANDY.blue },
    umbrella:         { component: <Umbrella />,        color: CANDY.blue },
    trophy:           { component: <Trophy />,          color: CANDY.yellow },
    cake:             { component: <Cake />,            color: CANDY.pink },
    'trending-up':    { component: <TrendingUp />,      color: CANDY.mint },

    default:          { component: <Tag />,             color: NEUTRAL },
};

// Keyword -> icon key, matched against the category name. First hit wins.
// Mirrors categoryVisual.ts's BY_KEYWORD exactly, same order.
const BY_KEYWORD: [string, string][] = [
    ['salary', 'briefcase'], ['food', 'utensils'], ['grocer', 'leaf'], ['rent', 'home'],
    ['travel', 'plane'], ['transfer', 'landmark'], ['bill', 'zap'], ['shop', 'shopping-bag'],
    ['health', 'heart'], ['medic', 'pill'], ['education', 'graduation-cap'], ['entertain', 'ticket'],
    ['invest', 'landmark'], ['saving', 'piggy-bank'], ['fuel', 'car'], ['transport', 'bus'],
    ['subscription', 'repeat'], ['insurance', 'shield'], ['internet', 'wifi'], ['water', 'droplet'],
    ['music', 'music'], ['book', 'book-open'], ['beauty', 'scissors'], ['salon', 'scissors'],
    ['tax', 'scale'], ['legal', 'scale'], ['charity', 'heart-handshake'], ['donat', 'heart-handshake'],
    ['wedding', 'gem'], ['jewel', 'gem'], ['child', 'baby'], ['kid', 'baby'],
    ['furniture', 'sofa'], ['repair', 'wrench'], ['maintenance', 'wrench'], ['hobby', 'palette'],
    ['photo', 'camera'], ['cycl', 'bike'], ['doctor', 'stethoscope'], ['clinic', 'stethoscope'],
    ['vaccin', 'syringe'], ['loan', 'credit-card'], ['emi', 'credit-card'], ['stock', 'trending-up'],
    ['crypto', 'trending-up'], ['party', 'cake'], ['celebrat', 'cake'], ['sport', 'trophy'],
];

// This helper function renders the final icon component. Every badge is a
// candy fill now, so the border is always the fixed (non-theme-swapping)
// candyLine ink -- a theme-aware border-line would nearly disappear against a
// candy fill in dark mode (see tailwind.config.js's candyLine token comment).
const renderIcon = (iconKey: string): React.ReactNode => {
    const iconData = iconRegistry[iconKey] || iconRegistry['default'];
    const iconProps = { size: 18, className: 'text-[#1E1B16]' };
    const iconComponent = React.cloneElement(iconData.component, iconProps);
    return (
        <div className={`w-8 h-8 rounded-chip border-1.5 border-candyLine flex items-center justify-center shrink-0 ${iconData.color}`}>
            {iconComponent}
        </div>
    );
};

// Resolves in three steps, matching categoryVisual.ts: exact icon_name ->
// keyword match on the category name -> neutral fallback.
export const getCategoryIcon = (categoryName?: string | null, iconName?: string | null): React.ReactNode => {
    const icon = iconName?.trim().toLowerCase();
    if (icon && iconRegistry[icon]) return renderIcon(icon);

    const lowerName = categoryName?.trim().toLowerCase();
    if (lowerName) {
        for (const [keyword, iconKey] of BY_KEYWORD) {
            if (lowerName.includes(keyword)) return renderIcon(iconKey);
        }
    }

    return renderIcon('default');
};

// Export ALL available icons, the parent component will handle filtering.
export const availableIcons = Object.keys(iconRegistry).filter(key => key !== 'default');
