import React from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function Partners() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold mb-8">Partenaires</h1>
        <p className="text-xl text-muted-foreground">This is the Partners page.</p>
      </div>
    </div>
  );
}
