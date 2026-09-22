/**
 * Shop pricing — mirrors CVPAP app/views/cards/settings_view.py.
 * Price per card = the tier with the largest cards-per-sheet <= the actual
 * layout (e.g. flyers: 2-up → 15, 5-up → 6), else the kind's unit price.
 * A row is charged for at least `min_quantity` cards (business cards: min 10 → KES 30).
 */
import type { CardKind } from "./types";

export interface PriceTier {
    per_sheet: number;
    price: number;
}

export interface KindPricing {
    unit_price: number;
    min_quantity: number;
    tiers: PriceTier[];
}

export interface Pricing {
    currency: string;
    design_fee: number;
    kinds: Partial<Record<CardKind, KindPricing>>;
}

export interface QuoteLine {
    label: string;
    kind: CardKind;
    quantity: number;
    charged_quantity: number;
    per_sheet: number;
    price_per_card: number;
    amount: number;
}

export interface Quote {
    currency: string;
    design_fee: number;
    sheets: number;
    total: number;
    lines: QuoteLine[];
}

export const EMPTY_PRICING: Pricing = { currency: "KES", design_fee: 0, kinds: {} };

/** Mirrors DEFAULT_PRICING in CVPAP app/model/cards.py — used as a fallback when
 * the pricing endpoint can't be reached, so the studio still quotes sensibly. */
export const DEFAULT_PRICING: Pricing = {
    currency: "KES",
    design_fee: 0,
    kinds: {
        business_card: { unit_price: 3, min_quantity: 10, tiers: [] },
        flyer: { unit_price: 10, min_quantity: 1, tiers: [{ per_sheet: 1, price: 30 }, { per_sheet: 2, price: 15 }, { per_sheet: 4, price: 8 }, { per_sheet: 5, price: 6 }] },
        event: { unit_price: 15, min_quantity: 1, tiers: [{ per_sheet: 1, price: 30 }, { per_sheet: 2, price: 15 }, { per_sheet: 4, price: 8 }] },
        harambee: { unit_price: 15, min_quantity: 1, tiers: [{ per_sheet: 1, price: 30 }, { per_sheet: 2, price: 15 }, { per_sheet: 4, price: 8 }] },
        birthday: { unit_price: 15, min_quantity: 1, tiers: [{ per_sheet: 1, price: 30 }, { per_sheet: 2, price: 15 }, { per_sheet: 4, price: 8 }] },
        baby_shower: { unit_price: 15, min_quantity: 1, tiers: [{ per_sheet: 1, price: 30 }, { per_sheet: 2, price: 15 }, { per_sheet: 4, price: 8 }] },
        wedding: { unit_price: 20, min_quantity: 1, tiers: [{ per_sheet: 1, price: 40 }, { per_sheet: 2, price: 20 }, { per_sheet: 4, price: 10 }] },
    },
};

export function kindPricing(pricing: Pricing, kind: CardKind): KindPricing {
    return pricing.kinds[kind] ?? { unit_price: 0, min_quantity: 1, tiers: [] };
}

export function pricePerCard(pricing: Pricing, kind: CardKind, perSheet: number): number {
    const k = kindPricing(pricing, kind);
    const n = Math.max(1, Math.floor(perSheet || 1));
    let best: PriceTier | null = null;
    for (const t of k.tiers ?? []) {
        if (t.per_sheet <= n && (!best || t.per_sheet > best.per_sheet)) best = t;
    }
    return best ? Number(best.price) : Number(k.unit_price ?? 0);
}

export function quoteLine(pricing: Pricing, line: { label: string; kind: CardKind; quantity: number; per_sheet: number }): QuoteLine {
    const k = kindPricing(pricing, line.kind);
    const price = pricePerCard(pricing, line.kind, line.per_sheet);
    const charged = Math.max(line.quantity, k.min_quantity ?? 1);
    return {
        label: line.label,
        kind: line.kind,
        quantity: line.quantity,
        charged_quantity: charged,
        per_sheet: line.per_sheet,
        price_per_card: price,
        amount: round2(charged * price),
    };
}

export function buildQuote(pricing: Pricing, lines: QuoteLine[], sheets: number): Quote {
    const fee = Number(pricing.design_fee ?? 0);
    const total = round2(lines.reduce((s, l) => s + l.amount, 0) + fee);
    return { currency: pricing.currency || "KES", design_fee: fee, sheets, total, lines };
}

export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export function money(n: number, currency = "KES"): string {
    return `${currency} ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
