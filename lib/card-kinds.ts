/**
 * Card kind registry — the single source of truth for what each kind of
 * card is: its data fields (what a designer can bind text to), which image
 * slots it has, its physical size presets and the sample data used in
 * previews. The backend only validates the kind slug; field keys used in
 * built-in templates (CVPAP app/services/cards_builtin_templates.py) must
 * exist here.
 */
import type { BoundField, CardData, CardKind, CustomFieldDefinition } from "./types";
import { BUILT_IN_FIELD_LABELS, SAMPLE_CARD_DATA } from "./types";

export interface KindField {
    key: string;
    label: string;
    type?: "text" | "textarea" | "date" | "time" | "phone" | "email" | "url" | "number";
    placeholder?: string;
    group?: string;
}

export interface SizePreset {
    label: string;
    width_mm: number;
    height_mm: number;
    /** designer canvas size in px */
    width: number;
    height: number;
}

export interface KindDefinition {
    kind: CardKind;
    label: string;
    plural: string;
    description: string;
    emoji: string;
    /** business cards are data-driven from People; everything else from a saved Design */
    source: "person" | "design";
    fields: KindField[];
    /** image slots: "logo" | "photo" (design image fields) */
    images: { key: "logo" | "photo"; label: string }[];
    sizes: SizePreset[];
    sample: CardData;
}

const MM = 4; // designer px per mm for non-business-card kinds (business cards use 450×260 ≈ 5 px/mm)

export const BUSINESS_CARD_SIZES: SizePreset[] = [
    { label: "Standard 89 × 51 mm (landscape)", width_mm: 89, height_mm: 51, width: 450, height: 260 },
    { label: "Standard 51 × 89 mm (portrait)", width_mm: 51, height_mm: 89, width: 260, height: 450 },
    { label: "Euro 85 × 55 mm", width_mm: 85, height_mm: 55, width: 450, height: 291 },
    { label: "Square 70 × 70 mm", width_mm: 70, height_mm: 70, width: 350, height: 350 },
];

const A6: SizePreset = { label: "A6 105 × 148 mm", width_mm: 105, height_mm: 148, width: 105 * MM, height: 148 * MM };
const A6_LAND: SizePreset = { label: "A6 148 × 105 mm (landscape)", width_mm: 148, height_mm: 105, width: 148 * MM, height: 105 * MM };
const A5: SizePreset = { label: "A5 148 × 210 mm", width_mm: 148, height_mm: 210, width: 148 * MM, height: 210 * MM };
const A4: SizePreset = { label: "A4 210 × 297 mm", width_mm: 210, height_mm: 297, width: 210 * 3, height: 297 * 3 };
const INV_5X7: SizePreset = { label: "5 × 7 in (127 × 178 mm)", width_mm: 127, height_mm: 178, width: 508, height: 712 };
const DL: SizePreset = { label: "DL 99 × 210 mm", width_mm: 99, height_mm: 210, width: 99 * MM, height: 210 * MM };

const EVENT_COMMON: KindField[] = [
    { key: "event_date", label: "Date", type: "text", placeholder: "Saturday, 12 October 2026", group: "When & where" },
    { key: "event_time", label: "Time", type: "text", placeholder: "2:00 PM – 6:00 PM", group: "When & where" },
    { key: "venue", label: "Venue", type: "text", placeholder: "Safari Park Hotel", group: "When & where" },
    { key: "address", label: "Address / directions", type: "text", placeholder: "Thika Road, Nairobi", group: "When & where" },
    { key: "host_name", label: "Hosted by", type: "text", placeholder: "The Otieno Family", group: "Contact" },
    { key: "rsvp_contact", label: "RSVP / contact", type: "text", placeholder: "RSVP: 0712 345 678", group: "Contact" },
    { key: "message", label: "Message", type: "textarea", placeholder: "A short personal message…", group: "Message" },
];

