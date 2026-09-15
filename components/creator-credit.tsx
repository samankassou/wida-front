"use client";

import { ArrowUpRight, Mail } from "lucide-react";
import { useLanguage } from "./language-provider";
import styles from "./creator-credit.module.css";

const name = "Foulla";
const portfolioUrl = "https://samankassou.com";
const contactUrl = "mailto:samankassoufoulla@gmail.com";

export function CreatorCredit() {
  const { locale } = useLanguage();

  return <div className={styles.credit}>
    <span>{locale === "fr" ? "Créé par" : "Created by"} <a className={styles.name} href={portfolioUrl} target="_blank" rel="noopener noreferrer">{name}</a></span>
    <nav className={styles.links} aria-label={locale === "fr" ? "Liens du créateur" : "Creator links"}>
      <a href={portfolioUrl} target="_blank" rel="noopener noreferrer">Portfolio<ArrowUpRight size={14} aria-hidden="true" /></a>
      <a href={contactUrl}><Mail size={14} aria-hidden="true" />Contact</a>
    </nav>
  </div>;
}
