/**
 * Build the render data (CardData) a template is drawn against.
 *  - business cards: Person + Company
 *  - other kinds:   Design (kind field values + uploaded images)
 */
import type { CardData, Company, Design, Person } from "./types";
import { getKind } from "./card-kinds";

export function fullNameWithTitles(p: Pick<Person, "first_name" | "last_name" | "academic_prefix" | "academic_suffix">): string {
    const prefix = p.academic_prefix ?? "";
    const suffix = p.academic_suffix ?? "";
    const base = [prefix, p.first_name, p.last_name].filter(Boolean).join(" ");
    return suffix ? `${base}, ${suffix}` : base;
}

export function personCardData(person: Person, company: Company | null | undefined): CardData {
    const suffix = person.academic_suffix ?? "";
    const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ");
    return {
        first_name: person.first_name ?? "",
        last_name: person.last_name ?? "",
        academic_prefix: person.academic_prefix ?? "",
        academic_suffix: suffix,
        full_name: fullName,
        full_name_with_titles: fullNameWithTitles(person),
        name_with_suffix: suffix ? `${fullName}, ${suffix}` : fullName,
        title: person.title ?? "",
        email: person.email ?? "",
        phone: person.phone ?? "",
        address: person.address || company?.address || "",
        company: company?.name ?? "",
        website: company?.website ?? "",
        logoUrl: company?.logo_url ?? null,
        photoUrl: person.photo_url ?? null,
        custom_fields: person.custom_fields ?? {},
    };
}

export function designCardData(design: Design): CardData {
    const data: CardData = {
        logoUrl: design.image_urls?.logo ?? null,
        photoUrl: design.image_urls?.photo ?? null,
        custom_fields: {},
    };
    for (const [k, v] of Object.entries(design.data ?? {})) {
        if (typeof v === "string") data[k] = v;
    }
    return data;
}

/** Sample data for previews of a given kind (designer, template gallery). */
export function sampleCardData(kind: string): CardData {
    return { ...getKind(kind).sample };
}

export function vCardFor(data: CardData): string {
    const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
    return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${s("full_name_with_titles") || s("full_name")}`,
        `N:${s("last_name")};${s("first_name")};;${s("academic_prefix")};${s("academic_suffix")}`,
        s("academic_prefix") ? `PREFIX:${s("academic_prefix")}` : "",
        s("academic_suffix") ? `SUFFIX:${s("academic_suffix")}` : "",
        s("title") ? `TITLE:${s("title")}` : "",
        s("company") ? `ORG:${s("company")}` : "",
        s("email") ? `EMAIL;TYPE=INTERNET,WORK:${s("email")}` : "",
        s("phone") ? `TEL;TYPE=WORK,VOICE:${s("phone")}` : "",
        s("address") ? `ADR;TYPE=WORK:;;${s("address")};;;;` : "",
        s("website") ? `URL;TYPE=WORK:${s("website")}` : "",
        "END:VCARD",
    ].filter(Boolean).join("\r\n");
}

/** What a QR element encodes for this card: vCard for people, otherwise the
 * most useful link/contact available (website → phone → nothing). */
export function qrPayloadFor(data: CardData, kind: string): string {
    if (getKind(kind).source === "person") return vCardFor(data);
    const website = typeof data.website === "string" ? data.website : "";
    if (website) return website.startsWith("http") ? website : `https://${website}`;
    for (const k of ["mpesa_phone", "contact_phone", "rsvp_contact", "phone"]) {
        const v = typeof data[k] === "string" ? (data[k] as string) : "";
        const digits = v.replace(/[^\d+]/g, "");
        if (digits.length >= 9) return `tel:${digits}`;
    }
    return "";
}