export const CARD_KINDS: Record<CardKind, KindDefinition> = {
    business_card: {
        kind: "business_card",
        label: "Business card",
        plural: "Business cards",
        description: "Personal cards for your team — data comes from Companies & People.",
        emoji: "💼",
        source: "person",
        fields: Object.entries(BUILT_IN_FIELD_LABELS)
            .filter(([k]) => k !== "custom")
            .map(([key, label]) => ({ key, label })),
        images: [{ key: "logo", label: "Company logo" }, { key: "photo", label: "Photo" }],
        sizes: BUSINESS_CARD_SIZES,
        sample: SAMPLE_CARD_DATA,
    },
    flyer: {
        kind: "flyer",
        label: "Flyer",
        plural: "Flyers",
        description: "Promotions, offers, announcements — A5/A4/DL.",
        emoji: "📣",
        source: "design",
        fields: [
            { key: "headline", label: "Headline", placeholder: "Grand Opening!", group: "Content" },
            { key: "subheadline", label: "Sub-headline", placeholder: "Up to 50% off this weekend", group: "Content" },
            { key: "body_text", label: "Body text", type: "textarea", placeholder: "Tell people what you offer…", group: "Content" },
            { key: "offer_text", label: "Offer / highlight", placeholder: "Buy 2 get 1 free", group: "Content" },
            { key: "cta_text", label: "Call to action", placeholder: "Visit us today", group: "Content" },
            { key: "event_date", label: "Date / validity", placeholder: "Valid until 30 Nov", group: "Content" },
            { key: "business_name", label: "Business name", placeholder: "Acme Ltd", group: "Business" },
            { key: "phone", label: "Phone", type: "phone", placeholder: "+254 700 000 000", group: "Business" },
            { key: "email", label: "Email", type: "email", placeholder: "hello@acme.co.ke", group: "Business" },
            { key: "website", label: "Website", type: "url", placeholder: "acme.co.ke", group: "Business" },
            { key: "address", label: "Address", placeholder: "Moi Avenue, Nairobi", group: "Business" },
        ],
        images: [{ key: "logo", label: "Logo" }, { key: "photo", label: "Main image" }],
        sizes: [A5, A4, DL, A6],
        sample: {
            headline: "Grand Opening!",
            subheadline: "Up to 50% off this weekend only",
            body_text: "Come celebrate with us. Fresh coffee, great food and live music all weekend. Bring the whole family!",
            offer_text: "Buy 2 get 1 free on all pastries",
            cta_text: "Visit us at our new Westlands branch",
            event_date: "Sat 12 – Sun 13 October",
            business_name: "Acme Café",
            phone: "+254 700 123 456",
            email: "hello@acmecafe.co.ke",
            website: "acmecafe.co.ke",
            address: "Woodvale Grove, Westlands",
            logoUrl: null, photoUrl: null, custom_fields: {},
        },
    },
    event: {
        kind: "event",
        label: "Event invitation",
        plural: "Event invitations",
        description: "Invitations for launches, graduations, dinners, meetings.",
        emoji: "🎉",
        source: "design",
        fields: [
            { key: "event_title", label: "Event title", placeholder: "Graduation Dinner", group: "Event" },
            { key: "event_subtitle", label: "Subtitle", placeholder: "Celebrating the class of 2026", group: "Event" },
            ...EVENT_COMMON,
            { key: "dress_code", label: "Dress code", placeholder: "Smart casual", group: "Extras" },
            { key: "theme_hashtag", label: "Theme / hashtag", placeholder: "#Class2026", group: "Extras" },
        ],
        images: [{ key: "logo", label: "Logo" }, { key: "photo", label: "Photo" }],
        sizes: [A6, INV_5X7, A6_LAND, A5],
        sample: {
            event_title: "Graduation Dinner",
            event_subtitle: "Celebrating the Class of 2026",
            event_date: "Saturday, 12 December 2026",
            event_time: "6:00 PM",
            venue: "Safari Park Hotel",
            address: "Thika Road, Nairobi",
            host_name: "The Kamau Family",
            rsvp_contact: "RSVP: 0712 345 678",
            message: "Your presence will make our celebration complete.",
            dress_code: "Dress code: Smart casual",
            theme_hashtag: "#Class2026",
            logoUrl: null, photoUrl: null, custom_fields: {},
        },
    },
    harambee: {
        kind: "harambee",
        label: "Harambee card",
        plural: "Harambee cards",
        description: "Fundraising cards with M-Pesa Paybill / Till / Send Money details.",
        emoji: "🤝",
        source: "design",
        fields: [
            { key: "event_title", label: "Title", placeholder: "Medical Fundraiser", group: "Appeal" },
            { key: "beneficiary_name", label: "In aid of", placeholder: "Baby Amani", group: "Appeal" },
            { key: "purpose", label: "Purpose", type: "textarea", placeholder: "To raise funds for…", group: "Appeal" },
            { key: "target_amount", label: "Target amount", placeholder: "KES 500,000", group: "Appeal" },
            { key: "card_number", label: "Card number", placeholder: "No. 0042", group: "Appeal" },
            { key: "event_date", label: "Date", placeholder: "Sunday, 5 October 2026", group: "When & where" },
            { key: "event_time", label: "Time", placeholder: "10:00 AM", group: "When & where" },
            { key: "venue", label: "Venue", placeholder: "PCEA Church Hall, Kikuyu", group: "When & where" },
            { key: "paybill", label: "Paybill number", placeholder: "123456", group: "M-Pesa" },
            { key: "account_number", label: "Account number", placeholder: "AMANI", group: "M-Pesa" },
            { key: "till_number", label: "Till number", placeholder: "987654", group: "M-Pesa" },
            { key: "mpesa_phone", label: "Send Money number", type: "phone", placeholder: "0712 345 678", group: "M-Pesa" },
            { key: "contact_phone", label: "Contact phone", type: "phone", placeholder: "0722 000 000", group: "Contact" },
            { key: "host_name", label: "Organised by", placeholder: "Friends of Amani Committee", group: "Contact" },
            { key: "message", label: "Thank-you message", type: "textarea", placeholder: "We thank you for your generosity…", group: "Message" },
        ],
        images: [{ key: "logo", label: "Logo" }, { key: "photo", label: "Beneficiary photo" }],
        sizes: [A6, { ...BUSINESS_CARD_SIZES[0] }, A6_LAND, A5],
        sample: {
            event_title: "Medical Fundraiser",
            beneficiary_name: "Baby Amani Wanjiru",
            purpose: "To raise funds for Amani's heart surgery at Kenyatta National Hospital. Every shilling counts.",
            target_amount: "KES 1,200,000",
            card_number: "No. 0042",
            event_date: "Sunday, 5 October 2026",
            event_time: "10:00 AM",
            venue: "PCEA Church Hall, Kikuyu",
            paybill: "247247",
            account_number: "AMANI",
            till_number: "5678901",
            mpesa_phone: "0712 345 678",
            contact_phone: "0722 000 000",
            host_name: "Friends of Amani Committee",
            message: "We sincerely thank you for standing with our family. May God bless you abundantly.",
            logoUrl: null, photoUrl: null, custom_fields: {},
        },
    },
    birthday: {
        kind: "birthday",
        label: "Birthday card",
        plural: "Birthday cards",
        description: "Party invitations for all ages.",
        emoji: "🎂",
        source: "design",
        fields: [
            { key: "celebrant_name", label: "Celebrant", placeholder: "Zawadi", group: "Celebrant" },
            { key: "age", label: "Age", placeholder: "5", group: "Celebrant" },
            { key: "theme", label: "Theme", placeholder: "Theme: Safari animals", group: "Celebrant" },
            ...EVENT_COMMON,
        ],
        images: [{ key: "photo", label: "Photo" }, { key: "logo", label: "Logo" }],
        sizes: [A6, INV_5X7, A6_LAND],
        sample: {
            celebrant_name: "Zawadi",
            age: "5",
            theme: "Theme: Safari animals",
            event_date: "Saturday, 18 October 2026",
            event_time: "2:00 PM – 5:00 PM",
            venue: "Karura Forest Picnic Site",
            address: "Limuru Road, Nairobi",
            host_name: "Mum & Dad",
            rsvp_contact: "RSVP: 0712 345 678",
            message: "Come join the fun — games, cake and lots of laughter!",
            logoUrl: null, photoUrl: null, custom_fields: {},
        },
    },
    baby_shower: {
        kind: "baby_shower",
        label: "Baby shower",
        plural: "Baby shower cards",
        description: "Baby shower & welcome-baby invitations.",
        emoji: "🍼",
        source: "design",
        fields: [
            { key: "parent_names", label: "Parents", placeholder: "Achieng & Brian", group: "Family" },
            { key: "baby_name", label: "Baby name (optional)", placeholder: "Baby Girl Odhiambo", group: "Family" },
            { key: "registry", label: "Gift registry / note", placeholder: "Gifts: nappies size 1–2 welcome", group: "Extras" },
            ...EVENT_COMMON,
        ],
        images: [{ key: "photo", label: "Photo" }, { key: "logo", label: "Logo" }],
        sizes: [A6, INV_5X7, A6_LAND],
        sample: {
            parent_names: "Achieng & Brian",
            baby_name: "Baby Girl Odhiambo",
            registry: "Gifts: nappies size 1–2 welcome",
            event_date: "Sunday, 9 November 2026",
            event_time: "3:00 PM",
            venue: "The Odhiambo Residence",
            address: "Kileleshwa, Nairobi",
            host_name: "Hosted by Auntie Grace",
            rsvp_contact: "RSVP: 0733 111 222",
            message: "A little one is on the way — help us shower the parents with love.",
            logoUrl: null, photoUrl: null, custom_fields: {},
        },
    },
    wedding: {
        kind: "wedding",
        label: "Wedding card",
        plural: "Wedding cards",
        description: "Wedding invitations and reception cards.",
        emoji: "💍",
        source: "design",
        fields: [
            { key: "bride_name", label: "Bride", placeholder: "Wanjiru Njeri", group: "Couple" },
            { key: "groom_name", label: "Groom", placeholder: "David Mwangi", group: "Couple" },
            { key: "reception_venue", label: "Reception venue", placeholder: "Windsor Golf Club", group: "When & where" },
            { key: "dress_code", label: "Dress code", placeholder: "Dress code: Formal", group: "Extras" },
            ...EVENT_COMMON,
        ],
        images: [{ key: "photo", label: "Couple photo" }, { key: "logo", label: "Monogram / logo" }],
        sizes: [INV_5X7, A6, A5],
        sample: {
            bride_name: "Wanjiru Njeri",
            groom_name: "David Mwangi",
            event_date: "Saturday, 20 December 2026",
            event_time: "11:00 AM",
            venue: "All Saints Cathedral",
            address: "Kenyatta Avenue, Nairobi",
            reception_venue: "Windsor Golf Hotel & Country Club",
            host_name: "Mr & Mrs Njeri and Mr & Mrs Mwangi",
            rsvp_contact: "RSVP by 1 Dec: 0712 345 678",
            message: "We would be honoured to have you celebrate this special day with us.",
            dress_code: "Dress code: Formal",
            logoUrl: null, photoUrl: null, custom_fields: {},
        },
    },
};

export const KIND_LIST: KindDefinition[] = Object.values(CARD_KINDS);
export const DESIGN_KINDS: KindDefinition[] = KIND_LIST.filter((k) => k.source === "design");

export function getKind(kind: string | null | undefined): KindDefinition {
    return CARD_KINDS[(kind as CardKind) ?? "business_card"] ?? CARD_KINDS.business_card;
}

export function isCardKind(kind: string | null | undefined): kind is CardKind {
    return !!kind && kind in CARD_KINDS;
}

/** Label for a bound field, kind-aware, falling back to company custom fields. */
export function getBoundFieldLabel(field: BoundField, kind?: CardKind | string, customDefs?: CustomFieldDefinition[]): string {
    if (field === "custom") return "Custom Text";
    if (field.startsWith("custom:")) {
        const key = field.slice(7);
        const def = customDefs?.find((d) => d.key === key);
        return def?.label ?? key;
    }
    const def = getKind(kind).fields.find((f) => f.key === field);
    return def?.label ?? BUILT_IN_FIELD_LABELS[field] ?? field;
}

export type { BoundField } from "./types";
