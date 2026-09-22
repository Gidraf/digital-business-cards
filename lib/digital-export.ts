/**
 * Digital (web) export: one self-contained HTML page + vCard per person,
 * zipped in the browser. The print path lives in lib/print-layout.ts.
 */
import JSZip from "jszip";
import QRCode from "qrcode";
import type { Api } from "./api";
import type { PrintItem } from "./types";
import { itemData, itemLabel, templateFor, inlineImageUrl } from "./print-layout";
import { renderCardPageHtml } from "./render-html";
import { vCardFor } from "./card-data";

export async function exportDigitalCards(api: Api, personIds: string[], zipName = "business-cards"): Promise<Blob> {
    const items: PrintItem[] = personIds.map((id) => ({ source: "person", source_id: id, template_id: null, quantity: 1, include_back: false }));
    const materials = await api.printMaterials(items);
    const zip = new JSZip();
    const cache = new Map<string, string>();
    const inline = async (url: string | null | undefined) => {
        if (!url) return null;
        if (!cache.has(url)) cache.set(url, (await inlineImageUrl(url)) ?? url);
        return cache.get(url)!;
    };

    for (const item of items) {
        const template = templateFor(item, materials);
        const data = itemData(item, materials);
        if (!template || !data) continue;
        const label = itemLabel(item, materials);
        const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "card";
        const vcard = vCardFor(data);
        zip.file(`${base}.vcf`, vcard);
        const assets: Record<string, string | null> = {};
        for (const el of template.config.elements) {
            const src = el.imageSource ?? "";
            if (src.startsWith("asset:") && !src.startsWith("asset:data:")) {
                const id = src.slice(6);
                assets[id] = await inline(materials.asset_urls[id]);
            }
        }
        const usesQr = template.config.elements.some((e) => e.type === "qrcode");
        const qr = usesQr ? await QRCode.toDataURL(vcard, { width: 400, margin: 1 }) : null;
        const html = renderCardPageHtml(template.config, data, {
            logo: await inline(data.logoUrl),
            photo: await inline(data.photoUrl),
            assets,
            qr,
            vcf: `data:text/vcard;base64,${btoa(unescape(encodeURIComponent(vcard)))}`,
        }, `${label} - ${data.company ?? ""}`);
        zip.file(`${base}.html`, html);
    }
    void zipName;
    return zip.generateAsync({ type: "blob" });
}
