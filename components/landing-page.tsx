"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchSession } from "@/lib/api";
import { AUTH_CHANGE_KEY } from "@/lib/auth-state";
import { ArrowRight, ArrowUpRight, Check, CheckCheck, FileText, FolderOpen, ScanLine, Search, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { LanguageSelector, useLanguage } from "./language-provider";
import styles from "./landing-page.module.css";

const copy = {
  en: {
    nav: "How it works", signIn: "Open workspace", tag: "A LITTLE LESS PAPERWORK", muted: "From a pile of paperwork", line: "to a little peace", end: "of mind.", intro: "Your invoices, finally in order. Upload your documents, review the details, and keep everything in one clear workspace.", start: "Get started", demo: "Explore the demo", note: "Try the demo. No account needed.", before: "Before Wida", after: "With Wida", scattered: "A little bit everywhere.", together: "Everything in its place.", invoice: "INVOICE", receipt: "RECEIPT", supplier: "Supplier", total: "Total amount", saved: "Saved", library: "Your invoice library", search: "Find an invoice…", review: "Reviewed and organized", sample: "Illustrative preview · fictional documents", how: "LESS BUSYWORK. MORE BREATHING ROOM.", heading: "A simple way to stay on top of it.", steps: [ ["Bring it all together", "Upload your PDFs, scans, and photos. Give your invoices a place to land."], ["Check the important details", "Review extracted information alongside the original. Make corrections before saving."], ["Find it when you need it", "Search your documents, keep invoices organized, and export saved records as CSV."] ], close: "Your paperwork can feel lighter.", closeText: "Take a look around. A calmer workspace is waiting.", footer: "A little less paperwork. A little more clarity.", skip: "Skip to content",
  },
  fr: {
    nav: "Comment ça marche", signIn: "Ouvrir mon espace", tag: "UN PEU MOINS DE PAPERASSE", muted: "Des factures en pagaille", line: "à un esprit", end: "plus tranquille.", intro: "Vos factures, enfin en ordre. Importez vos documents, vérifiez les détails et retrouvez tout dans un espace clair.", start: "Commencer", demo: "Découvrir la démo", note: "Essayez la démo. Sans créer de compte.", before: "Sans Wida", after: "Avec Wida", scattered: "Un peu partout.", together: "Chaque chose à sa place.", invoice: "FACTURE", receipt: "REÇU", supplier: "Fournisseur", total: "Montant total", saved: "Enregistrée", library: "Vos factures", search: "Trouver une facture…", review: "Vérifiées et organisées", sample: "Aperçu illustratif · documents fictifs", how: "MOINS DE SAISIE. PLUS DE SÉRÉNITÉ.", heading: "Gardez le fil, tout simplement.", steps: [ ["Réunissez vos documents", "Importez vos PDF, scans et photos. Offrez à vos factures un endroit où se retrouver."], ["Vérifiez ce qui compte", "Comparez les données extraites à l’original. Corrigez les détails avant d’enregistrer."], ["Retrouvez l’essentiel", "Recherchez vos documents, organisez vos factures et exportez vos données en CSV."] ], close: "Allégez votre quotidien.", closeText: "Faites un tour. Un espace plus serein vous attend.", footer: "Un peu moins de paperasse. Un peu plus de clarté.", skip: "Aller au contenu",
  },
};

function Face({ happy = false }: { happy?: boolean }) {
  return <span className={`${styles.face} ${happy ? styles.happy : styles.sad}`} aria-hidden="true"><span /><span /><i /></span>;
}

export default function LandingPage({ apiConfigured = false }: { apiConfigured?: boolean }) {
  const { locale } = useLanguage();
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    if (!apiConfigured) return;
    let controller: AbortController | undefined;
    let disposed = false;
    const refresh = async () => {
      if (disposed) return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const session = await fetchSession(current.signal);
        if (!current.signal.aborted) setAuthenticated(session.authenticated && Boolean(session.user));
      } catch {
        if (!current.signal.aborted) setAuthenticated(false);
      }
    };
    const focus = () => { void refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === AUTH_CHANGE_KEY) void refresh(); };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) void refresh(); };
    void refresh();
    window.addEventListener("focus", focus);
    window.addEventListener("storage", storage);
    window.addEventListener("pageshow", pageshow);
    return () => {
      disposed = true;
      controller?.abort();
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", storage);
      window.removeEventListener("pageshow", pageshow);
    };
  }, [apiConfigured]);
  const t = copy[locale];
  const icons = [Upload, ScanLine, FolderOpen];
  return <div className={styles.page}>
    <a className={styles.skip} href="#content">{t.skip}</a>
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Wida"><ScanLine size={26} strokeWidth={2.5} />wida<span>.</span></Link>
        <nav className={styles.nav} aria-label={locale === "fr" ? "Navigation principale" : "Main navigation"}>
          <a className={styles.howLink} href="#how-it-works">{t.nav}</a>
          <LanguageSelector />
          <Link className={styles.login} href="/workspace">{t.signIn}<ArrowUpRight size={16} /></Link>
        </nav>
      </header>
      <main id="content">
        <section className={styles.hero}>
          <p className={styles.eyebrow}><span className={styles.tinyMark}>✳</span>{t.tag}</p>
          <h1><span className={styles.muted}>{t.muted} <Face /></span><br />{t.line}<br className={styles.mobileBreak} /> <Face happy /> {t.end}</h1>
          <p className={styles.intro}>{t.intro}</p>
          <div className={styles.actions}><Link href={authenticated ? "/workspace" : "/login"} className={styles.primary}>{authenticated ? (locale === "fr" ? "Mon espace" : "My workspace") : t.start}<ArrowRight size={18} /></Link><Link href="/demo" className={styles.secondary}>{t.demo}<ArrowUpRight size={17} /></Link></div>
          <p className={styles.note}>{t.note}</p>
        </section>
        <section className={styles.comparison} aria-label={locale === "fr" ? "Avant et après Wida" : "Before and after Wida"}>
          <div className={`${styles.scene} ${styles.before}`}>
            <div className={styles.sceneHeading}><span>{t.before}</span><h2>{t.scattered}</h2></div>
            <div className={styles.paperBack} aria-hidden="true" />
            <div className={styles.paper}>
              <div className={styles.paperTop}><strong>ATELIER<br />NORTH®</strong><span>N° 2026–0137<br />12.09.2026</span></div>
              <h3>{t.invoice}<span>↗</span></h3>
              <div className={styles.paperRule} /><p>Design & creative services</p>
              <div className={styles.paperLines}><span /><span /><span /></div>
              <div className={styles.paperTotal}><span>TOTAL</span><strong>1 250,00 €</strong></div>
            </div>
            <div className={styles.receipt}><span>CAFÉ DU COIN</span><small>{t.receipt} #0842</small><div /><p>2 × Cappuccino <b>7,00</b></p><p>1 × Croissant <b>2,50</b></p><div /><strong>TOTAL <b>9,50 €</b></strong><span className={styles.barcode} /></div>
            <span className={styles.sticky} aria-hidden="true">{locale === "fr" ? "À classer…" : "Sort later…"}<svg width="45" height="26" viewBox="0 0 45 26"><path d="M3 4Q26 4 30 20M20 15L31 22L37 11" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></span>
          </div>
          <div className={styles.transform} aria-hidden="true"><Sparkles size={25} /></div>
          <div className={`${styles.scene} ${styles.after}`}>
            <div className={styles.sceneHeading}><span>{t.after}</span><h2>{t.together}</h2></div>
            <div className={styles.appPreview}>
              <div className={styles.previewHeader}><span className={styles.miniLogo}><ScanLine size={18} />wida.</span><span className={styles.previewAvatar}>JD</span></div>
              <div className={styles.previewTitle}><h3>{t.library}</h3><FolderOpen size={18} /></div>
              <div className={styles.previewSearch}><Search size={14} />{t.search}</div>
              <div className={styles.invoiceRow}><span className={styles.docIcon}><FileText size={20} /></span><div><strong>Atelier North</strong><small>INV-2026-0137</small></div><Check size={16} /></div>
              <div className={styles.invoiceDetail}><div><span>{t.supplier}</span><strong>Atelier North</strong></div><div><span>{t.total}</span><strong>1 250,00 €</strong></div><span className={styles.saved}><Check size={13} />{t.saved}</span></div>
              <div className={styles.invoiceRow}><span className={styles.docIcon}><FileText size={20} /></span><div><strong>Café du Coin</strong><small>REC-2026-0842</small></div><span>9,50 €</span></div>
            </div>
            <div className={styles.reviewBadge}><span><CheckCheck size={19} /></span>{t.review}</div>
          </div>
        </section>
        <p className={styles.sample}>{t.sample}</p>
        <section id="how-it-works" className={styles.how}>
          <p className={styles.eyebrow}>{t.how}</p><h2>{t.heading}</h2>
          <div className={styles.steps}>{t.steps.map(([title, description], index) => { const Icon = icons[index]; return <article key={title}><div className={styles.stepTop}><span className={styles.stepIcon}><Icon size={24} strokeWidth={1.5} /></span><span>0{index + 1}</span></div><h3>{title}</h3><p>{description}</p></article>; })}</div>
        </section>
        <section className={styles.closing}><div><h2>{t.close}</h2><p>{t.closeText}</p></div><Link href="/demo" className={styles.primary}>{t.demo}<ArrowRight size={18} /></Link></section>
      </main>
      <footer className={styles.footer}><Link href="/" className={styles.logo}>wida<span>.</span></Link><p>{t.footer}</p><ShieldCheck size={19} aria-hidden="true" /></footer>
    </div>
  </div>;
}
