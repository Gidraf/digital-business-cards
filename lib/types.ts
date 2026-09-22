// --- Element-based designer types ---

export type ElementType = "text" | "image" | "shape" | "qrcode" | "save-contact";

/**
 * A text element binds to a data field of the card's kind (see lib/card-kinds.ts).
 * "custom" = static text; "custom:<key>" = a company-defined custom field.
 * Business-card built-ins are listed in BUSINESS_CARD_FIELDS; other kinds
 * (event, harambee, birthday …) have their own keys.
 */
export type BoundField = string;

export type LinkBoundField = "email" | "phone" | "website";

export interface CardElement {
    id: string;
    type: ElementType;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    opacity?: number;
    locked?: boolean;
    rotation?: number;
    // Text properties
    boundField?: BoundField;
    customText?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    color?: string;
    textAlign?: "left" | "center" | "right";
    letterSpacing?: number;
    lineHeight?: number;
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
    // Image properties — "logo" / "photo" resolve from the card data; "asset:<id>" from the asset library
    imageSource?: "logo" | "photo" | `asset:${string}`;
    borderRadius?: number;
    objectFit?: "cover" | "contain";
    // Image advanced
    imageOpacity?: number;
    linkUrl?: string;
    linkBoundField?: LinkBoundField;
    // Icon properties (SVG template stored separately for recoloring)
    iconSvg?: string;
    iconColor?: string;
    // User-defined label for the layers panel
    label?: string;
    // Hide this element when its bound field / image resolves to empty
    hideIfEmpty?: boolean;
    // Shape properties
    backgroundColor?: string;
    gradient?: string;
    border?: string;
    shapeRadius?: number;
    // Shadow
    boxShadow?: string;
    // Text shadow
    textShadow?: string;
}

export interface TemplateConfig {
    width: number;
    height: number;
    backgroundColor: string;
    pageBackgroundColor?: string;
    elements: CardElement[];
}

export const CARD_WIDTH = 450;
export const CARD_HEIGHT = 260;

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "#ffffff",
    elements: [],
};

export interface CustomFieldDefinition {
    key: string;
    label: string;
}

/**
 * Data a template is rendered against. Flat string fields keyed by bound
 * field name (business-card fields listed explicitly for convenience), plus
 * resolved image URLs and company custom fields.
 */
export interface CardData {
    [key: string]: string | null | undefined | Record<string, string>;
    first_name?: string;
    last_name?: string;
    academic_prefix?: string;
    academic_suffix?: string;
    full_name?: string;
    full_name_with_titles?: string;
    name_with_suffix?: string;
    title?: string;
    email?: string;
    phone?: string;
    address?: string;
    company?: string;
    website?: string;
    logoUrl?: string | null;
    photoUrl?: string | null;
    custom_fields?: Record<string, string>;
}

/** @deprecated alias kept for the designer components */
export type SampleCardData = CardData;

export function dataField(data: CardData, key: string): string {
    const v = data[key];
    return typeof v === "string" ? v : "";
}

export const SAMPLE_CARD_DATA: CardData = {
    first_name: "Jane",
    last_name: "Smith",
    academic_prefix: "Dr.",
    academic_suffix: "MSc.",
    full_name: "Jane Smith",
    full_name_with_titles: "Dr. Jane Smith, MSc.",
    name_with_suffix: "Jane Smith, MSc.",
    title: "Software Engineer",
    email: "jane@acme.com",
    phone: "+254 700 123 456",
    address: "Westlands, Nairobi",
    company: "Acme Ltd.",
    website: "https://acme.co.ke",
    logoUrl: null,
    photoUrl: null,
    custom_fields: {},
};

export const BUILT_IN_FIELD_LABELS: Record<string, string> = {
    first_name: "First Name",
    last_name: "Last Name",
    academic_prefix: "Academic Prefix (Dr., Mag., …)",
    academic_suffix: "Academic Suffix (BSc., MSc., …)",
    full_name: "Full Name",
    full_name_with_titles: "Full Name with Titles",
    name_with_suffix: "Name + Suffix (no prefix)",
    title: "Job Title",
    email: "Email",
    phone: "Phone",
    address: "Address",
    company: "Company",
    website: "Website",
    custom: "Custom Text",
};

// --- API records (mirror app/model/cards.py in CVPAP) ---

export type CardKind =
    | "business_card"
    | "flyer"
    | "event"
    | "harambee"
    | "birthday"
    | "baby_shower"
    | "wedding";

export interface CardTemplate {
    id: string;
    partner_id: string | null;
    name: string;
    kind: CardKind;
    config: TemplateConfig;
    back_config: TemplateConfig | null;
    width_mm: number;
    height_mm: number;
    is_builtin: boolean;
    has_back: boolean;
    created_at: string | null;
    updated_at: string | null;
}

export interface Company {
    id: string;
    partner_id: string;
    name: string;
    domain: string;
    website: string;
    address: string;
    logo_key: string | null;
    logo_url: string | null;
    custom_field_definitions: CustomFieldDefinition[];
    people_count?: number;
    created_at: string | null;
    updated_at: string | null;
}

export interface Person {
    id: string;
    partner_id: string;
    company_id: string;
    template_id: string | null;
    first_name: string;
    last_name: string;
    academic_prefix: string;
    academic_suffix: string;
    title: string;
    email: string;
    phone: string;
    address: string;
    photo_key: string | null;
    photo_url: string | null;
    custom_fields: Record<string, string>;
    created_at: string | null;
    updated_at: string | null;
}

export interface Design {
    id: string;
    partner_id: string;
    template_id: string | null;
    kind: CardKind;
    name: string;
    data: Record<string, string>;
    image_keys: Record<string, string>;
    image_urls: Record<string, string | null>;
    created_at: string | null;
    updated_at: string | null;
}

export interface Asset {
    id: string;
    partner_id: string;
    company_id: string | null;
    name: string;
    object_key: string;
    content_type: string;
    size_bytes: number;
    url: string | null;
    created_at: string | null;
}

export interface PrintItem {
    source: "person" | "design";
    source_id: string;
    template_id: string | null;
    quantity: number;
    include_back: boolean;
}

export type PaperName = "A4" | "A3" | "A5" | "Letter" | "Legal" | "custom";

export interface PrintLayoutSettings {
    margin_mm: number;
    gap_mm: number;
    crop_marks: boolean;
    duplex: boolean;           // emit back-side pages (mirrored for long-edge flip)
    back_mode: "duplex" | "separate" | "none";
    scale: number;             // 1 = physical size
    auto_fit: boolean;         // compute cols/rows from paper & card size
    cols?: number;
    rows?: number;
    card_width_mm?: number;    // override (defaults to template size)
    card_height_mm?: number;
}

export interface PrintJob {
    id: string;
    partner_id: string;
    name: string;
    kind: CardKind;
    paper: PaperName;
    orientation: "portrait" | "landscape";
    items: PrintItem[];
    layout: Partial<PrintLayoutSettings>;
    status: "draft" | "rendering" | "ready" | "failed";
    pdf_key: string | null;
    pdf_url: string | null;
    page_count: number;
    card_count: number;
    error: string | null;
    created_at: string | null;
    updated_at: string | null;
    rendered_at: string | null;
}

export interface PrintMaterials {
    people: Person[];
    designs: Design[];
    templates: CardTemplate[];
    companies: Company[];
    asset_urls: Record<string, string | null>;
}
