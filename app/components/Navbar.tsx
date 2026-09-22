import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "@/lib/api-server";
import LogoutButton from "./LogoutButton";
import NavLinks from "./NavLinks";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";

export async function Navbar() {
    const { session } = await getServerSession();

    return (
        <nav className="sticky top-0 z-40 w-full border-b border-[#1A1128]/10 bg-[#FFF4E6]/80 backdrop-blur-md print:hidden">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-4 sm:gap-8">
                    <MobileMenu isLoggedIn={!!session} />
                    <Link href="/" className="flex items-center gap-2">
                        <Image src="/icon.svg" alt="Cards & Print" width={28} height={28} />
                        <span className="hidden sm:inline" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 18 }}>
                            <span className="italic text-[#FF6B35]">Cards</span>
                            <span className="text-[#1A1128]"> & Print</span>
                        </span>
                    </Link>
                    {session && (
                        <div className="hidden md:flex">
                            <NavLinks />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    {session ? (
                        <>
                            <span className="hidden max-w-[220px] truncate text-sm text-[#4A3B5C] lg:inline" title={session.user.email ?? undefined}>
                                {session.partner?.name ?? session.user.name}
                            </span>
                            <LogoutButton />
                        </>
                    ) : (
                        <Link
                            href="/login"
                            className="rounded-lg bg-[#FF6B35] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#e55a2a]"
                        >
                            Sign in
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
